import { describe, expect, test } from 'bun:test'
import { getHealth } from '../signal/levels'
import {
  ANALOG_TOP, FS_VOLTS, JITTER_MAX, LEVEL_MAX, OWN_NOISE, TONES, TONE_START, windowOf,
  bitsOf, codeOf, codeRange, conversionOf, floorOf, foldOf, jitterOf, noiseOf, passOf, quantize, samplesOf,
} from './converter'
import type { Setup } from './converter'

// Conversion (D46): the numbers its picture shows, as the canvas would judge them.

const LINE: Setup = { rate: 48000, tone: TONE_START, level: 0, bits: null, grade: 'quality', filter: true, jitter: 0 }
const at = (s: Partial<Setup>) => conversionOf({ ...LINE, ...s })
/** The picture's window at the start: 4.6 ms of 2 kHz */
const WINDOW_S = windowOf(TONE_START)

/** The largest gap between the DAC's output and a wave over the window, in volts */
function worstGap(s: Partial<Setup>, wave: (t: number) => number, deg = 37): number {
  const c = at(s), n = Math.round(WINDOW_S * c.setup.rate), first = -60
  const samples = samplesOf(c, deg, first, n + 60)
  let worst = 0
  for (let i = 0; i <= 100; i++) {
    const t = (WINDOW_S * i) / 100
    worst = Math.max(worst, Math.abs(c.output(t, samples, first) - wave(t)))
  }
  return worst
}

describe('the picture\'s window', () => {
  test('as a sound editor zooms: 0.1 s at 20 Hz (two cycles), 1 ms at 20 kHz (twenty), 4.6 ms at 2 kHz — never under 1 ms', () => {
    expect(windowOf(20)).toBeCloseTo(0.1, 9)
    expect(windowOf(20000)).toBeCloseTo(0.001, 9)
    expect(windowOf(30000)).toBeCloseTo(0.001, 9)
    expect(WINDOW_S).toBeCloseTo(0.0046, 9)
    expect(windowOf(1000)).toBeCloseTo(0.0074, 9)
    TONES.forEach((f, i) => { if (i) expect(windowOf(f)).toBeLessThanOrEqual(windowOf(TONES[i - 1])) })
  })
  test('the window holds several cycles at every tone, more as it rises', () => {
    expect(windowOf(20) * 20).toBeCloseTo(2, 6)
    expect(windowOf(TONE_START) * TONE_START).toBeCloseTo(9.2, 6)
    expect(windowOf(20000) * 20000).toBeCloseTo(20, 6)
  })
  test('the tone\'s steps: third octaves from 20 Hz to 30 kHz, rising, 2 kHz among them', () => {
    expect(TONES[0]).toBe(20)
    expect(TONES[TONES.length - 1]).toBe(30000)
    expect(TONES.some((f) => f === TONE_START)).toBe(true)
    TONES.forEach((f, i) => { if (i) expect(f).toBeGreaterThan(TONES[i - 1]) })
  })
})

describe('full scale, as the canvas aligns it', () => {
  test('0 dBFS is a peak of +18 dBu: 6.16 V', () => {
    expect(FS_VOLTS).toBeCloseTo(6.155, 2)
    expect(ANALOG_TOP).toBeCloseTo(7.75, 2)
  })
  test('line level (an average of 0 dBu) is written at −18 dBFS, its peaks at −15', () => {
    const c = at({})
    expect(c.digital.rms).toBeCloseTo(-18, 1)
    expect(c.digital.peak).toBeCloseTo(-14.99, 1)
    expect(c.clipped).toBe(false)
  })
})

