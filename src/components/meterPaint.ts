import type { LiveStage, MeterReading } from '../signal/moving'
import { readingAt } from '../signal/moving'
import { ZONE_HEALTH, dbToPercent, zoneAt } from '../signal/levels'
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

/**
 * How often a moving number may change (ms): twice a second, slow enough for a learner to read it
 * (a DAW's change about 8 times a second; the bars still move 30 times a second).
 */
export const TEXT_EVERY_MS = 500

/** When each element's text was last written. */
const textWritten = new WeakMap<Element, number>()

/**
 * Sets an element's text (null: empties it). A new text is written at most every TEXT_EVERY_MS, so a
 * number following the sound stays readable; emptying it is never held back. True when it wrote a
 * new text (its colour may change with it).
 */
export function paintText(el: HTMLElement | null | undefined, text: string | null): boolean {
  if (!el) return false
  const now = performance.now()
  if (text === null) {
    if (el.textContent !== '') el.textContent = ''
    textWritten.delete(el)
    return false
  }
  if (el.textContent === text || now - (textWritten.get(el) ?? -Infinity) < TEXT_EVERY_MS) return false
  el.textContent = text
  textWritten.set(el, now)
  return true
}

/**
 * A number's colour (D17): the colour of where it sits on its meter's scale — blue at the noise,
 * green, yellow hot, red in the top 2 dB (signal/levels.ts zoneAt; the text shades, readable on the
 * card). In the cable's units; muted for silence.
 */
export function zoneTextColor(db: number, domain: SignalDomain, noise?: number): string {
  const zone = zoneAt(db, domain, noise)
  return zone ? `var(--signal-${ZONE_HEALTH[zone]}-text)` : 'var(--lsc-fg-muted)'
}

/**
 * The moving parts of a meter bar: its colours stay put (they belong to the scale — D16); two
 * covers slide over them — `pale` from the end of the bar down to the average (the peaks show pale
 * under it), `dark` down to the peak (nothing lit beyond) — and the peak hold's mark.
 */
export interface BarParts {
  pale: HTMLElement | null
  dark: HTMLElement | null
  hold: HTMLElement | null
}

/** A meter bar at a reading in `domain`, rising `up` or growing to the `right` (null: still). */
export function paintBar(parts: BarParts, up: boolean, r: MeterReading | null, domain: SignalDomain = 'analog') {
  if (!r) {
    paintStyle(parts.pale, 'transform', null)
    paintStyle(parts.dark, 'transform', null)
    paintStyle(parts.hold, 'transform', null)
    paintStyle(parts.hold, 'opacity', null)
    return
  }
  // Full-size parts slid along the bar (the track clips them): as index.css places the still ones —
  // a cover's near edge, and the mark, at share f of the bar
  const at = (f: number) => (up ? `translateY(${(-f * 100).toFixed(2)}%)` : `translateX(${(f * 100).toFixed(2)}%)`)
  const hold = alongScale(r.hold, domain)
  paintStyle(parts.pale, 'transform', at(alongScale(r.rms, domain)))
  paintStyle(parts.dark, 'transform', at(alongScale(r.peak, domain)))
  paintStyle(parts.hold, 'transform', at(hold))
  paintStyle(parts.hold, 'opacity', hold > 0 ? '1' : '0')
}
