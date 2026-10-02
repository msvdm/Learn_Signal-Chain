import type { EQBand } from '../../data/nodeRegistry'

export const FREQ_MIN = 20
export const FREQ_MAX = 20000
/** Boost / cut range of one band, in dB. */
export const DB_MIN = -12
export const DB_MAX = 12
/** Width (Q) range of a bell band. */
export const Q_MIN = 0.3
export const Q_MAX = 10

export const BAND_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444']

export function bellGain(freq: number, centerHz: number, gainDb: number, Q = 1.4): number {
  if (gainDb === 0) return 0
  const logDist = Math.log2(freq / centerHz)
  return gainDb * Math.exp(-(logDist * logDist) / (2 * (1 / Q) * (1 / Q)))
}

export function shelfGain(freq: number, cornerHz: number, gainDb: number, type: 'high-shelf' | 'low-shelf'): number {
  if (gainDb === 0) return 0
  const octaves = Math.log2(freq / cornerHz)
  const normalized = Math.tanh(octaves * 1.5) * 0.5 + 0.5
  return type === 'high-shelf' ? gainDb * normalized : gainDb * (1 - normalized)
}

export function isShelf(band: EQBand): boolean {
  return band.type === 'high-shelf' || band.type === 'low-shelf'
}

/** How much one band boosts (+) or cuts (−) a frequency, in dB. */
export function bandGain(freq: number, band: EQBand): number {
  return band.type === 'high-shelf' || band.type === 'low-shelf'
    ? shelfGain(freq, band.freqHz, band.gainDb, band.type)
    : bellGain(freq, band.freqHz, band.gainDb, band.Q ?? 1.4)
}

/** "200 Hz", "1.2 kHz" */
export function formatFreq(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`
}

/** "+4.5 dB", "0.0 dB", "−6.0 dB" — always one decimal so the text keeps its width */
export function formatGain(db: number): string {
  if (db === 0) return '0.0 dB'
  return `${db > 0 ? '+' : '−'}${Math.abs(db).toFixed(1)} dB`
}
