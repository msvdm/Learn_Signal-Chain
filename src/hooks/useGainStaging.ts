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
    color: '#3b82f6',
    bg: '#eff6ff',
    border: '#bfdbfe',
    label: 'Too Quiet',
    textClass: 'text-blue-600',
  },
  good: {
    color: '#22c55e',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    label: 'Good',
    textClass: 'text-green-600',
  },
  hot: {
    color: '#eab308',
    bg: '#fefce8',
    border: '#fef08a',
    label: 'Hot',
    textClass: 'text-yellow-600',
  },
  clipping: {
    color: '#ef4444',
    bg: '#fef2f2',
    border: '#fecaca',
    label: 'Clipping!',
    textClass: 'text-red-600',
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
