import type { SignalHealth } from './useSignalChain'

export interface HealthStyle {
  color: string
  bg: string
  border: string
  label: string
  textClass: string
}

const HEALTH_STYLES: Record<SignalHealth, HealthStyle> = {
  'too-quiet': {
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.1)',
    border: 'rgba(96,165,250,0.25)',
    label: 'Too Quiet',
    textClass: 'text-blue-400',
  },
  good: {
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.1)',
    border: 'rgba(74,222,128,0.25)',
    label: 'Good',
    textClass: 'text-green-400',
  },
  hot: {
    color: '#facc15',
    bg: 'rgba(250,204,21,0.1)',
    border: 'rgba(250,204,21,0.25)',
    label: 'Hot',
    textClass: 'text-yellow-400',
  },
  clipping: {
    color: '#f87171',
    bg: 'rgba(248,113,113,0.1)',
    border: 'rgba(248,113,113,0.25)',
    label: 'Clipping!',
    textClass: 'text-red-400',
  },
}

export function getHealthStyle(health: SignalHealth): HealthStyle {
  return HEALTH_STYLES[health]
}

export function dbToPercent(db: number): number {
  // Map -60..+20 to 0..100
  return Math.max(0, Math.min(100, ((db + 60) / 80) * 100))
}

export function formatDb(db: number): string {
  if (db <= -60) return '-∞ dBu'
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dBu`
}
