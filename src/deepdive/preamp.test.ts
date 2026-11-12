import { describe, expect, test } from 'bun:test'
import {
  CHIP_OHMS, COLLECTOR_OHMS, GAIN_MAX, GAIN_MIN, HUM_PEAK, IN_PEAK, LINE_GAIN, MIC_LEVELS, RAIL, SAMPLES, STAGE_CURRENT, SWING_MAX, TURNS, VT,
  emitterResistor, gainOf, gainResistor, humAt, levelsOf, pinsAt, preampCycle, timesOf, transformerOut, transistorCurrent,
} from './preamp'
import type { Input, Wiring } from './preamp'
import { distortionOf, harmonicsOf } from './amp'
import { getHealth } from '../signal/levels'
import { rad } from './wave'

// The numbers Analogue amplification's preamp says (Deep dive, D46), judged as the canvas judges a signal
// (signal/levels.ts getHealth): a change that moves one of them changes a text — update both.

const round1 = (db: number) => Math.round(db * 10) / 10
const at = (gainDb: number, wiring: Wiring = 'balanced', input: Input = 'chip') => levelsOf(preampCycle(gainDb, wiring, input).out)
const health = (gainDb: number, wiring: Wiring = 'balanced', input: Input = 'chip') => {
  const l = at(gainDb, wiring, input)
  return getHealth(l.rms, 'analog', l.peak)
}
const thd = (table: Float64Array) => Math.round(distortionOf(harmonicsOf(table)) * 10000) / 100

describe('the microphone', () => {
  test('±10 mV: −40.8 dBu on average, peaks at −37.8 — too quiet for the desk', () => {
    expect(round1(MIC_LEVELS.rms)).toBe(-40.8)
    expect(round1(MIC_LEVELS.peak)).toBe(-37.8)
    expect(getHealth(MIC_LEVELS.rms, 'analog', MIC_LEVELS.peak)).toBe('too-quiet')
  })

  test('balanced: pin 2 and pin 3 each half of it, opposite, the same hum on both', () => {
    for (const deg of [0, 37, 90, 200]) {
      const r = rad(deg), { pin2, pin3 } = pinsAt(r, 'balanced')
      expect(pin2 - pin3).toBeCloseTo(IN_PEAK * Math.cos(r), 12)
      expect(pin2 + pin3).toBeCloseTo(2 * humAt(r), 12)
    }
    expect(pinsAt(0, 'balanced').pin2).toBeCloseTo(0.005, 12)
    expect(pinsAt(0, 'balanced').pin3).toBeCloseTo(-0.005, 12)
  })

  test('unbalanced: all of it and the hum on pin 2, pin 3 at the shield’s 0 V', () => {
    const r = rad(15), { pin2, pin3 } = pinsAt(r, 'unbalanced')
    expect(pin3).toBe(0)
    expect(pin2).toBeCloseTo(IN_PEAK * Math.cos(r) + humAt(r), 12)
    expect(HUM_PEAK).toBe(0.002)
  })
})

describe('balanced, the hum cancels; unbalanced, it stays', () => {
  test('balanced: pin 2 − pin 3 is the microphone alone', () => {
    const c = preampCycle(LINE_GAIN)
    for (let i = 0; i <= SAMPLES; i += 37) expect(c.diff[i]).toBeCloseTo(IN_PEAK * Math.cos((i * 2 * Math.PI) / SAMPLES), 12)
    expect(thd(c.out)).toBe(0)
  })

  test('unbalanced: the hum comes out with it, 20 % of the sound (its 6th sine)', () => {
    const c = preampCycle(LINE_GAIN, 'unbalanced')
    const h = harmonicsOf(c.out)
    expect(h[5] / h[0]).toBeCloseTo(0.2, 9)
    expect(thd(c.out)).toBe(20)
  })
})

