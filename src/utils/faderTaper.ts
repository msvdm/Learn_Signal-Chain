import { FADER_OFF_DB } from '../signal/process'

/**
 * A mixing-desk fader's scale: not even in dB. The top of the travel gives fine control around
 * unity (0 dB, high up the travel), the bottom squeezes the quiet end together — like a real
 * console, where pulling a fader halfway down already takes about 20 dB off. The spacing follows
 * a real desk's fader print: 5 dB steps from +10 to −10, 10 dB steps below, closing up towards
 * the bottom, which is −∞ — the signal muted (FADER_OFF_DB), like the bottom of a meter.
 * Points along the travel (0 = bottom, 1 = top) with the dB there; straight lines in between.
 */
const POINTS: Array<[db: number, position: number]> = [
  [FADER_OFF_DB, 0],
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

export const FADER_MIN_DB = FADER_OFF_DB
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
  /** Short tick on each side of the track */
  tick?: boolean
  /** A row of the dotted high-resolution zone around unity, beside the cap */
  dot?: boolean
}

/**
 * Scale printed beside the fader, like a desk's: numbered marks down to −60 and −∞ at the bottom
 * (a meter's numbers), half-way ticks below −10, and a dotted high-resolution zone around unity
 * (+5…−5 dB): one dot row per 0.5 dB, the step the fader moves in there. The dots sit beside the
 * cap, so they stay visible wherever the cap is.
 */
export const FADER_MARKS: FaderMark[] = (() => {
  const labelled = [10, 5, 0, -5, -10, -20, -30, -40, -50, -60]
  const marks = new Map<number, FaderMark>()
  const put = (db: number, patch: Omit<FaderMark, 'db'>) => marks.set(db, { ...(marks.get(db) ?? { db }), ...patch })
  for (const db of range(5, -5, 0.5)) put(db, { dot: true })
  for (const db of [-15, -25, -35, -45, -55]) put(db, { tick: true })
  for (const db of labelled) put(db, { tick: true, label: db > 0 ? `+${db}` : db === 0 ? '0' : `−${-db}` })
  put(FADER_OFF_DB, { tick: true, label: '−∞' })
  return [...marks.values()]
})()

function range(from: number, to: number, step: number): number[] {
  const out: number[] = []
  for (let v = from; v >= to; v -= step) out.push(v)
  return out
}
