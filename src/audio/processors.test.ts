import { describe, expect, it } from 'bun:test'
import { CLIP_DBU } from '../signal/levels'
import type { DynamicsSettings } from './processors'
import { FULL_SCALE_DB, Meter, ampOf, dbOf, dynamicsProcessor } from './processors'

// The processors that run in the audio thread, on plain blocks of samples: what the time engine's
// tests checked before them (Attack, Release, Hold, a gate opening on peaks, a limiter's ceiling),
// now on real sound.

const RATE = 48000

/** `seconds` of a sine (`hz`) at an average of `db` (its peaks 3 dB higher). */
function sine(db: number, seconds: number, hz = 1000): Float32Array {
  const amp = ampOf(db) * Math.SQRT2
  return Float32Array.from({ length: Math.round(seconds * RATE) }, (_, n) => amp * Math.sin(2 * Math.PI * hz * n / RATE))
}

const join = (...parts: Float32Array[]) => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}

const silence = (seconds: number) => new Float32Array(Math.round(seconds * RATE))

/** Runs a card's processor over whole signals (one channel, or two linked), in 128-frame blocks as the audio thread does. */
function run(settings: DynamicsSettings, ...input: Float32Array[]): Float32Array[] {
  const process = dynamicsProcessor(settings, RATE)
  const output = input.map((c) => new Float32Array(c.length))
  for (let at = 0; at < input[0].length; at += 128) {
    const end = Math.min(at + 128, input[0].length)
    process(input.map((c) => c.subarray(at, end)), output.map((c) => c.subarray(at, end)))
  }
  return output
}

/** The average (dB) of samples `from`…`to` seconds. */
function averageDb(x: Float32Array, from = 0, to = x.length / RATE): number {
  const part = x.subarray(Math.round(from * RATE), Math.round(to * RATE))
  return dbOf(Math.sqrt(part.reduce((s, v) => s + v * v, 0) / part.length))
}

/** Within `tolerance` dB. */
function expectNear(actual: number, expected: number, tolerance: number) {
  expect(Math.abs(actual - expected)).toBeLessThan(tolerance)
}

/** The loudest sample (dB). */
const peakDb = (x: Float32Array) => dbOf(x.reduce((m, v) => Math.max(m, Math.abs(v)), 0))

/** How far a card turns a signal down around `at` seconds (dB): the average in against out over 20 ms. */
const reductionAt = (input: Float32Array, output: Float32Array, at: number) =>
  averageDb(input, at - 0.01, at + 0.01) - averageDb(output, at - 0.01, at + 0.01)

const comp = (more: Partial<Extract<DynamicsSettings, { type: 'comp' }>> = {}): DynamicsSettings =>
  ({ type: 'comp', thresholdDb: -20, ratio: 4, attackMs: 10, releaseMs: 100, makeupDb: 0, ...more })

const gate = (more: Partial<Extract<DynamicsSettings, { type: 'noise-gate' }>> = {}): DynamicsSettings =>
  ({ type: 'noise-gate', thresholdDb: -40, rangeDb: -80, holdMs: 50, attackMs: 1, releaseMs: 100, ...more })

describe('the scale', () => {
  it('a sample of 1.0 is the clip level; a dB reading is an amplitude and back', () => {
    expect(FULL_SCALE_DB).toBe(CLIP_DBU)
    expect(ampOf(CLIP_DBU)).toBe(1)
    expect(ampOf(-60)).toBeCloseTo(1e-4, 10)
    expect(dbOf(ampOf(-128))).toBeCloseTo(-128, 6)
    expect(dbOf(0)).toBe(-Infinity)
  })
})