describe('bit depth', () => {
  test('3 bits: eight steps of a quarter of full scale, the top one a step short', () => {
    const { step, top, bottom } = codeRange(3)
    expect(step).toBeCloseTo(FS_VOLTS / 4, 6)
    expect(top).toBeCloseTo(0.75 * FS_VOLTS, 6)
    expect(bottom).toBeCloseTo(-FS_VOLTS, 6)
    expect(quantize(0.3 * FS_VOLTS, 3)).toBeCloseTo(0.25 * FS_VOLTS, 6)
    expect(quantize(2 * FS_VOLTS, 3)).toBeCloseTo(0.75 * FS_VOLTS, 6)
    expect(quantize(-2 * FS_VOLTS, 3)).toBeCloseTo(-FS_VOLTS, 6)
  })
  test('a number as its bits, the sign first', () => {
    expect(codeOf(0.5 * FS_VOLTS, 4)).toBe(4)
    expect(bitsOf(4, 4)).toEqual([false, true, false, false])
    expect(bitsOf(-1, 4)).toEqual([true, true, true, true])
    expect(bitsOf(-8, 4)).toEqual([true, false, false, false])
  })
  test('the noise under the numbers: 6 dB a bit, and the converter\'s own', () => {
    expect(floorOf(16, 'quality').bits).toBeCloseTo(-96.3, 1)
    expect(floorOf(16, 'quality').total).toBeCloseTo(-96.3, 1)
    expect(floorOf(24, 'quality').bits).toBeCloseTo(-144.5, 1)
    // 24 bits: the converter's own noise is what is left
    expect(floorOf(24, 'quality').total).toBeCloseTo(OWN_NOISE.quality, 1)
    expect(floorOf(24, 'budget').total).toBeCloseTo(OWN_NOISE.budget, 1)
    expect(floorOf(8, 'budget').total).toBeCloseTo(-48.2, 1)
  })
  test('line level at 3 bits: barely more than the noise of its steps', () => {
    const c = at({ bits: 3 })
    expect(c.digital.rms - floorOf(3, 'quality').total).toBeLessThan(5)
  })
})

describe('the filters and Nyquist', () => {
  test('all of 20 kHz passes at 44.1 kHz and 48 kHz, nothing from half the sample rate', () => {
    expect(passOf(20000, 44100)).toBe(1)
    expect(passOf(20000, 48000)).toBe(1)
    expect(passOf(22050, 44100)).toBe(0)
    expect(passOf(24000, 48000)).toBe(0)
    expect(passOf(30000, 96000)).toBe(1)
  })
  test('folding back below half the sample rate', () => {
    expect(foldOf(30000, 48000)).toBe(18000)
    expect(foldOf(50000, 48000)).toBe(2000)
    expect(foldOf(10000, 48000)).toBe(10000)
  })
  test('2 kHz comes back out of the DAC as it went in', () => {
    const c = at({ bits: 24 })
    expect(worstGap({ bits: 24 }, (t) => c.received(t, 37))).toBeLessThan(0.002 * FS_VOLTS)
  })
  test('20 kHz at 48 kHz: 2.4 samples a cycle, and it still comes back whole', () => {
    const c = at({ tone: 20000, bits: 24 })
    expect(worstGap({ tone: 20000, bits: 24 }, (t) => c.received(t, 37))).toBeLessThan(0.03 * c.amplitude)
  })
  test('30 kHz with no filter comes back as 18 kHz, turned over', () => {
    const c = at({ tone: 30000, filter: false })
    expect(c.components.map(({ freq, kind }) => ({ freq, kind }))).toEqual([{ freq: 18000, kind: 'alias' }])
    const wave = (t: number) => -c.amplitude * Math.sin(2 * Math.PI * 18000 * t - (37 * Math.PI) / 180)
    expect(worstGap({ tone: 30000, filter: false }, wave)).toBeLessThan(0.03 * c.amplitude)
  })
  test('30 kHz with the filter never reaches the numbers', () => {
    const c = at({ tone: 30000 })
    expect(c.components).toEqual([])
    expect(Math.abs(c.sample(5, 0).held)).toBeLessThan(FS_VOLTS * 1e-5)
  })
})

