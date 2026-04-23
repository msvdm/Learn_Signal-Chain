import type { EQBand } from '../../store/signalStore'

export const SVG_W = 560
export const SVG_H = 200
export const FREQ_MIN = 20
export const FREQ_MAX = 20000
export const DB_MIN = -12
export const DB_MAX = 12

export const BAND_COLORS = ['#6366f1', '#f59e0b', '#10b981']

export const FREQ_LABELS = [
  { freq: 50, label: '50' },
  { freq: 100, label: '100' },
  { freq: 200, label: '200' },
  { freq: 500, label: '500' },
  { freq: 1000, label: '1k' },
  { freq: 2000, label: '2k' },
  { freq: 5000, label: '5k' },
  { freq: 10000, label: '10k' },
  { freq: 20000, label: '20k' },
]

export const DB_LABELS = [12, 6, 0, -6, -12]

export function freqToX(freq: number): number {
  return ((Math.log10(freq) - Math.log10(FREQ_MIN)) / (Math.log10(FREQ_MAX) - Math.log10(FREQ_MIN))) * SVG_W
}

export function xToFreq(x: number): number {
  const t = Math.max(0, Math.min(1, x / SVG_W))
  return Math.pow(10, t * (Math.log10(FREQ_MAX) - Math.log10(FREQ_MIN)) + Math.log10(FREQ_MIN))
}

export function dbToY(db: number): number {
  return ((DB_MAX - db) / (DB_MAX - DB_MIN)) * SVG_H
}

export function yToDb(y: number): number {
  return DB_MAX - (y / SVG_H) * (DB_MAX - DB_MIN)
}

export function bellGain(freq: number, centerHz: number, gainDb: number, Q = 1.4): number {
  if (gainDb === 0) return 0
  const logDist = Math.log2(freq / centerHz)
  return gainDb * Math.exp(-(logDist * logDist) / (2 * (1 / Q) * (1 / Q)))
}

export function buildCurvePath(bands: EQBand[], hpfHz: number): string {
  const points: [number, number][] = []
  const SAMPLES = 200

  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const freq = Math.pow(10, t * (Math.log10(FREQ_MAX) - Math.log10(FREQ_MIN)) + Math.log10(FREQ_MIN))

    let totalGain = bands.reduce((acc, b) => acc + bellGain(freq, b.freqHz, b.gainDb), 0)

    if (freq < hpfHz) {
      const octavesBelow = Math.log2(hpfHz / freq)
      totalGain -= Math.min(12, octavesBelow * 6)
    }

    const x = freqToX(freq)
    const y = dbToY(Math.max(DB_MIN, Math.min(DB_MAX, totalGain)))
    points.push([x, y])
  }

  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
}
