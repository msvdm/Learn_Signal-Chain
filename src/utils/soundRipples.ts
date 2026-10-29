import type { Pt } from './geometry'

// Sound in the air (a Vocal, a Drum Kit, an Acoustic Guitar or a Guitar Amp into a microphone) goes
// straight through the air, not along a cable's route: ripples — pieces of circles round the
// source's port, aimed at the microphone — spread from it and travel to the microphone, with no
// line (the user's pick from three mock-ups, 2026-10-29). components/SoundWaves.tsx draws them.
// A ripple grows round the source up to REACH, then keeps that shape the rest of the way: on a long
// throw, circles still round the source would be huge and flat — a ladder of lines (tried, 2026-10-29).

/** A ripple's radius leaving the source (px at 100%) */
const RIPPLE_START = 4
/** It stops this short of the microphone's port (px at 100%) */
const RIPPLE_STOP = 4
/** It spans this much either side of the way to the microphone (degrees) … */
const SPREAD = 22
/** … and grows round the source up to this radius, then travels on at that size (px at 100%) */
const REACH = 70

/** The ripples from a source's port to a microphone's. */
export interface Ripples {
  /** The source's port */
  from: Pt
  /** The way to the microphone (radians: 0 right, π/2 down) */
  angle: number
  /** How far each spans either side of it (radians) */
  spread: number
  /** How far a ripple's front is from the source, leaving it and reaching the microphone */
  start: number
  end: number
  /** How far it grows round the source before it travels on at that size */
  reach: number
}

/** The ripples from `from` to `to`; `size` 1 at 100%, 2 zoomed out (the wires are thicker). */
export function ripplesBetween(from: Pt, to: Pt, size = 1): Ripples {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  const start    = RIPPLE_START * size
  return {
    from, angle: Math.atan2(to.y - from.y, to.x - from.x), spread: SPREAD * Math.PI / 180,
    start, end: Math.max(start, distance - RIPPLE_STOP * size), reach: REACH * size,
  }
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * One ripple whose front is `at` from the source: an SVG arc — round the source up to `reach`,
 * then the same arc moved on. The same commands everywhere, so an SVG animation can go from one
 * to another.
 */
export function rippleArc({ from, angle, spread, reach }: Ripples, at: number): string {
  const r  = Math.min(at, reach)
  const cx = from.x + (at - r) * Math.cos(angle)
  const cy = from.y + (at - r) * Math.sin(angle)
  const a  = angle - spread
  const b  = angle + spread
  return `M${round(cx + r * Math.cos(a))} ${round(cy + r * Math.sin(a))}`
    + `A${round(r)} ${round(r)} 0 0 1 ${round(cx + r * Math.cos(b))} ${round(cy + r * Math.sin(b))}`
}

/**
 * A ripple's way from the source to the microphone as an SVG animation's `values` and `keyTimes`:
 * growing to `reach`, then moving on (each part a straight step between two arcs, which is exact).
 */
export function rippleGrowth(ripples: Ripples): { values: string; keyTimes: string } {
  const { start, end, reach } = ripples
  if (end <= reach) return { values: `${rippleArc(ripples, start)};${rippleArc(ripples, end)}`, keyTimes: '0;1' }
  const grown = round((reach - start) / (end - start))
  return {
    values: [start, reach, end].map((at) => rippleArc(ripples, at)).join(';'),
    keyTimes: `0;${grown};1`,
  }
}
