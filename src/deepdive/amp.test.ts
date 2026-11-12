import { describe, expect, test } from 'bun:test'
import { GAIN, GAIN_DB, LINE_PEAK, LOAD, OUT_PEAK, PEAK_CURRENT, RAIL, RESTING, SWING_MAX, VBE, VOLUME_FULL, VOLUME_OFF, ampCycle, at, distortionOf, harmonicsOf, meanCurrents, outputFor, powersOf, transistorCurrents, volumeOf, volumeTimes, wantedFor } from './amp'
import { LINE_GAIN, SAMPLES, preampCycle } from './preamp'
import type { AmpClass } from './amp'

/** The stage fed the clean chip at this gain (balanced), its Volume full unless given */
const fed = (cls: AmpClass, gainDb: number, volumeDb = VOLUME_FULL) => ampCycle(cls, preampCycle(gainDb).out, volumeDb)
import { rad } from './wave'

// The numbers Analogue amplification's power stage says (Deep dive, D46): a change that moves one of
// them changes a text — update both, with the reason. Its first stage, the preamp: preamp.test.ts.

const round1 = (w: number) => Math.round(w * 10) / 10
const thd = (c: ReturnType<typeof ampCycle>) => Math.round(distortionOf(harmonicsOf(c.out)) * 1000) / 10

describe('the gain', () => {
  test('line level in (±1 V), ±10 V out: 10 times, +20 dB', () => {
    expect(LINE_PEAK).toBeCloseTo(1, 9)
    expect(GAIN).toBeCloseTo(10, 9)
    expect(Math.round(GAIN_DB)).toBe(20)
    expect(PEAK_CURRENT).toBeCloseTo(1.25, 9)
  })

  test('the right way up all along: the speaker moves as the microphone did (+10 mV → +1 V → +10 V)', () => {
    expect(preampCycle(LINE_GAIN).out[0]).toBeCloseTo(1, 9)
    expect(wantedFor(LINE_PEAK)).toBeCloseTo(OUT_PEAK, 9)
    expect(ampCycle('a').out[0]).toBeCloseTo(10, 9)
    expect(at(ampCycle('a').out, 180)).toBeCloseTo(-10, 9)
  })
})

describe('the Volume knob: it only turns the line level down', () => {
  test('full (0 dB): all of it; −6 dB: half; at its bottom: off', () => {
    expect(volumeTimes(VOLUME_FULL)).toBe(1)
    expect(fed('a', LINE_GAIN, -6).out[0]).toBeCloseTo(5.01, 2)
    expect(volumeTimes(VOLUME_OFF)).toBe(0)
    expect(Math.max(...fed('a', LINE_GAIN, VOLUME_OFF).out)).toBe(0)
  })

  test('whole dB, −40 (off) … 0', () => {
    expect(volumeOf(-6.4)).toBe(-6)
    expect(volumeOf(-90)).toBe(VOLUME_OFF)
    expect(volumeOf(5)).toBe(VOLUME_FULL)
  })

  test('a line out already clipped stays clipped, however low the Volume', () => {
    const c = fed('ab', 60, -20)
    const h = harmonicsOf(c.out)
    expect(Math.max(...c.out)).toBeLessThan(SWING_MAX)
    expect(distortionOf(h)).toBeGreaterThan(0.1)
  })
})

describe('the output, at line level', () => {
  test('class A and AB copy the input cleanly', () => {
    for (const deg of [0, 37, 90, 200, 300]) {
      expect(at(ampCycle('a').out, deg)).toBeCloseTo(OUT_PEAK * Math.cos(rad(deg)), 9)
      expect(at(ampCycle('ab').out, deg)).toBeCloseTo(OUT_PEAK * Math.cos(rad(deg)), 9)
    }
  })

  test('class B reaches the same peaks, but gives nothing while the drive is under 0.6 V', () => {
    const b = ampCycle('b')
    expect(at(b.out, 0)).toBeCloseTo(OUT_PEAK, 9)
    expect(at(b.out, 180)).toBeCloseTo(-OUT_PEAK, 9)
    // The notch: ±3.2° around each crossing
    const half = (Math.acos(VBE / (OUT_PEAK + VBE)) * 180) / Math.PI
    expect(90 - half).toBeCloseTo(3.24, 2)
    expect(at(b.out, 88)).toBe(0)
    expect(at(b.out, 272)).toBe(0)
    expect(at(b.out, 85)).toBeGreaterThan(0)
  })
})

