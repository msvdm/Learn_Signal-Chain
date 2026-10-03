/**
 * A mixing-desk fader's scale: not even in dB. The top of the travel gives fine control around
 * unity (0 dB, high up the travel), the bottom squeezes the quiet end together — like a real
 * console, where pulling a fader halfway down already takes about 20 dB off. The spacing follows
 * a real desk's fader print: 5 dB steps from +10 to −10, 10 dB steps below, closing up towards
 * the bottom.
 * Points along the travel (0 = bottom, 1 = top) with the dB there; straight lines in between.
 */
const POINTS: Array<[db: number, position: number]> = [
  [-100, 0],
  [-80,  0.06],
  [-60,  0.135],
  [-50,  0.215],
  [-40,  0.30],
  [-30,  0.41],
  [-20,  0.52],
  [-10,  0.655],
  [-5,   0.745],
  [0,    0.85],
  [5,    0.925],
  [10,   1],
]

export const FADER_MIN_DB = -100
export const FADER_MAX_DB = 10

/** Where a dB value sits along the travel (0 = bottom, 1 = top). */
export function faderPosition(db: number): number {
  if (db <= FADER_MIN_DB) return 0
  if (db >= FADER_MAX_DB) return 1
  for (let i = 1; i < POINTS.length; i++) {
    const [d1, p1] = POINTS[i]
    if (db <= d1) {
      const [d0, p0] = POINTS[i - 1]
      return p0 + ((db - d0) / (d1 - d0)) * (p1 - p0)
    }
  }
  return 1
}

/**
 * The dB value at a point along the travel, rounded to what that part of the scale can show:
 * 0.5 dB around unity, 1 dB in the middle, 2 dB at the quiet end.
 */
export function faderDbAt(position: number): number {
  const p = Math.max(0, Math.min(1, position))
  let db = FADER_MAX_DB
  for (let i = 1; i < POINTS.length; i++) {
    const [d1, p1] = POINTS[i]
    if (p <= p1) {
      const [d0, p0] = POINTS[i - 1]
      db = d0 + ((p - p0) / (p1 - p0)) * (d1 - d0)
      break
    }
  }
  const step = db >= -20 ? 0.5 : db >= -60 ? 1 : 2
  return Math.max(FADER_MIN_DB, Math.min(FADER_MAX_DB, Math.round(db / step) * step))
}

export interface FaderMark {
  db: number
  /** Numbered mark */
  label?: string
  /** A dot of the high-resolution zone around unity (one row per dB) instead of a tick */
  dot?: boolean
}

/**
 * Scale printed beside the fader, like a desk's: numbered marks, a dotted high-resolution zone
 * around unity (+5…−5 dB, where the fader moves in 0.5 dB steps) and short half-way ticks below.
 */
export const FADER_MARKS: FaderMark[] = (() => {
  const labelled = [10, 5, 0, -5, -10, -20, -30, -40, -50, -60, -80, -100]
  const marks = new Map<number, FaderMark>()
  for (const db of range(4, -4, 1)) marks.set(db, { db, dot: true })
  for (const db of [-15, -25, -35, -45, -55, -70, -90]) marks.set(db, { db })
  for (const db of labelled) marks.set(db, { db, label: db > 0 ? `+${db}` : db === 0 ? '0' : `−${-db}` })
  return [...marks.values()]
})()

function range(from: number, to: number, step: number): number[] {
  const out: number[] = []
  for (let v = from; v >= to; v -= step) out.push(v)
  return out
}
