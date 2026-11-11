import { describe, expect, test } from 'bun:test'
import { COLLECTOR_OHMS, GAIN_MAX, GAIN_MIN, IN_PEAK, LINE_GAIN, MIC_LEVELS, RAIL, RESTING, SAMPLES, SWING_MAX, currentFor, gainOf, gainResistorOf, levelsOf, ohmsText, timesOf, outputAt, preampCycle } from './preamp'
import { getHealth } from '../signal/levels'
import { rad } from './wave'

// The numbers Mic preamp's picture says (Deep dive, D46), judged as the canvas judges a signal
// (signal/levels.ts getHealth): a change that moves one of them changes a text — update both.

const round1 = (db: number) => Math.round(db * 10) / 10
const at = (gainDb: number) => levelsOf(preampCycle(gainDb).out)

describe('the microphone', () => {
  test('±2 mV: −54.8 dBu on average, peaks at −51.8 — too quiet for the desk', () => {
    expect(round1(MIC_LEVELS.rms)).toBe(-54.8)
    expect(round1(MIC_LEVELS.peak)).toBe(-51.8)
    expect(getHealth(MIC_LEVELS.rms, 'analog', MIC_LEVELS.peak)).toBe('too-quiet')
  })
})

describe('the gain knob, as the canvas judges what comes out', () => {
  test('+10 dB: −44.8 dBu, still too quiet', () => {
    const l = at(10)
    expect(round1(l.rms)).toBe(-44.8)
    expect(getHealth(l.rms, 'analog', l.peak)).toBe('too-quiet')
  })

  test('+54 dB: −0.8 dBu, line level — good (±1.0 V)', () => {
    const l = at(54)
    expect(round1(l.rms)).toBe(-0.8)
    expect(getHealth(l.rms, 'analog', l.peak)).toBe('good')
    expect(Math.abs(outputAt(0, 54))).toBeCloseTo(1.002, 3)
  })

  test('+70 dB: +15.2 dBu, peaks at +18.2 — hot, not clipping yet', () => {
    const l = at(70)
    expect(round1(l.rms)).toBe(15.2)
    expect(round1(l.peak)).toBe(18.2)
    expect(getHealth(l.rms, 'analog', l.peak)).toBe('hot')
  })

  test('+80 dB: the tops cut off at ±7.75 V, a peak of +20 dBu — clipping', () => {
    const l = at(80)
    expect(SWING_MAX).toBeCloseTo(7.746, 3)
    expect(round1(l.peak)).toBe(20)
    expect(getHealth(l.rms, 'analog', l.peak)).toBe('clipping')
    expect(outputAt(0, 80)).toBeCloseTo(-SWING_MAX, 9)
    expect(RAIL - SWING_MAX).toBeCloseTo(1.25, 2)
  })
})

describe('the knob turned anywhere: where the canvas changes its verdict', () => {
  const health = (g: number) => { const l = at(g); return getHealth(l.rms, 'analog', l.peak) }

  test('too quiet up to +14 dB, good from +15 (−39.8 dBu) to +54, hot from +55 (+0.2 dBu)', () => {
    expect(health(14)).toBe('too-quiet')
    expect(health(15)).toBe('good')
    expect(health(54)).toBe('good')
    expect(health(55)).toBe('hot')
  })

  test('hot up to +71 dB, clipping from +72 — its peaks at +20.2 dBu', () => {
    expect(health(71)).toBe('hot')
    expect(health(72)).toBe('clipping')
  })

  test('the knob: whole dB, 0 … +80, line level to start', () => {
    expect(gainOf(54.4)).toBe(54)
    expect(gainOf(-5)).toBe(GAIN_MIN)
    expect(gainOf(95)).toBe(GAIN_MAX)
    expect(LINE_GAIN).toBe(54)
  })
})

describe('the gain resistor, the knob', () => {
  test('9 kΩ ÷ the gain resistor is the gain: 9 kΩ at 0 dB, 18 Ω at line level, 0.9 Ω at +80', () => {
    expect(gainResistorOf(0)).toBeCloseTo(9000, 6)
    expect(gainResistorOf(54)).toBeCloseTo(17.96, 2)
    expect(gainResistorOf(80)).toBeCloseTo(0.9, 6)
    for (const g of [0, 10, 37, 54, 72, 80]) expect(COLLECTOR_OHMS / gainResistorOf(g)).toBeCloseTo(timesOf(g), 6)
    expect(Math.round(timesOf(54))).toBe(501)
  })

  test('its value as the label writes it', () => {
    expect(ohmsText(9000)).toEqual({ value: '9', kilo: true })
    expect(ohmsText(gainResistorOf(10))).toEqual({ value: '2.85', kilo: true })
    expect(ohmsText(gainResistorOf(20))).toEqual({ value: '900', kilo: false })
    expect(ohmsText(gainResistorOf(54))).toEqual({ value: '18', kilo: false })
    expect(ohmsText(gainResistorOf(72))).toEqual({ value: '2.3', kilo: false })
    expect(ohmsText(gainResistorOf(80))).toEqual({ value: '0.9', kilo: false })
  })
})

describe('the transistor and its resistor', () => {
  test('upside down: +2 mV in, the output below 0', () => {
    expect(outputAt(0, 54)).toBeLessThan(0)
    expect(outputAt(Math.PI, 54)).toBeGreaterThan(0)
    expect(outputAt(rad(90), 54)).toBeCloseTo(0, 9)
  })

  test('1 mA while nothing plays; at line level it changes by ±0.11 mA', () => {
    expect(RESTING).toBeCloseTo(0.001, 12)
    expect(currentFor(0)).toBeCloseTo(0.001, 12)
    const c = preampCycle(54)
    expect(Math.max(...c.current) - RESTING).toBeCloseTo(0.000111, 6)
    expect(RESTING - Math.min(...c.current)).toBeCloseTo(0.000111, 6)
  })

  test('the resistor turns the current’s change into the output: 9 kΩ × 0.11 mA ≈ 1 V', () => {
    expect(COLLECTOR_OHMS * 0.000111).toBeCloseTo(1, 2)
    expect(IN_PEAK * Math.pow(10, 54 / 20)).toBeCloseTo(1.002, 3)
  })

  test('the charges move on, back where they started after a cycle: 0 … 1', () => {
    for (const g of [GAIN_MIN, 10, LINE_GAIN, 70, GAIN_MAX]) {
      const c = preampCycle(g)
      expect(c.moved[0]).toBe(0)
      expect(c.moved[SAMPLES]).toBeCloseTo(1, 9)
      for (let i = 1; i <= SAMPLES; i++) expect(c.moved[i]).toBeGreaterThan(c.moved[i - 1])
    }
  })
})
