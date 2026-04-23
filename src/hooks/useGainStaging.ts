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
    color: 'var(--signal-too-quiet)',
    bg: 'var(--signal-too-quiet-bg)',
    border: 'var(--signal-too-quiet-border)',
    label: 'Too Quiet',
    textClass: 'text-blue-400',
  },
  good: {
    color: 'var(--signal-good)',
    bg: 'var(--signal-good-bg)',
    border: 'var(--signal-good-border)',
    label: 'Good',
    textClass: 'text-green-400',
  },
  hot: {
    color: 'var(--signal-hot)',
    bg: 'var(--signal-hot-bg)',
    border: 'var(--signal-hot-border)',
    label: 'Hot',
    textClass: 'text-yellow-400',
  },
  clipping: {
    color: 'var(--signal-clipping)',
    bg: 'var(--signal-clipping-bg)',
    border: 'var(--signal-clipping-border)',
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
