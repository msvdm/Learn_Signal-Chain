import type { SideLevels } from './levels'
import type { WireSignal } from './chain'
import { louderSide } from './chain'
import type { StageResult } from './engine'
import type { MeasuredStage } from './measured'

// How the signal moves (decision D10): the render on real sound (audio/measure.ts) records one loop of
// the chain slice by slice, and works out how a DAW's meters would move over it (audio/meters.ts).
// Every sound is one loop long, so the loop is everything the chain plays: the meters play it back
// in time with the clock, round and round (hooks/useLiveMeter.ts). Between a change and the
// next render the movement is moved by the number engine's step, as the still readings are
// (signal/measured.ts, decision D9): a fader moves the meters at once. Pure — no React, no store.

/** One meter's movement over a loop, slice by slice (dB readings; −∞: silent), its first slice the loop's start. */
export interface MeterFrames {
  /** RMS: the average power over the last 300 ms */
  rms: Float32Array
  /** Peak: the loudest sample at once, then falling back 20 dB in 1.7 s */
  peak: Float32Array
  /** Peak hold: the loudest peak, held 3 s, then falling back like the peak */
  hold: Float32Array
}

/** A signal's movement: each side (one channel: r is l). */
export interface MovingSignal {
  l: MeterFrames
  r: MeterFrames
}

/** How one card's signal moves over a loop of the render. */
export interface MovingStage {
  in?: MovingSignal
  out?: MovingSignal
  /** A dynamics card at work: how far it turns its signal down, slice by slice (dB, its makeup left out) */
  reduction?: Float32Array
  /** A dynamics card at work: what goes into its curve and what leaves it, the louder side (its marks) */
  curveIn?: MeterFrames
  curveOut?: MeterFrames
}

/** What a meter shows at one moment (dB readings). */
export interface MeterReading {
  rms: number
  peak: number
  hold: number
}

/** How far a meter's movement is moved: what the card shows now, less what the render measured (dB). */
export interface Shift {
  rms: number
  peak: number
}

/** A meter's movement with its shift. */
export interface LiveMeter {
  frames: MeterFrames
  shift: Shift
}

/** A signal's meters: each side (one channel: r is l). */
export interface LiveSignal {
  l: LiveMeter
  r: LiveMeter
}

/** Everything about one card that moves, ready to be played back. */
export interface LiveStage {
  in?: LiveSignal
  out?: LiveSignal
  /** Turning down (a dynamics card at work) */
  reduction?: { frames: Float32Array; shift: number }
  /** The marks on a dynamics card's curve: what goes in (left to right), what leaves (bottom to top) */
  curve?: { in: LiveMeter; out: LiveMeter }
}

/**
 * How far to move a meter's movement: what is shown less what was measured — the number engine's
 * step since the render (signal/measured.ts). null where it cannot be moved: one of them silent
 * and the other not (there is nothing to move from).
 */
export function shiftOf(shown: SideLevels, measured: SideLevels): Shift | null {
  const by = (now: number, then: number) =>
    isFinite(now) && isFinite(then) ? now - then : now === then ? 0 : null
  const rms  = by(shown.rms, measured.rms)
  const peak = by(shown.peak, measured.peak)
  return rms === null || peak === null ? null : { rms, peak }
}

/** A signal's meters, moved; null where it changed kind since the render (its sides are not the same). */
function liveSignal(shown: WireSignal, measured: WireSignal, moving: MovingSignal | undefined): LiveSignal | undefined {
  if (!moving || shown.kind !== measured.kind) return undefined
  const l = shiftOf(shown.l, measured.l)
  const r = shiftOf(shown.r, measured.r)
  if (!l || !r) return undefined
  return { l: { frames: moving.l, shift: l }, r: { frames: moving.r, shift: r } }
}

/**
 * One card's movement, ready to play: the render's frames with the shift that takes them to what
 * the card shows now (`shown`: graphSignal's stage, the render's readings moved on). Undefined
 * parts stay still.
 */
export function liveStageOf(shown: StageResult, measured: MeasuredStage, moving: MovingStage): LiveStage {
  const live: LiveStage = {}
  const inSig  = liveSignal(shown.in, measured.in, moving.in)
  const outSig = liveSignal(shown.out, measured.out, moving.out)
  if (inSig) live.in = inSig
  if (outSig) live.out = outSig
  if (moving.reduction && shown.gainReductionDb !== undefined && measured.gainReductionDb !== undefined) {
    live.reduction = { frames: moving.reduction, shift: shown.gainReductionDb - measured.gainReductionDb }
  }
  // The marks on a dynamics card's curve: its louder sides in and out — while it is at work (its
  // turning down; bypassed since the render: still)
  if (moving.curveIn && moving.curveOut && shown.gainReductionDb !== undefined) {
    const shiftIn  = shiftOf(louderSide(shown.in), louderSide(measured.in))
    const shiftOut = shiftOf(louderSide(shown.out), louderSide(measured.out))
    if (shiftIn && shiftOut) live.curve = { in: { frames: moving.curveIn, shift: shiftIn }, out: { frames: moving.curveOut, shift: shiftOut } }
  }
  return live
}

/** What a meter shows at slice `i`: its frames there, moved by its shift (the hold never under the peak). */
export function readingAt({ frames, shift }: LiveMeter, i: number): MeterReading {
  const rms  = frames.rms[i] + shift.rms
  const peak = frames.peak[i] + shift.peak
  return { rms, peak, hold: Math.max(peak, frames.hold[i] + shift.peak) }
}
