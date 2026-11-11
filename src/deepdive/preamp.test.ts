import { describe, expect, test } from 'bun:test'
import { COLLECTOR_OHMS, GAIN_STEPS, IN_PEAK, MIC_LEVELS, RAIL, RESTING, SAMPLES, SWING_MAX, currentFor, levelsOf, outputAt, preampCycle } from './preamp'
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
    const l = at(GAIN_STEPS.gain10)
    expect(round1(l.rms)).toBe(-44.8)
    expect(getHealth(l.rms, 'analog', l.peak)).toBe('too-quiet')
  })

  test('+54 dB: −0.8 dBu, line level — good (±1.0 V)', () => {
    const l = at(GAIN_STEPS.gain54)
    expect(round1(l.rms)).toBe(-0.8)
    expect(getHealth(l.rms, 'analog', l.peak)).toBe('good')
    expect(Math.abs(outputAt(0, 54))).toBeCloseTo(1.002, 3)
  })

  test('+70 dB: +15.2 dBu, peaks at +18.2 — hot, not clipping yet', () => {
    const l = at(GAIN_STEPS.gain70)
    expect(round1(l.rms)).toBe(15.2)
    expect(round1(l.peak)).toBe(18.2)
    expect(getHealth(l.rms, 'analog', l.peak)).toBe('hot')
  })

  test('+80 dB: the tops cut off at ±7.75 V, a peak of +20 dBu — clipping', () => {
    const l = at(GAIN_STEPS.gain80)
    expect(SWING_MAX).toBeCloseTo(7.746, 3)
    expect(round1(l.peak)).toBe(20)
    expect(getHealth(l.rms, 'analog', l.peak)).toBe('clipping')
    expect(outputAt(0, 80)).toBeCloseTo(-SWING_MAX, 9)
    expect(RAIL - SWING_MAX).toBeCloseTo(1.25, 2)
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
    for (const g of Object.values(GAIN_STEPS)) {
      const c = preampCycle(g)
      expect(c.moved[0]).toBe(0)
      expect(c.moved[SAMPLES]).toBeCloseTo(1, 9)
      for (let i = 1; i <= SAMPLES; i++) expect(c.moved[i]).toBeGreaterThan(c.moved[i - 1])
    }
  })
})
