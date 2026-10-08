import type { MeterFrames } from '../signal/moving'
import type { ChannelSlices } from './processors'
import { dbOf } from './processors'

// How a meter moves, worked out the way the meters of DAWs (Pro Tools, Logic, Reaper, Ableton Live)
// and the broadcast standards move, from what a render recorded over one loop, slice by slice
// (audio/processors.ts Meter). Three readings in one meter, as Live and Logic draw them:
// - RMS (the solid bar): the average power over the last 300 ms — a VU meter's integration time,
//   and the RMS window of DAWs. A plain RMS — a sine reads 3 dB under its peaks, as the cards'
//   readings say ("Peaks 3 dB above the average") — not the AES17 one of K-meters (+3 dB: a sine
//   reading its peak).
// - Peak (the light bar): the loudest sample, at once; then it falls back 20 dB in 1.7 s, the
//   return time of a digital peak meter (IEC 60268-18, EBU).
// - Peak hold (the mark): the loudest peak stays 3 s (Pro Tools' hold; Logic's 2 – 6 s, the EBU's
//   3 s), then falls back like the peak.
// The noise floor (the blue part of a bar — D17) is the still reading of the music stopped: it does not move.
// The loop repeats — every sound in it is one loop long (audio/sounds.ts LOOP_S) — so its end runs
// into its start: the meters are worked out twice round it and the second time kept. Pure.

/** A slice: the meters' finest step (s). */
export const SLICE_S = 0.01
/** RMS: the average power over this long (s) */
export const RMS_WINDOW_S = 0.3
/** Peak: how fast it falls back after a peak (dB a second: 20 dB in 1.7 s) */
export const PEAK_FALL_DB_PER_S = 20 / 1.7
/** Peak hold: how long the loudest peak stays (s) */
export const PEAK_HOLD_S = 3
/**
 * Turning down: what arrives against what leaves over this long (s) — the gain of the moment,
 * smoothed only enough that the hiss in the pauses does not flicker it.
 */
export const REDUCTION_WINDOW_S = 0.03

/** How many slices a stretch of `s` seconds holds (at least one). */
const slicesIn = (s: number, sliceS: number) => Math.max(1, Math.round(s / sliceS))

/** The power of `power` over the window of `w` slices ending at each slice, round the loop. */
function windowed(power: Float32Array, w: number): Float64Array {
  const n = power.length
  const out = new Float64Array(n)
  let sum = 0
  // The slices before the first, from the loop's end
  for (let j = 1; j < w; j++) sum += power[((-j % n) + n) % n]
  for (let k = 0; k < n; k++) {
    sum += power[k]
    out[k] = Math.max(0, sum) / w
    sum -= power[(((k - w + 1) % n) + n) % n]
  }
  return out
}

/** A meter's movement over one loop of `slices` (its first slice the loop's start). */
export function meterFrames(slices: ChannelSlices, sliceS = SLICE_S): MeterFrames {
  const n    = slices.peak.length
  const rms  = new Float32Array(n)
  const peak = new Float32Array(n)
  const hold = new Float32Array(n)

  const power = windowed(slices.power, slicesIn(RMS_WINDOW_S, sliceS))
  for (let k = 0; k < n; k++) rms[k] = dbOf(Math.sqrt(power[k]))

  // The peak and the hold remember: round the loop once to start where its end leaves them
  const fall  = Math.pow(10, -PEAK_FALL_DB_PER_S * sliceS / 20)
  const holdN = slicesIn(PEAK_HOLD_S, sliceS)
  let falling = 0
  let held = 0
  let age = 0
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < n; k++) {
      falling = Math.max(slices.peak[k], falling * fall)
      if (falling >= held) {
        held = falling
        age = 0
      } else if (++age > holdN) {
        held = Math.max(falling, held * fall)
      }
      if (pass === 1) {
        peak[k] = dbOf(falling)
        hold[k] = dbOf(held)
      }
    }
  }
  return { rms, peak, hold }
}

/** Two channels as one: the louder of them, slice by slice (a stereo dynamics card hears its louder side). */
export function louderSlices(a: ChannelSlices, b: ChannelSlices | undefined): ChannelSlices {
  if (!b || b === a) return a
  return {
    peak:  a.peak.map((p, k) => Math.max(p, b.peak[k])),
    power: a.power.map((p, k) => Math.max(p, b.power[k])),
  }
}

/**
 * How far a dynamics card turns its signal down, slice by slice (dB, never below 0): what arrives
 * against what leaves over REDUCTION_WINDOW_S, its makeup gain back in. Silence: 0.
 */
export function reductionFrames(arriving: Float32Array, leaving: Float32Array, makeupDb = 0, sliceS = SLICE_S): Float32Array {
  const w   = slicesIn(REDUCTION_WINDOW_S, sliceS)
  const inP = windowed(arriving, w)
  const out = windowed(leaving, w)
  return Float32Array.from(inP, (p, k) =>
    p > 0 && out[k] > 0 ? Math.max(0, 10 * Math.log10(p / out[k]) + makeupDb) : 0)
}

/** Slices recorded from slice `first` of the loop, turned round to start at the loop's start. */
export function fromLoopStart(slices: ChannelSlices, first: number): ChannelSlices {
  const n = slices.peak.length
  const by = ((first % n) + n) % n
  if (by === 0) return slices
  const turn = (x: Float32Array) => {
    const out = new Float32Array(n)
    for (let k = 0; k < n; k++) out[(k + by) % n] = x[k]
    return out
  }
  return { peak: turn(slices.peak), power: turn(slices.power) }
}
