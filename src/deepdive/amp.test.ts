import { describe, expect, test } from 'bun:test'
import { GAIN, GAIN_DB, LOAD, OUT_PEAK, PEAK_CURRENT, RAIL, RESTING, SAMPLES, SWING_MAX, VBE, ampCycle, at, classOf, distortionOf, harmonicsOf, meanCurrents, outputAt, powersOf, transistorCurrents } from './amp'
import type { Distortion } from './amp'
import { rad } from './wave'

// The numbers Analogue amplification's picture says (Deep dive, D46): a change that moves one of
// them changes a text — update both, with the reason.

describe('the gain', () => {
  test('±2 mV in, ±10 V out: 5000 times, 74 dB', () => {
    expect(GAIN).toBeCloseTo(5000, 6)
    expect(Math.round(GAIN_DB)).toBe(74)
    expect(PEAK_CURRENT).toBeCloseTo(1.25, 9)
  })
})

describe('the output', () => {
  test('class A and AB copy the input cleanly', () => {
    for (const deg of [0, 37, 90, 200, 300]) {
      expect(outputAt(rad(deg), 'a')).toBeCloseTo(OUT_PEAK * Math.cos(rad(deg)), 9)
      expect(outputAt(rad(deg), 'ab')).toBeCloseTo(OUT_PEAK * Math.cos(rad(deg)), 9)
    }
  })

  test('a transistor alone pushes only: the top half, nothing below 0', () => {
    expect(outputAt(0, 'one')).toBeCloseTo(OUT_PEAK, 9)
    expect(outputAt(Math.PI, 'one')).toBe(0)
    expect(outputAt(rad(120), 'one')).toBe(0)
  })

  test('class B reaches the same peaks, but gives nothing while the drive is under 0.6 V', () => {
    expect(outputAt(0, 'b')).toBeCloseTo(OUT_PEAK, 9)
    expect(outputAt(Math.PI, 'b')).toBeCloseTo(-OUT_PEAK, 9)
    // The notch: ±3.2° around each crossing
    const half = (Math.acos(VBE / (OUT_PEAK + VBE)) * 180) / Math.PI
    expect(90 - half).toBeCloseTo(3.24, 2)
    expect(outputAt(rad(88), 'b')).toBe(0)
    expect(outputAt(rad(272), 'b')).toBe(0)
    expect(outputAt(rad(85), 'b')).toBeGreaterThan(0)
  })

  test('flat tops stop a volt short of the sides; rounded tops never reach them', () => {
    expect(outputAt(0, 'ab', 'flat')).toBe(SWING_MAX)
    expect(outputAt(Math.PI, 'ab', 'flat')).toBe(-SWING_MAX)
    for (let deg = 0; deg <= 360; deg += 5) expect(Math.abs(outputAt(rad(deg), 'ab', 'rounded'))).toBeLessThan(SWING_MAX)
    expect(SWING_MAX).toBe(RAIL - 1)
  })
})

describe('the transistors', () => {
  test('their currents always add up to the speaker’s', () => {
    for (const resting of [0, 0.05, 0.625]) {
      for (const out of [-10, -3, -0.4, 0, 0.2, 5, 10]) {
        const { upper, lower } = transistorCurrents(out, resting)
        expect(upper - lower).toBeCloseTo(out / LOAD, 9)
        expect(upper).toBeGreaterThan(-1e-12)
        expect(lower).toBeGreaterThan(-1e-12)
      }
    }
  })

  test('class A keeps both open all the way round; class B shuts one each half', () => {
    const a = ampCycle('a'), b = ampCycle('b')
    expect(Math.min(...a.upper)).toBeCloseTo(0, 9)
    for (let i = 1; i < SAMPLES; i++) if (i !== SAMPLES / 2) expect(a.lower[i]).toBeGreaterThan(0)
    expect(at(b.lower, 0)).toBe(0)
    expect(at(b.upper, 180)).toBe(0)
  })

  test('the resting currents: half the peak in class A, 50 mA in AB, none in B', () => {
    expect(RESTING.a).toBeCloseTo(0.625, 9)
    expect(RESTING.ab).toBe(0.05)
    expect(RESTING.b).toBe(0)
    const { upper, lower } = transistorCurrents(0, RESTING.a)
    expect(upper).toBeCloseTo(0.625, 9)
    expect(lower).toBeCloseTo(0.625, 9)
  })
})

