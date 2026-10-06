import type { LiveStage, MeterReading } from '../signal/moving'
import { readingAt } from '../signal/moving'
import { dbToPercent } from '../signal/levels'
import type { SignalDomain } from '../signal/levels'

// Writing the moving values into the meters (hooks/useLiveMeter.ts calls the painters 30 times a
// second). React draws the still picture: each moving part sits where its CSS puts it from the
// still readings (index.css: `var(--rms)` …). A painter writes the moving part's own `transform`
// over it — on that one element, so nothing else is styled again — and only when it moved by a
// visible step; removing it puts the still picture back (with its transition).

/** Which of a card's signals a meter shows. */
export type MeterAt = 'in' | 'out'
/** Which side: one of them, or the louder of the two (one bar for a whole stereo signal). */
export type MeterSide = 'l' | 'r' | 'louder'

/** Where a meter's movement comes from. */
export interface MeterSource {
  nodeId: string
  at: MeterAt
  side: MeterSide
}

/** What a meter shows at slice `i` of its card's movement (null: it does not move — the still picture). */
export function readingOf(live: LiveStage | undefined, at: MeterAt, side: MeterSide, i: number | null): MeterReading | null {
  const signal = live?.[at]
  if (!signal || i === null) return null
  if (side !== 'louder') return readingAt(signal[side], i)
  const l = readingAt(signal.l, i)
  const r = readingAt(signal.r, i)
  return { rms: Math.max(l.rms, r.rms), peak: Math.max(l.peak, r.peak), hold: Math.max(l.hold, r.hold) }
}

/** A level as a share of the meter's scale (0 … 1, the top its domain's ceiling), in steps of a quarter of a percent (finer is not seen). */
export const alongScale = (db: number, domain: SignalDomain = 'analog') => Math.round(dbToPercent(db, domain) * 4) / 400

/** What each element was last given, by property, so an unchanged value is not written again. */
const written = new WeakMap<Element, Partial<Record<string, string>>>()

/** Sets one style property of one element (null: removes it — its CSS takes over). Writes only a change. */
export function paintStyle(el: HTMLElement | SVGElement | null | undefined, prop: string, value: string | null) {
  if (!el) return
  let last = written.get(el)
  if (!last) written.set(el, (last = {}))
  const key = value ?? ''
  if ((last[prop] ?? '') === key) return
  last[prop] = key
  if (value === null) el.style.removeProperty(prop)
  else el.style.setProperty(prop, value)
}

/** The moving parts of a meter bar. */
export interface BarParts {
  rms: HTMLElement | null
  peak: HTMLElement | null
  hold: HTMLElement | null
}

/** A meter bar at a reading in `domain`, rising `up` or growing to the `right` (null: still). */
export function paintBar(parts: BarParts, up: boolean, r: MeterReading | null, domain: SignalDomain = 'analog') {
  if (!r) {
    paintStyle(parts.rms, 'transform', null)
    paintStyle(parts.peak, 'transform', null)
    paintStyle(parts.hold, 'transform', null)
    paintStyle(parts.hold, 'opacity', null)
    return
  }
  // Full-size parts slid along the bar (the track clips them): as index.css places the still ones
  const fill = (f: number) => (up ? `translateY(${((1 - f) * 100).toFixed(2)}%)` : `translateX(${((f - 1) * 100).toFixed(2)}%)`)
  const hold = alongScale(r.hold, domain)
  paintStyle(parts.rms, 'transform', fill(alongScale(r.rms, domain)))
  paintStyle(parts.peak, 'transform', fill(alongScale(r.peak, domain)))
  paintStyle(parts.hold, 'transform', up ? `translateY(${(-hold * 100).toFixed(2)}%)` : `translateX(${(hold * 100).toFixed(2)}%)`)
  paintStyle(parts.hold, 'opacity', hold > 0 ? '1' : '0')
}
