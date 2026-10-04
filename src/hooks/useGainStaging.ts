import type { SignalHealth, SignalDomain } from './useSignalChain'

/** The colour of each signal health zone (meters, port rings, wires). */
export function healthColor(health: SignalHealth): string {
  return `var(--signal-${health})`
}

export function dbToPercent(db: number): number {
  // Map -60..+20 to 0..100
  return Math.max(0, Math.min(100, ((db + 60) / 80) * 100))
}

export function formatDb(db: number, domain: SignalDomain = 'analog'): string {
  // A real reading down to −99.9 (a microphone sits at −60 dBu); below that it is silence
  const unit = domain === 'digital' ? 'dBFS' : 'dBu'
  if (!isFinite(db) || db <= -100) return `-∞ ${unit}`
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} ${unit}`
}
