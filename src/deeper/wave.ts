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

/** One sine of a recipe: how big it is, as a share of the fundamental's, and where it starts (radians) */
export interface Sine { size: number; phase: number }

/**
 * A recipe: its sines, the 1st (the fundamental) first. The n-th turns n times as fast, starting
 * `phase` ahead of the fundamental's start.
 */
export type Recipe = readonly Sine[]

/** A sawtooth's: every sine, the n-th 1/n as big, all starting together */
export const SAWTOOTH: Recipe = Array.from({ length: 10 }, (_, i) => ({ size: 1 / (i + 1), phase: 0 }))

/**
 * A real guitar's low E (82 Hz), measured from a recording (FreePats' electric guitar sampled
 * straight into an instrument input, CC0: `E2_s1_soft_03.flac`, a soft pluck, 48 kHz, 24-bit — the
 * string's own signal, with no body and no room over it). A quarter of a second from 60 ms after
 * the pluck, Hann-windowed, each harmonic's peak searched near its place. Rebuilt from these ten
 * (at their own, slightly sharp frequencies: the 10th at 10.08×) the recording's waveform is
 * within −29 dB — as close as the method comes on a note that is dying away. Its sizes: 0, −0.5,
 * −5.4, −18.5, −36.4, −31.7, −23.8, −22.3, −27.8, −32.9 dB — the first three nearly as one, which
 * is what makes the sum a shape and not a sine. The whole recipe is turned so the first sine
 * starts at 0, as the sawtooth's do (a later starting moment: the shape is the same).
 */
export const GUITAR_LOW_E: Recipe = [
  { size: 1,      phase: 0 },
  { size: 0.9475, phase: -0.03 },
  { size: 0.5367, phase: 0.01 },
  { size: 0.1186, phase: -0.32 },
  { size: 0.0151, phase: -3.06 },
  { size: 0.0261, phase: -0.58 },
  { size: 0.0645, phase: -0.61 },
  { size: 0.0764, phase: -0.93 },
  { size: 0.0409, phase: -0.95 },
  { size: 0.0226, phase: -1.54 },
]

/** The first `count` sines of a recipe added up, at phase `r` (radians). */
export function complexWave(r: number, recipe: Recipe, count = recipe.length): number {
  let sum = 0
  for (let n = 1; n <= count; n++) sum += recipe[n - 1].size * Math.sin(n * r + recipe[n - 1].phase)
  return sum
}

/**
 * The first `count` sines of a sawtooth added up. The more sines, the closer the sum comes to a
 * sawtooth, (π − r) / 2 — overshooting by about 9 % of its jump next to it (Gibbs).
 */
export function sawtooth(r: number, count: number): number {
  let sum = 0
  for (let n = 1; n <= count; n++) sum += Math.sin(n * r) / n
  return sum
}

/**
 * Circles on circles: the first `count` sines of a recipe as turning circles, each riding on the
 * tip of the one before (the n-th of radius `unit` × its size, turning n times as fast). Each
 * circle's centre and, last, the tip of the last one — from the first centre, y upward. The tip's
 * height is the sum: `unit` × `complexWave(r, recipe, count)`.
 */
export function circlesOnCircles(r: number, recipe: Recipe, count: number, unit: number): Dot[] {
  const points: Dot[] = [{ x: 0, y: 0 }]
  let x = 0, y = 0
  for (let n = 1; n <= count; n++) {
    const { size, phase } = recipe[n - 1]
    x += unit * size * Math.cos(n * r + phase)
    y += unit * size * Math.sin(n * r + phase)
    points.push({ x, y })
  }
  return points
}

/** The complex wave in the air: one cycle of it in a scene's units, and how far its particles swing */
export const AIR_WAVELENGTH = 320
export const AIR_SWING = 4
const AIR_K = TAU / AIR_WAVELENGTH

/**
 * Where a particle of air is, from where it rests, `distance` from the speaker cone, when the cone
 * moves in the first `count` sines of a recipe.
 */
export function complexSwing(r: number, distance: number, recipe: Recipe, count = recipe.length): number {
  return AIR_SWING * complexWave(r - AIR_K * distance, recipe, count)
}

/**
 * A string held at both ends, vibrating in its `n`-th harmonic alone: how far the point `along`
 * its length (0 … 1) is from rest, at phase `r`, for a sound in which that harmonic is `sine`. The n-th harmonic is n half-waves along the string (its ends and n − 1
 * points between them never move), n times as fast, and swings size / n as far: the push it gives
 * the bridge — the string's slope at that end — is then its size (Helmholtz: a sawtooth's 1/n, from
 * a string swinging 1/n²).
 */
export function harmonicSwing(r: number, along: number, n: number, sine: Sine): number {
  return (sine.size / n) * Math.sin(n * Math.PI * along) * Math.sin(n * r + sine.phase)
}

/** The string vibrating in the first `count` harmonics of a recipe at once: theirs added up, point by point. */
export function stringSwing(r: number, along: number, recipe: Recipe, count = recipe.length): number {
  let sum = 0
  for (let n = 1; n <= count; n++) sum += harmonicSwing(r, along, n, recipe[n - 1])
  return sum
}