describe('where the power goes, at ±10 V into 8 Ω', () => {
  const round1 = (w: number) => Math.round(w * 10) / 10

  test('class A: 15 W from the supply, all the time — 6.25 W to the speaker, 8.75 W of heat', () => {
    const p = powersOf(ampCycle('a'))
    expect(p.supply).toBeCloseTo(15, 6)
    expect(p.speaker).toBeCloseTo(6.25, 6)
    expect(p.heat).toBeCloseTo(8.75, 6)
    expect(p.silentHeat).toBeCloseTo(15, 9)
  })

  test('class B: 9.2 W, 6.1 W to the speaker (the notch takes a little), 3.2 W of heat, none in silence', () => {
    const p = powersOf(ampCycle('b'))
    expect(round1(p.supply)).toBe(9.2)
    expect(round1(p.speaker)).toBe(6.1)
    expect(round1(p.heat)).toBe(3.2)
    expect(p.silentHeat).toBe(0)
    // Without the notch it would be 2 × 12 V × 10 V / (π × 8 Ω)
    expect(2 * RAIL * OUT_PEAK / (Math.PI * LOAD)).toBeCloseTo(9.55, 2)
  })

  test('class AB: 9.6 W, 6.25 W to the speaker, 3.3 W of heat, 1.2 W in silence', () => {
    const p = powersOf(ampCycle('ab'))
    expect(round1(p.supply)).toBe(9.6)
    expect(p.speaker).toBeCloseTo(6.25, 6)
    expect(round1(p.heat)).toBe(3.3)
    expect(p.silentHeat).toBeCloseTo(1.2, 9)
  })

  test('a transistor alone: 4.6 W, 3.0 W to the speaker', () => {
    const p = powersOf(ampCycle('one'))
    expect(round1(p.supply)).toBe(4.6)
    expect(round1(p.speaker)).toBe(3)
  })

  test('the microphone gives a billionth of a watt into a 2 kΩ preamp', () => {
    expect(powersOf(ampCycle('a')).microphone).toBeCloseTo(1e-9, 15)
  })

  test('the heat is the voltage across each transistor × its current', () => {
    const c = ampCycle('ab')
    let sum = 0
    for (let i = 0; i < SAMPLES; i++) sum += c.upperHeat[i] + c.lowerHeat[i]
    expect(sum / SAMPLES).toBeCloseTo(powersOf(c).heat, 6)
  })
})

describe('the charges moving', () => {
  test('along a transistor’s wire: 0 at 0°, all of the cycle’s at 360°, never back', () => {
    for (const cls of ['one', 'a', 'b', 'ab'] as const) {
      const c = ampCycle(cls)
      expect(c.upperMoved[0]).toBe(0)
      expect(c.upperMoved[SAMPLES]).toBeCloseTo(1, 9)
      for (let i = 1; i <= SAMPLES; i++) expect(c.upperMoved[i]).toBeGreaterThan(c.upperMoved[i - 1] - 1e-12)
    }
    expect(ampCycle('one').lowerMoved[SAMPLES]).toBe(0)
  })

  test('to and fro on the speaker’s: back where they were after a cycle', () => {
    for (const d of ['clean', 'oneSided', 'flat', 'notch'] as const) {
      const c = ampCycle(classOf(d), d)
      expect(c.speakerMoved[0]).toBe(0)
      expect(c.speakerMoved[SAMPLES]).toBeCloseTo(0, 9)
    }
  })

  test('the average currents: 0.63 A each in class A, 0.38 A in B', () => {
    expect(meanCurrents(ampCycle('a')).upper).toBeCloseTo(0.625, 6)
    expect(meanCurrents(ampCycle('b')).lower).toBeCloseTo(0.385, 3)
  })
})

describe('the harmonics', () => {
  const thd = (d: Distortion) => distortionOf(harmonicsOf(ampCycle(classOf(d), d).out))

  test('a clean copy has only its first: 10 V', () => {
    const h = harmonicsOf(ampCycle('ab').out)
    expect(h[0]).toBeCloseTo(10, 6)
    for (const x of h.slice(1)) expect(x).toBeLessThan(1e-6)
    expect(thd('clean')).toBeLessThan(1e-6)
  })

  test('both sides bending alike (rounded, flat, the notch) add only the odd harmonics', () => {
    for (const d of ['rounded', 'flat', 'notch'] as const) {
      const h = harmonicsOf(ampCycle(classOf(d), d).out)
      for (const even of [1, 3, 5, 7, 9]) expect(h[even]).toBeLessThan(1e-6)
      expect(h[2]).toBeGreaterThan(0.1)
    }
  })

  test('one side bending adds the 2nd alone: 6 % of the first', () => {
    const h = harmonicsOf(ampCycle('ab', 'oneSided').out)
    expect(h[1] / h[0]).toBeCloseTo(0.06, 6)
    for (const x of h.slice(2)) expect(x).toBeLessThan(1e-6)
  })

  test('how much each adds: the notch 3.3 %, one side 6.0 %, rounded 9.7 %, flat 20.9 %', () => {
    expect(Math.round(thd('notch') * 1000) / 10).toBe(3.3)
    expect(Math.round(thd('oneSided') * 1000) / 10).toBe(6)
    expect(Math.round(thd('rounded') * 1000) / 10).toBe(9.7)
    expect(Math.round(thd('flat') * 1000) / 10).toBe(20.9)
  })
})

describe('reading a table', () => {
  test('between its samples, and at both ends', () => {
    const c = ampCycle('a')
    expect(at(c.out, 0)).toBeCloseTo(10, 9)
    expect(at(c.out, 360)).toBeCloseTo(10, 9)
    expect(at(c.out, 60.25)).toBeCloseTo(10 * Math.cos(rad(60.25)), 4)
  })
})
