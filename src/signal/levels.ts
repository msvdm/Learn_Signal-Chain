// Levels: the dB scale signals are measured on, its health zones, how a reading is written,
// how signals add up, and the send knobs' audio taper.

export type SignalHealth = 'too-quiet' | 'good' | 'hot' | 'clipping'
export type SignalDomain = 'analog' | 'digital'

/** Unity: the level the analog chain is built around (0 dBu). Up to here the signal is healthy. */
export const UNITY_DBU = 0
/** Clip level: the most an analog stage passes (+20 dBu, where every gain stops); at it the signal distorts. */
export const CLIP_DBU = 20
/** Converters line up unity with this digital level (0 dBu = −18 dBFS, so 0 dBFS = +18 dBu). */
export const ALIGNMENT_DB = 18

/** Where a ground-loop hum starts: on a DI Box's XLR Out, 30 dB under a guitar at mic level. */
export const HUM_DBU = -80

/** How strong a hum has grown: 0 where it starts … 1 at 60 dB louder. Its tag and the wires' glow grow with it. */
export function humStrength(db: number): number {
  return Math.min(1, Math.max(0, (db - HUM_DBU) / 60))
}

/**
 * Analog (dBu): too quiet below −40, good up to unity (0 dBu), hot above it, clipping at the clip
 * level (+20 dBu). Digital (dBFS): the same zones moved down by the converter alignment — good up
 * to −18 dBFS (unity) — but clipping at 0 dBFS, the digital ceiling.
 */
export function getHealth(db: number, domain: SignalDomain = 'analog'): SignalHealth {
  const unity = domain === 'digital' ? UNITY_DBU - ALIGNMENT_DB : UNITY_DBU
  const clip  = domain === 'digital' ? 0 : CLIP_DBU
  if (db < unity - 40) return 'too-quiet'
  if (db <= unity) return 'good'
  if (db < clip) return 'hot'
  return 'clipping'
}

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

/** Signals added together (voltages: two identical signals give +6 dB). Silent ones add nothing. */
export function sumSignalsToDb(dbs: number[]): number {
  const finite = dbs.filter((db) => isFinite(db))
  if (finite.length === 0) return -Infinity
  const linearSum = finite.reduce((acc, db) => acc + Math.pow(10, db / 20), 0)
  return 20 * Math.log10(linearSum)
}

/** Knob position of unity (0 dB) on an audio-taper knob. */
export const TAPER_UNITY = 75

// Audio-taper knob position (0–100), used by the Matrix Bus send knobs.
// 0 = fully CCW → −∞,  75 = unity (0 dB),  100 = fully CW (+10 dB).
// Below unity: log taper (−60 dB/octave feel). Above unity: linear boost to +10 dB.
export function taperToDb(position: number): number {
  if (position <= 0) return -Infinity
  const t = position / 100
  if (t <= 0.75) {
    const normalized = t / 0.75                          // 0 → 1 as the knob goes CCW → unity
    return 60 * Math.log10(Math.max(normalized, 0.0001)) // −∞ → 0 dB
  }
  return ((t - 0.75) / 0.25) * 10                       // 0 → +10 dB above unity
}
