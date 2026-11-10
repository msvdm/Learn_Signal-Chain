// Dive deeper's maths (D46), pure: the wave the air's particles ride, a graph over one cycle, and
// where the camera stands to show the steps reached so far. The scenes (deeper/scenes/) draw with
// these; nothing here knows React or the DOM.

export const TAU = 2 * Math.PI

export const rad = (deg: number) => (deg * Math.PI) / 180

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** One cycle of the sound wave, in a scene's units */
export const WAVELENGTH = 200
/** How far a particle of air swings either side of where it rests */
export const SWING = 14
/** The wave's phase per unit of distance */
export const K = TAU / WAVELENGTH

/**
 * Where a particle of air is, measured from where it rests: `distance` from what moves the air,
 * at phase `r` (radians). Each particle only swings in place; the wave is their delay with distance.
 */
export function swing(r: number, distance: number): number {
  return SWING * Math.sin(r - K * distance)
}

export interface Rect { x: number; y: number; w: number; h: number }
export interface Dot { x: number; y: number }

/**
 * `count` points scattered over a rectangle — the same ones every time (a seeded generator,
 * Lehmer's), so the air looks the same on every visit and in every picture of it.
 */
export function scatter(seed: number, count: number, { x, y, w, h }: Rect): Dot[] {
  let s = seed
  const next = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  return Array.from({ length: count }, () => ({ x: x + next() * w, y: y + next() * h }))
}

/** A graph over one cycle as an SVG path, drawn from 0° up to `to` degrees (a point every 2°). */
export function curvePath(to: number, x: (deg: number) => number, y: (deg: number) => number): string {
  const at = (d: number) => `${x(d).toFixed(1)} ${y(d).toFixed(1)}`
  let path = `M${at(0)}`
  for (let d = 2; d <= to; d += 2) path += ` L${at(d)}`
  if (to % 2) path += ` L${at(to)}`
  return path
}

/** A part of a scene, in its units: left, top, right, bottom */
export type Box = readonly [x0: number, y0: number, x1: number, y1: number]

export interface Camera { x: number; y: number; scale: number }

const MARGIN    = 30
const MAX_SCALE = 2

/**
 * The camera showing all of `boxes` in a stage `width` × `height` pixels: as large as fits with a
 * margin (never more than twice life size — one small part alone would fill the screen), centred.
 */
export function cameraFor(boxes: readonly Box[], width: number, height: number): Camera {
  const x0 = Math.min(...boxes.map((b) => b[0]))
  const y0 = Math.min(...boxes.map((b) => b[1]))
  const x1 = Math.max(...boxes.map((b) => b[2]))
  const y1 = Math.max(...boxes.map((b) => b[3]))
  const scale = Math.min(width / (x1 - x0 + 2 * MARGIN), height / (y1 - y0 + 2 * MARGIN), MAX_SCALE)
  return {
    x: width / 2 - (scale * (x0 + x1)) / 2,
    y: height / 2 - (scale * (y0 + y1)) / 2,
    scale,
  }
}

/** A phase kept within one cycle: 360° is a place of its own (the end of the cycle), 361° is 1°. */
export function wrapPhase(deg: number): number {
  return deg > 360 ? deg % 360 : Math.max(0, deg)
}

// ── Complex waves: sines added up ───────────────────────────────────────────

/**
 * The first `count` sines of a sawtooth added up, at phase `r` (radians): the n-th turns n times
 * as fast and is 1/n as big. One sine is the fundamental; the more sines, the closer the sum comes
 * to a sawtooth, (π − r) / 2 — overshooting by about 9 % of its jump next to it (Gibbs).
 */
export function sawtooth(r: number, count: number): number {
  let sum = 0
  for (let n = 1; n <= count; n++) sum += Math.sin(n * r) / n
  return sum
}

/**
 * Whether the first two sines add up at phase `r` (both up or both down: constructive) rather than
 * partly cancelling (one up, the other down: destructive).
 */
export function addsUp(r: number): boolean {
  return Math.sin(r) * Math.sin(2 * r) >= 0
}

/**
 * Circles on circles: the first `count` sines of a sawtooth as turning circles, each riding on the
 * tip of the one before (the n-th of radius `unit` / n, turning n times as fast). Each circle's
 * centre and, last, the tip of the last one — from the first centre, y upward. The tip's height is
 * the sum: `unit` × `sawtooth(r, count)`.
 */
export function circlesOnCircles(r: number, count: number, unit: number): Dot[] {
  const points: Dot[] = [{ x: 0, y: 0 }]
  let x = 0, y = 0
  for (let n = 1; n <= count; n++) {
    x += (unit / n) * Math.cos(n * r)
    y += (unit / n) * Math.sin(n * r)
    points.push({ x, y })
  }
  return points
}

/** The complex wave in the air: one cycle of it in a scene's units, and how far its particles swing */
export const AIR_WAVELENGTH = 600
export const AIR_SWING = 8
const AIR_K = TAU / AIR_WAVELENGTH

/**
 * Where a particle of air is, from where it rests, `distance` from the speaker cone, when the cone
 * moves in the first `count` sines of a sawtooth.
 */
export function complexSwing(r: number, distance: number, count: number): number {
  return AIR_SWING * sawtooth(r - AIR_K * distance, count)
}
