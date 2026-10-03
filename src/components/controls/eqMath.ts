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

// ── Graphic EQ: 31 bands, a third of an octave apart (the standard ISO centres) ──
export const GEQ_CENTERS = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
  1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000,
]
/** Boost / cut range of each band (±dB) */
export const GEQ_RANGE = 12
/** Q of a one-third-octave band */
export const GEQ_Q = 4.32

/** Short label printed under a slider, like on the hardware: "31.5", "800", "1k25", "16k". */
export function geqShortLabel(hz: number): string {
  if (hz < 1000) return String(hz)
  const k = String(hz / 1000)
  return k.includes('.') ? k.replace('.', 'k') : `${k}k`
}

/** Full frequency for the readout: "31.5 Hz", "1.25 kHz". */
export function geqLongLabel(hz: number): string {
  return hz < 1000 ? `${hz} Hz` : `${hz / 1000} kHz`
}