describe('0 dBFS: nothing above it', () => {
  test('the most the knob gives: hot on the analogue side, clipping in the numbers', () => {
    const c = at({ level: LEVEL_MAX })
    expect(getHealth(c.analog.rms, 'analog', c.analog.peak)).toBe('hot')
    expect(getHealth(c.digital.rms, 'digital', c.digital.peak)).toBe('clipping')
    expect(c.clipped).toBe(true)
  })
  test('+15 dBu: its peaks just past full scale', () => {
    expect(at({ level: 14.9 }).clipped).toBe(false)
    expect(at({ level: 15 }).clipped).toBe(true)
  })
  test('clipped, new sines: odd harmonics, all under half the sample rate with the filter', () => {
    const c = at({ level: LEVEL_MAX })
    const third = c.components.find((s) => s.freq === 6000)
    expect(third?.kind).toBe('distortion')
    expect(third!.db).toBeGreaterThan(-40)
    expect(c.components.find((s) => s.freq === 4000)).toBeUndefined()
    expect(c.components.every((s) => s.freq < 24000 && s.kind !== 'alias')).toBe(true)
  })
  test('clipped with no filter, they fold back: the 5th harmonic of 5 kHz (25 kHz) at 23 kHz', () => {
    const c = at({ level: LEVEL_MAX, tone: 5000, filter: false })
    expect(c.components.find((s) => s.freq === 23000)?.kind).toBe('alias')
    // With the filter, nothing there
    expect(at({ level: LEVEL_MAX, tone: 5000 }).components.find((s) => s.freq === 23000)).toBeUndefined()
    expect(at({ level: LEVEL_MAX, tone: 5000, bits: 24 }).components.every((s) => s.kind !== 'alias' || s.db < -100)).toBe(true)
  })
  test('2 kHz at 48 kHz: what folds back lands on its own harmonics (2 kHz goes into 48 kHz 24 times)', () => {
    const c = at({ level: LEVEL_MAX, filter: false })
    expect(c.components.every((s) => (s.freq / 2000) % 2 === 1)).toBe(true)
  })
  test('3 bits: rounding alone makes new sines', () => {
    expect(at({ bits: 3 }).components.some((s) => s.kind === 'distortion' && s.db > -40)).toBe(true)
    expect(at({ bits: 24 }).components.every((s) => s.kind === 'tone' || s.db < -100)).toBe(true)
  })
  test('under full scale, only the tone', () => {
    expect(at({ level: 10 }).components.map((s) => s.kind)).toEqual(['tone'])
  })
})

describe('never the same', () => {
  test('the best converters at 24 bits: what comes out differs from line level, 99 dB under it (their own noise, twice)', () => {
    const c = at({ bits: 24 }), first = -60, samples = samplesOf(c, 0, first, Math.ceil(WINDOW_S * c.setup.rate) + 60)
    let sq = 0, sig = 0
    for (let i = 0; i < 1000; i++) {
      const t = (WINDOW_S * i) / 1000, want = c.arriving(t, 0)
      sq += (c.output(t, samples, first) - want) ** 2
      sig += want ** 2
    }
    const db = 10 * Math.log10(sq / sig)
    expect(db).toBeLessThan(-97)
    expect(db).toBeGreaterThan(-101)
  })
  test('the noise is the same every time, with an rms of 1', () => {
    const n = Array.from({ length: 4000 }, (_, i) => noiseOf(i))
    expect(Math.sqrt(n.reduce((a, v) => a + v * v, 0) / n.length)).toBeCloseTo(1, 1)
    expect(noiseOf(7)).toBe(noiseOf(7))
  })
})

describe('the clock', () => {
  test('a wobbly clock takes each sample early or late, never past its wobble', () => {
    const offsets = Array.from({ length: 200 }, (_, n) => jitterOf(n))
    expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(1)
    expect(Math.max(...offsets)).toBeGreaterThan(0.8)
    expect(Math.min(...offsets)).toBeLessThan(-0.8)
  })
  test('its error grows with the tone: the steeper the wave, the further off', () => {
    const errorAt = (tone: number) => {
      const c = at({ tone, jitter: JITTER_MAX })
      let worst = 0
      for (let n = 0; n < 24; n++) worst = Math.max(worst, Math.abs(c.sample(n, 0).held - c.received(n / 48000, 0)))
      return worst / c.amplitude
    }
    expect(errorAt(2000)).toBeLessThan(0.1)
    expect(errorAt(15000)).toBeGreaterThan(0.4)
  })
})