describe('a compressor', () => {
  it('settles where its curve says: a sine 10 dB over the threshold at 4:1 comes down 7.5 dB, then the makeup', () => {
    // A hair more: it hears the level of each moment, which a sine's waves make ripple a little
    const [out] = run(comp({ makeupDb: 3 }), sine(-10, 1))
    expectNear(averageDb(out, 0.5, 1), -10 - 7.5 + 3, 0.1)
  })

  it('leaves a signal under its threshold alone (only the makeup)', () => {
    const [out] = run(comp({ makeupDb: 6 }), sine(-30, 0.5))
    expect(averageDb(out, 0.2, 0.5)).toBeCloseTo(-24, 2)
  })

  it('Attack: a sound starts, and it turns down over the Attack time — most of the way within a few', () => {
    const input = join(silence(0.2), sine(-10, 0.5))
    const [out] = run(comp({ attackMs: 20 }), input)
    expect(reductionAt(input, out, 0.2 + 0.02)).toBeGreaterThan(7.5 * 0.4)
    expect(reductionAt(input, out, 0.2 + 0.02)).toBeLessThan(7.5 * 0.8)
    expect(reductionAt(input, out, 0.2 + 0.15)).toBeCloseTo(7.5, 0)
  })

  it('Release: the sound drops under the threshold, and it lets go over the Release time (to about 37 %)', () => {
    // A loud stretch (turned down 7.5 dB), then a quiet one: the quiet sine comes through turned
    // down less and less
    const input = join(sine(-10, 0.5), sine(-40, 1))
    const [out] = run(comp({ releaseMs: 200 }), input)
    expect(reductionAt(input, out, 0.5 + 0.2)).toBeCloseTo(7.5 * Math.exp(-1), 0)
    expect(reductionAt(input, out, 0.5 + 0.9)).toBeLessThan(0.3)
  })

  it('a slow Attack lets the start of each hit through: higher peaks than a quick one', () => {
    // A drum-like hit: 30 ms at +6 dBu, then silence, four times
    const hit = join(sine(6, 0.03, 200), silence(0.47))
    const input = join(hit, hit, hit, hit)
    const peakWith = (attackMs: number) => peakDb(run(comp({ thresholdDb: -30, attackMs }), input)[0].subarray(RATE))
    expect(peakWith(30)).toBeGreaterThan(peakWith(1) + 6)
  })

  it('in stereo, linked: the louder side decides, both get the same gain', () => {
    const [l, r] = run(comp(), sine(-10, 0.6), sine(-30, 0.6))
    expectNear(averageDb(l, 0.3, 0.6), -17.5, 0.1)
    expect(averageDb(r, 0.3, 0.6) - averageDb(l, 0.3, 0.6)).toBeCloseTo(-20, 3)
  })
})

describe('a noise gate', () => {
  it('starts closed: a sound under its threshold is turned down by the Range', () => {
    const [out] = run(gate({ rangeDb: -30 }), sine(-50, 0.5))
    expect(averageDb(out, 0.1, 0.5)).toBeCloseTo(-80, 1)
  })

  it('opens on the peaks: a sound reaching the threshold passes as it is, within its Attack', () => {
    const input = join(sine(-60, 0.3), sine(-30, 0.3))
    const [out] = run(gate(), input)
    expect(averageDb(out, 0.3 + 0.01, 0.6)).toBeCloseTo(-30, 1)
  })

  it('Hold: the sound drops under the threshold and the gate stays open for the Hold time, then Release closes it', () => {
    const input = join(sine(-30, 0.3), sine(-60, 1))
    const [out] = run(gate({ holdMs: 100, releaseMs: 100 }), input)
    // Still open during Hold (its watch on the last peak fades for a few ms first) …
    expect(averageDb(out, 0.3 + 0.03, 0.3 + 0.09)).toBeCloseTo(-60, 1)
    // … then closing over the Release time, down by the whole Range in the end
    expect(averageDb(out, 0.3 + 0.12 + 0.1 - 0.005, 0.3 + 0.12 + 0.1 + 0.005)).toBeLessThan(-60 - 80 * 0.5)
    expect(averageDb(out, 1.2, 1.3)).toBeCloseTo(-140, 0)
  })

  it('between the noise and the music: the pauses drop, the music passes', () => {
    // A phrase at −20 dBu, then a pause where only hiss at −80 dBu is left
    const hiss = Float32Array.from({ length: RATE }, (_, n) => ampOf(-80) * Math.SQRT2 * Math.sin(n * 2.3))
    const input = join(sine(-20, 0.5), hiss)
    const [out] = run(gate({ thresholdDb: -50 }), input)
    expect(averageDb(out, 0.1, 0.5)).toBeCloseTo(-20, 1)
    expect(averageDb(out, 1.0, 1.5)).toBeLessThan(-150)
  })
})

