import { describe, expect, it } from 'bun:test'
import { PEAK_FALL_DB_PER_S, PEAK_HOLD_S, SLICE_S, fromLoopStart, louderSlices, meterFrames, reductionFrames } from './meters'
import type { ChannelSlices } from './processors'
import { ampOf, dbOf } from './processors'
import { LOOP_S, generatorSound } from './sounds'

// The meters' movement, worked out as a DAW's meters move: RMS over 300 ms, a peak that falls back
// 20 dB in 1.7 s, a hold of 3 s — on one loop that runs into itself.

const RATE  = 48000
const SLICE = Math.round(SLICE_S * RATE)
const N     = Math.round(LOOP_S / SLICE_S)

/** A whole loop of samples cut into slices, as the meter worklet keeps them. */
function sliced(x: Float32Array): ChannelSlices {
  const n = Math.ceil(x.length / SLICE)
  const peak = new Float32Array(n)
  const power = new Float32Array(n)
  for (let s = 0; s < n; s++) {
    let p = 0
    let sum = 0
    for (let i = s * SLICE; i < Math.min(x.length, (s + 1) * SLICE); i++) {
      p = Math.max(p, Math.abs(x[i]))
      sum += x[i] * x[i]
    }
    peak[s] = p
    power[s] = sum / SLICE
  }
  return { peak, power }
}

/** Slices of silence, with a level of `db` (a sine's peak and power) in the slices `from`…`to`. */
function steady(db: number, from = 0, to = N): ChannelSlices {
  const peak = new Float32Array(N)
  const power = new Float32Array(N)
  for (let s = from; s < to; s++) {
    peak[s] = ampOf(db) * Math.SQRT2
    power[s] = ampOf(db) ** 2
  }
  return { peak, power }
}

/** One loud sample (`db`) in slice `at` of a silent loop. */
function click(db: number, at: number): ChannelSlices {
  const peak = new Float32Array(N)
  const power = new Float32Array(N)
  peak[at] = ampOf(db)
  power[at] = ampOf(db) ** 2 / SLICE
  return { peak, power }
}

describe('the RMS (300 ms)', () => {
  it('a sine: its average everywhere, its peaks 3 dB above it', () => {
    const m = meterFrames(steady(-20))
    for (let k = 0; k < N; k += 97) {
      expect(m.rms[k]).toBeCloseTo(-20, 3)
      expect(m.peak[k] - m.rms[k]).toBeCloseTo(10 * Math.log10(2), 3)
      expect(m.hold[k]).toBeCloseTo(m.peak[k], 4)
    }
  })

  it('rises over 300 ms after the sound starts, and comes round the loop into its start', () => {
    // Silent for the first second, then a sine to the loop's end
    const m = meterFrames(steady(-20, 100))
    expect(m.rms[50]).toBe(-Infinity)
    expect(m.rms[100]).toBeCloseTo(-20 + 10 * Math.log10(1 / 30), 3)
    expect(m.rms[114]).toBeCloseTo(-20 + 10 * Math.log10(15 / 30), 3)
    expect(m.rms[129]).toBeCloseTo(-20, 3)
    // The loop's start still hears its end: 29 of the last 30 slices are the sine
    expect(m.rms[0]).toBeCloseTo(-20 + 10 * Math.log10(29 / 30), 3)
    expect(m.rms[29]).toBe(-Infinity)
  })
})