describe('the clean chip: gain = 1 + 10 kΩ ÷ RG, as the canvas judges what comes out', () => {
  test('the gain resistor: none (open) at 0 dB, 101 Ω at +40, 10 Ω at +60', () => {
    expect(gainResistor(0)).toBe(Infinity)
    expect(round1(gainResistor(40))).toBe(101)
    expect(round1(gainResistor(60))).toBe(10)
    for (const g of [6, 20, 40, 58]) expect(1 + CHIP_OHMS / gainResistor(g)).toBeCloseTo(timesOf(g), 9)
  })

  test('+40 dB: −0.8 dBu, line level — good (±1.0 V), the right way up', () => {
    const l = at(40)
    expect(round1(l.rms)).toBe(-0.8)
    expect(getHealth(l.rms, 'analog', l.peak)).toBe('good')
    expect(preampCycle(40).out[0]).toBeCloseTo(1, 9)
    expect(preampCycle(40).out[SAMPLES / 2]).toBeCloseTo(-1, 9)
  })

  test('too quiet at 0 dB, good from +1 (−39.8 dBu) to +40, hot from +41 (+0.2 dBu)', () => {
    expect(health(0)).toBe('too-quiet')
    expect(health(1)).toBe('good')
    expect(health(40)).toBe('good')
    expect(health(41)).toBe('hot')
    expect(round1(at(41).rms)).toBe(0.2)
  })

  test('hot up to +57 dB, clipping from +58 — the tops cut off at ±7.75 V, a peak of +20 dBu', () => {
    expect(health(57)).toBe('hot')
    expect(health(58)).toBe('clipping')
    expect(SWING_MAX).toBeCloseTo(7.746, 3)
    expect(round1(at(58).peak)).toBe(20)
    expect(preampCycle(60).out[0]).toBeCloseTo(SWING_MAX, 9)
    expect(RAIL - SWING_MAX).toBeCloseTo(1.25, 2)
  })

  test('unbalanced, the hum’s peaks clip it a dB sooner: from +57', () => {
    expect(health(56, 'unbalanced')).toBe('hot')
    expect(health(57, 'unbalanced')).toBe('clipping')
  })

  test('the knob: whole dB, 0 … +60, line level to start', () => {
    expect(gainOf(40.4)).toBe(40)
    expect(gainOf(-5)).toBe(GAIN_MIN)
    expect(gainOf(95)).toBe(GAIN_MAX)
    expect(LINE_GAIN).toBe(40)
  })

  test('its input transistors: 1 mA each at rest, ±0.1 mA through the gain resistor at line level', () => {
    const c = preampCycle(40)
    expect(c.currentA[SAMPLES / 4]).toBeCloseTo(STAGE_CURRENT, 9)
    expect(c.gainCurrent[0]).toBeCloseTo(0.000099, 6)
    for (let i = 0; i <= SAMPLES; i += 11) expect(c.currentA[i] + c.currentB[i]).toBeCloseTo(2 * STAGE_CURRENT, 12)
  })

  test('the gain resistor’s current never passes what the output can give: neither transistor shuts', () => {
    for (const w of ['balanced', 'unbalanced'] as const) {
      const c = preampCycle(60, w)
      expect(Math.max(...c.gainCurrent)).toBeLessThan(0.00078)
      expect(Math.min(...c.currentB)).toBeGreaterThan(0.0002)
    }
  })

  test('the charges: down each transistor’s wire, back to 0 … 1; to and fro through the gain resistor', () => {
    for (const g of [GAIN_MIN, 20, LINE_GAIN, GAIN_MAX]) {
      const c = preampCycle(g)
      expect(c.movedA[0]).toBe(0)
      expect(c.movedA[SAMPLES]).toBeCloseTo(1, 9)
      expect(c.movedB[SAMPLES]).toBeCloseTo(1, 9)
      expect(c.gainMoved[0]).toBe(0)
      expect(c.gainMoved[SAMPLES]).toBeCloseTo(0, 12)
    }
  })
})

describe('the transformer input', () => {
  test('×10 with no power of its own; one transistor and its resistors give the rest', () => {
    expect(TURNS).toBe(10)
    expect(transformerOut(0.0001)).toBeCloseTo(0.001, 7)
    // The gain is the resistor above ÷ (the one below + the transistor’s own 26 Ω), × 10
    expect(VT / STAGE_CURRENT).toBeCloseTo(26, 9)
    expect(round1(emitterResistor(40))).toBe(874)
    expect(round1(emitterResistor(60))).toBe(64)
    expect(TURNS * COLLECTOR_OHMS / (emitterResistor(40) + 26)).toBeCloseTo(100, 9)
  })

  test('the transistor’s current: 1 mA at rest, growing faster one way than it shrinks the other', () => {
    expect(transistorCurrent(0, 874)).toBeCloseTo(STAGE_CURRENT, 12)
    const up = transistorCurrent(0.1, 200) - STAGE_CURRENT, down = STAGE_CURRENT - transistorCurrent(-0.1, 200)
    expect(up).toBeGreaterThan(down)
  })

  test('the same verdicts as the chip: line level at +40, clipping from +58 — the right way up', () => {
    expect(health(40, 'balanced', 'transformer')).toBe('good')
    expect(health(41, 'balanced', 'transformer')).toBe('hot')
    expect(health(57, 'balanced', 'transformer')).toBe('hot')
    expect(health(58, 'balanced', 'transformer')).toBe('clipping')
    expect(preampCycle(40, 'balanced', 'transformer').out[0]).toBeGreaterThan(0.99)
  })

  test('balanced, it cancels the hum too', () => {
    const h = harmonicsOf(preampCycle(40, 'balanced', 'transformer').out)
    expect(h[5] / h[0]).toBeLessThan(1e-6)
  })

  test('the new sines it adds: 0.13 % at line level, 1.38 % at +52 dB, 4.77 % at +57 — the 2nd and 3rd', () => {
    expect(thd(preampCycle(40, 'balanced', 'transformer').out)).toBe(0.13)
    expect(thd(preampCycle(52, 'balanced', 'transformer').out)).toBe(1.38)
    expect(thd(preampCycle(57, 'balanced', 'transformer').out)).toBe(4.77)
    const h = harmonicsOf(preampCycle(52, 'balanced', 'transformer').out)
    expect(h[1] / h[0]).toBeGreaterThan(0.01)
    expect(h[2] / h[0]).toBeGreaterThan(0.002)
  })
})