describe('a limiter', () => {
  it('no sample gets past its ceiling, not even the first of a hit; then the makeup', () => {
    const hit = join(sine(10, 0.02, 120), silence(0.2))
    const [out] = run({ type: 'limiter', thresholdDb: -10, makeupDb: 3 }, join(hit, hit, hit))
    expect(peakDb(out)).toBeLessThan(-7 + 1e-3)
    expect(peakDb(out)).toBeGreaterThan(-7.1)
  })

  it('a signal under its ceiling passes untouched', () => {
    const input = sine(-20, 0.3)
    const [out] = run({ type: 'limiter', thresholdDb: -3, makeupDb: 0 }, input)
    expect(averageDb(out)).toBeCloseTo(averageDb(input), 4)
  })
})

describe('a de-esser', () => {
  const settings: DynamicsSettings = { type: 'deesser', thresholdDb: -30, frequencyHz: 6000 }

  it('turns a hiss-like high tone down a lot: it is all sibilance', () => {
    const [out] = run(settings, sine(-10, 0.5, 10000))
    // Not all of it: a little of a high tone is in the band below the Frequency too
    expect(averageDb(out, 0.2, 0.5)).toBeLessThan(-10 - 10)
  })

  it('leaves a low tone as loud alone: it turns down only the sibilant frequencies', () => {
    const [out] = run(settings, sine(-10, 0.5, 300))
    expect(averageDb(out, 0.2, 0.5)).toBeGreaterThan(-10.05)
  })

  it('a low tone with sibilance on it: the sibilance comes down, the tone stays', () => {
    const low = sine(-10, 0.5, 300)
    const high = sine(-20, 0.5, 10000)
    const [out] = run(settings, low.map((v, i) => v + high[i]))
    // What is left of the high tone, and the low one, seen through the 300 Hz tone's own average:
    // the whole is now barely louder than the low tone alone
    expect(averageDb(out, 0.2, 0.5)).toBeLessThan(-9.8)
    expect(averageDb(out, 0.2, 0.5)).toBeGreaterThan(-10.1)
  })

  it('under its threshold the two bands add up to the signal again: nothing changes', () => {
    const input = sine(-50, 0.2, 7000)
    const [out] = run(settings, input)
    expect(Math.max(...out.map((v, i) => Math.abs(v - input[i])))).toBeLessThan(1e-6)
  })
})

describe('the meter', () => {
  it('measures each channel over its stretch only: the loudest sample, the average, the hum', () => {
    const meter = new Meter({ inputs: 2, start: 1000, end: 1000 + RATE, humHz: 50 }, RATE)
    // Input 0: a 50 Hz hum at −40 dBu with a quiet 1 kHz tone on it. Input 1: stereo, a sine on the left only.
    const hum  = sine(-40, 2, 50)
    const tone = sine(-60, 2, 1000)
    const mixed = hum.map((v, i) => v + tone[i])
    const left = sine(-6, 2)
    const right = new Float32Array(left.length)
    // Something loud before the stretch, which the meter must not see
    mixed[10] = 1
    for (let at = 0; at < 2 * RATE; at += 128) {
      meter.add(at, [[mixed.subarray(at, at + 128)], [left.subarray(at, at + 128), right.subarray(at, at + 128)]])
    }
    const [[a], [l, r]] = meter.read()
    expect(dbOf(a.rms)).toBeCloseTo(10 * Math.log10(10 ** (-40 / 10) + 10 ** (-60 / 10)), 2)
    expect(dbOf(a.hum)).toBeCloseTo(-40, 2)
    expect(dbOf(a.peak)).toBeLessThan(-30)
    expect(dbOf(l.rms)).toBeCloseTo(-6, 3)
    // A sine's peaks are 3.01 dB above its average
    expect(dbOf(l.peak)).toBeCloseTo(-6 + 10 * Math.log10(2), 3)
    expect(dbOf(l.hum)).toBeLessThan(-100)
    expect(r.rms).toBe(0)
  })

  it('an input nothing reaches has no channels', () => {
    const meter = new Meter({ inputs: 1, start: 0, end: 256 }, RATE)
    meter.add(0, [[]])
    meter.add(128, [[]])
    expect(meter.read()).toEqual([[]])
  })
})
