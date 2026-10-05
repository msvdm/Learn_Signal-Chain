import type { StageResult, WireSignal } from './engine'
import type { SignalDomain } from './levels'
import { SILENCE_DB, crestOf, headroomOf, hissOf, louder } from './levels'

// What a beginner reads under a card (from Intermediate up): the signal leaving it, each number
// with what it means — how far its peaks sit above its average, how much room is left before they
// clip, how far the hiss sits under it. Card by card along a chain they show where the gain was
// made well or badly. Whole dB: the verdict is taken from the number shown, so the two always agree.

/** Room before clipping at or under this (dB): a louder moment could clip — careful. */
export const CAREFUL_ROOM_DB = 6
/** Hiss less than this far under the signal (dB) can be heard in the quiet moments. */
export const AUDIBLE_HISS_DB = 45
/** Hiss less than this far under the signal (dB) is nearly as loud as the music. */
export const LOUD_HISS_DB = 20

export type RoomVerdict = 'fine' | 'careful' | 'clipping'
export type HissVerdict = 'clean' | 'audible' | 'loud'

export interface Readings {
  /** How far the peaks sit above the average (dB) */
  peaksAbove: number
  /** How far the peaks sit under the clip level / the digital ceiling (dB): 0 only when they reach it */
  room: number
  roomVerdict: RoomVerdict
  /** How far the hiss sits under the average (dB, never below 0); Infinity: no hiss at all */
  hissBelow: number
  hissVerdict: HissVerdict
}

/**
 * The readings of a signal judged in `domain`, its louder side reading by reading (for a stereo
 * signal: the side nearer clipping, the side with more hiss). Null: silence (−∞ on the meters).
 */
export function readingsOf(w: WireSignal, domain: SignalDomain = 'analog'): Readings | null {
  const s = louder(w.l, w.r)
  if (!(s.rms > SILENCE_DB)) return null

  const headroom = headroomOf(s, domain)
  // Not clipping yet shows at least 1 dB: "0 dB" is kept for peaks at the clip level
  const room     = headroom <= 0 ? 0 : Math.max(1, Math.round(headroom))
  const hiss     = hissOf(s)
  const hissBelow = isFinite(hiss) ? Math.max(0, Math.round(s.rms - hiss)) : Infinity

  return {
    peaksAbove: Math.max(0, Math.round(crestOf(s))),
    room,
    roomVerdict: room === 0 ? 'clipping' : room <= CAREFUL_ROOM_DB ? 'careful' : 'fine',
    hissBelow,
    hissVerdict: hissBelow < LOUD_HISS_DB ? 'loud' : hissBelow < AUDIBLE_HISS_DB ? 'audible' : 'clean',
  }
}

/** Can its hiss be heard (in the quiet moments)? Never for silence. */
export function hissAudible(w: WireSignal): boolean {
  const r = readingsOf(w)
  return r !== null && r.hissVerdict !== 'clean'
}

/**
 * The hiss becomes audible at this card: what arrives is clean (or nothing arrives), what leaves
 * is not — the card whose own hiss landed on a signal too weak for it, or a compressor that
 * brought it up. Cards after it carry the hiss on; a noise gate may take it away again.
 */
export function hissStartsAt(stage: StageResult): boolean {
  return hissAudible(stage.out) && !hissAudible(stage.in)
}
