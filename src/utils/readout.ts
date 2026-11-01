import { formatDb, formatSpl, taperToDb } from '../signal/levels'
import type { SignalDomain } from '../signal/levels'

/** Readout of an audio-taper knob (0 = off, 75 = 0 dB, 100 = +10 dB). */
export function formatTaperDb(position: number): string {
  const db = taperToDb(position)
  if (!isFinite(db)) return '−∞'
  if (Math.abs(db) < 0.05) return '0 dB'
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`
}

/** Widest possible signal level reading, e.g. "−140.0" (mono font: every digit is the same width). */
export const LEVEL_SAMPLE = '−000.0'

/**
 * The longest text `format` gives for the values a control can take (min → max on its step,
 * sampled at most 120 times). Readouts use a mono font, so the longest text is the widest.
 */
export function widestFormat(min: number, max: number, step: number, format: (v: number) => string): string {
  const count = Math.min(120, Math.max(1, Math.round((max - min) / step)))
  let widest = ''
  for (let i = 0; i <= count; i++) {
    const v    = Math.round((min + ((max - min) * i) / count) / step) * step
    const text = format(parseFloat(v.toFixed(10)))
    if (text.length > widest.length) widest = text
  }
  return widest
}

/** A level as the meters print it (formatDb, or formatSpl with an `spl`): its number and its unit. */
export function levelParts(db: number, domain: SignalDomain, spl?: number): [string, string] {
  const text = spl === undefined ? formatDb(db, domain) : formatSpl(db, spl)
  const at   = text.indexOf(' ')
  return [text.slice(0, at), text.slice(at + 1)]
}