describe('the peak and its hold', () => {
  it('jumps to a click at once, then falls back 20 dB in 1.7 s', () => {
    const m = meterFrames(click(0, 200))
    expect(m.peak[200]).toBeCloseTo(0, 3)
    // Just before it: the click of the time round before, fallen for 9.99 s
    expect(m.peak[199]).toBeCloseTo(-PEAK_FALL_DB_PER_S * 9.99, 1)
    expect(m.peak[200 + 170]).toBeCloseTo(-20, 1)
    expect(m.peak[200 + 100] - m.peak[200 + 99]).toBeCloseTo(-PEAK_FALL_DB_PER_S * SLICE_S, 3)
  })

  it('the hold stays 3 s at the loudest peak, then falls back like the peak', () => {
    const m = meterFrames(click(0, 200))
    const held = Math.round(PEAK_HOLD_S / SLICE_S)
    expect(m.hold[200 + held]).toBeCloseTo(0, 3)
    expect(m.hold[200 + held + 100]).toBeCloseTo(-PEAK_FALL_DB_PER_S, 1)
    // Never under the peak
    for (let k = 0; k < N; k++) expect(m.hold[k] - m.peak[k]).toBeGreaterThan(-1e-4)
  })

  it('a peak at the loop’s end falls on into its start', () => {
    const m = meterFrames(click(-10, N - 10))
    expect(m.peak[0]).toBeCloseTo(-10 - 10 * PEAK_FALL_DB_PER_S * SLICE_S, 2)
    expect(m.hold[0]).toBeCloseTo(-10, 3)
  })

  it('a louder peak takes the hold over at once', () => {
    const a = click(-20, 100)
    const b = click(-6, 150)
    const both = { peak: a.peak.map((p, k) => Math.max(p, b.peak[k])), power: a.power.map((p, k) => p + b.power[k]) }
    const m = meterFrames(both)
    expect(m.hold[120]).toBeCloseTo(-20, 3)
    expect(m.hold[150]).toBeCloseTo(-6, 3)
  })
})

describe('on the Generator’s sounds', () => {
  it('a sine: the peak and the RMS almost touch; clicks: far apart on every beat', () => {
    const sine = meterFrames(sliced(generatorSound('sine', RATE).map((v) => v * ampOf(-10))))
    const clicks = meterFrames(sliced(generatorSound('click', RATE).map((v) => v * ampOf(-10))))
    const gaps = (m: ReturnType<typeof meterFrames>) =>
      Array.from(m.rms, (r, k) => m.peak[k] - r).filter((g) => isFinite(g))
    expect(Math.max(...gaps(sine))).toBeLessThan(3.1)
    // Right after each beep the peak sits well above the 300 ms average (the beep is short)
    expect(Math.max(...gaps(clicks))).toBeGreaterThan(14)
    // Between the beeps the RMS falls to silence while the peak is still falling back
    expect(Array.from(clicks.rms).some((r) => r === -Infinity)).toBe(true)
  })
})

describe('turning down', () => {
  it('what arrives against what leaves, the makeup gain back in; never below 0, silence 0', () => {
    const arriving = steady(-10).power
    const leaving  = steady(-12).power
    expect(reductionFrames(arriving, leaving)[500]).toBeCloseTo(2, 3)
    expect(reductionFrames(arriving, leaving, 4)[500]).toBeCloseTo(6, 3)
    // Louder out than in (its own hiss in a pause): 0
    expect(reductionFrames(leaving, arriving)[500]).toBe(0)
    expect(reductionFrames(new Float32Array(N), new Float32Array(N))[500]).toBe(0)
  })
})

describe('slices', () => {
  it('two sides as one: the louder of each slice', () => {
    const a = steady(-10, 0, 500)
    const b = steady(-20)
    const one = louderSlices(a, b)
    expect(dbOf(Math.sqrt(one.power[100]))).toBeCloseTo(-10, 3)
    expect(dbOf(Math.sqrt(one.power[700]))).toBeCloseTo(-20, 3)
    expect(louderSlices(a, undefined)).toBe(a)
  })

  it('recorded from the middle of the loop, turned round to start at its start', () => {
    const recorded = click(0, 0)
    // The first slice recorded was the loop's slice 750
    const turned = fromLoopStart(recorded, 750)
    expect(turned.peak[750]).toBe(recorded.peak[0])
    expect(turned.peak[0]).toBe(0)
    expect(fromLoopStart(recorded, N)).toBe(recorded)
  })
})