describe('the preamp’s gain knob before it: the stage follows the line level it is fed', () => {
  test('+34 dB, half the line level: ±5 V, a quarter of the power', () => {
    const c = fed('ab', 34)
    expect(c.out[0]).toBeCloseTo(5.012, 3)
    expect(powersOf(c).speaker).toBeCloseTo(1.57, 2)
  })

  test('+41 dB, a line level just hot, the Volume full: the tops are cut off a volt short of the sides', () => {
    expect(SWING_MAX).toBe(RAIL - 1)
    for (const cls of ['a', 'b', 'ab'] as const) {
      const c = fed(cls, 41)
      expect(c.wanted[0]).toBeCloseTo(11.22, 2)
      expect(c.out[0]).toBe(SWING_MAX)
      expect(at(c.out, 180)).toBe(-SWING_MAX)
    }
    expect(outputFor(30, 'a')).toBe(SWING_MAX)
    expect(outputFor(-30, 'b')).toBe(-SWING_MAX)
  })

  test('+60 dB, the preamp itself clipping: flat tops at ±11 V nearly all the way round', () => {
    const c = fed('ab', 60)
    let flat = 0
    for (let i = 0; i < SAMPLES; i++) if (Math.abs(c.out[i]) === SWING_MAX) flat++
    expect(flat / SAMPLES).toBeGreaterThan(0.85)
  })

  test('nothing added at 0 dB: the microphone’s 10 mV made 0.1 V, and only the resting current', () => {
    const c = fed('a', 0)
    expect(Math.max(...c.out)).toBeCloseTo(0.1, 9)
    expect(powersOf(c).supply).toBeCloseTo(15, 6)
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

  test('the microphone gives 25 billionths of a watt into a 2 kΩ preamp', () => {
    expect(powersOf(ampCycle('a')).microphone).toBeCloseTo(2.5e-8, 15)
    expect(powersOf(ampCycle('a')).microphone.toFixed(9)).toBe('0.000000025')
  })

  test('the heat is the voltage across each transistor × its current', () => {
    for (const gain of [LINE_GAIN, 46]) {
      const c = fed('ab', gain)
      let sum = 0
      for (let i = 0; i < SAMPLES; i++) sum += c.upperHeat[i] + c.lowerHeat[i]
      expect(sum / SAMPLES).toBeCloseTo(powersOf(c).heat, 6)
    }
  })
})

describe('the charges moving', () => {
  test('along a transistor’s wire: 0 at 0°, all of the cycle’s at 360°, never back', () => {
    for (const cls of ['a', 'b', 'ab'] as const) {
      for (const gain of [LINE_GAIN, 56]) {
        const c = fed(cls, gain)
        expect(c.upperMoved[0]).toBe(0)
        expect(c.upperMoved[SAMPLES]).toBeCloseTo(1, 9)
        for (let i = 1; i <= SAMPLES; i++) expect(c.upperMoved[i]).toBeGreaterThan(c.upperMoved[i - 1] - 1e-12)
      }
    }
  })

  test('to and fro on the speaker’s: back where they were after a cycle', () => {
    for (const cls of ['a', 'b', 'ab'] as const) {
      for (const gain of [0, LINE_GAIN, 46, 60]) {
        const c = fed(cls, gain)
        expect(c.speakerMoved[0]).toBe(0)
        expect(c.speakerMoved[SAMPLES]).toBeCloseTo(0, 9)
      }
    }
  })

  test('the average currents: 0.63 A each in class A, 0.38 A in B', () => {
    expect(meanCurrents(ampCycle('a')).upper).toBeCloseTo(0.625, 6)
    expect(meanCurrents(ampCycle('b')).lower).toBeCloseTo(0.385, 3)
  })
})

describe('the sines in the output', () => {
  test('a clean copy has only its first: 10 V', () => {
    const h = harmonicsOf(ampCycle('ab').out)
    expect(h[0]).toBeCloseTo(10, 6)
    for (const x of h.slice(1)) expect(x).toBeLessThan(1e-6)
    expect(thd(ampCycle('ab'))).toBe(0)
  })

  test('both sides bending alike (the notch, flat tops) add only the odd harmonics', () => {
    for (const c of [ampCycle('b'), fed('ab', 46)]) {
      const h = harmonicsOf(c.out)
      for (const even of [1, 3, 5, 7, 9]) expect(h[even]).toBeLessThan(1e-6)
      expect(h[2]).toBeGreaterThan(0.1)
    }
  })

  test('how much each adds: the notch 3.3 %, flat tops 0.6 % at +41 dB, 5.4 % at +42, 20.8 % at +46', () => {
    expect(thd(ampCycle('b'))).toBe(3.3)
    expect(thd(fed('ab', 41))).toBe(0.6)
    expect(thd(fed('ab', 42))).toBe(5.4)
    expect(thd(fed('ab', 46))).toBe(20.8)
  })

  test('silence has none', () => {
    expect(distortionOf([0, 0, 0])).toBe(0)
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
