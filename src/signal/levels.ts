// Levels: the dB scale signals are measured on, the readings a signal carries, its health zones,
// how a reading is written, how signals add up, and the send knobs' audio taper.

export type SignalHealth = 'too-quiet' | 'good' | 'hot' | 'clipping'
export type SignalDomain = 'analog' | 'digital'

/** Unity: the level the analog chain is built around (0 dBu). Up to here the signal is healthy. */
export const UNITY_DBU = 0
/** Clip level: the most an analog stage passes (+20 dBu, where every gain stops); at it the signal distorts. */
export const CLIP_DBU = 20
/** Converters line up unity with this digital level (0 dBu = −18 dBFS, so 0 dBFS = +18 dBu). */
export const ALIGNMENT_DB = 18

/** The most a stage can pass: the clip level analog (+20 dBu), the ceiling digital (0 dBFS). */
export function ceilingOf(domain: SignalDomain): number {
  return domain === 'digital' ? 0 : CLIP_DBU
}

// ── The readings ──────────────────────────────────────────────────────────────

/**
 * One side of a signal (or its only channel), in dBu — dBFS after an ADC. −∞: none.
 * The music has peaks above its average; the noise is what you hear when the music stops.
 */
export interface SideLevels {
  /** The loudest moments: the average plus the sound's peak-to-average gap (a voice ~12 dB) */
  peak: number
  /** The average: the level the meters show */
  rms: number
  /** Everything you hear when the music stops: hiss and hum together */
  noise: number
  /** The hum part of the noise (a DI Box ground loop), kept apart for its red glow */
  hum: number
}

export const READINGS = ['peak', 'rms', 'noise', 'hum'] as const
export type Reading = typeof READINGS[number]

export const SILENT: SideLevels = { peak: -Infinity, rms: -Infinity, noise: -Infinity, hum: -Infinity }

/** A side built reading by reading. */
export function eachReading(f: (reading: Reading) => number): SideLevels {
  return { peak: f('peak'), rms: f('rms'), noise: f('noise'), hum: f('hum') }
}

/** Turned up or down by `db`: the music, its peaks and the noise move together. */
export function shifted(s: SideLevels, db: number): SideLevels {
  return eachReading((k) => s[k] + db)
}

/** Each reading at least as loud as in either side (the louder side, reading by reading). */
export function louder(a: SideLevels, b: SideLevels): SideLevels {
  return eachReading((k) => Math.max(a[k], b[k]))
}

/** Sides added together: the music as voltages (+6 dB for two equal ones), the noise as noise (+3 dB). */
export function sumSides(sides: SideLevels[]): SideLevels {
  return {
    peak:  sumSignalsToDb(sides.map((s) => s.peak)),
    rms:   sumSignalsToDb(sides.map((s) => s.rms)),
    noise: sumNoiseToDb(sides.map((s) => s.noise)),
    hum:   sumNoiseToDb(sides.map((s) => s.hum)),
  }
}

/** Signal-to-noise: how far the average sits above the noise (dB). */
export function snrOf(s: SideLevels): number {
  return s.rms - s.noise
}

/** Headroom: how far the peaks sit below the clip level / the digital ceiling (dB). */
export function headroomOf(s: SideLevels, domain: SignalDomain = 'analog'): number {
  return ceilingOf(domain) - s.peak
}

/** Crest: how far the peaks sit above the average (dB) — a sine 3, a voice 12, drums 18. */
export function crestOf(s: SideLevels): number {
  return s.peak - s.rms
}

/**
 * The hiss: the noise without its hum (powers taken apart). Shown on its own, since a hum has its
 * own tag. −∞: none (or nothing but hum).
 */
export function hissOf(s: SideLevels): number {
  if (!isFinite(s.hum)) return s.noise
  const power = Math.pow(10, s.noise / 10) - Math.pow(10, s.hum / 10)
  // Rounding can leave a sliver when the noise is all hum
  return power > Math.pow(10, s.hum / 10) * 1e-9 ? 10 * Math.log10(power) : -Infinity
}

/** Where a ground-loop hum starts: on a DI Box's XLR Out, 30 dB under a guitar at mic level. */
export const HUM_DBU = -80

/** How strong a hum has grown: 0 where it starts … 1 at 60 dB louder. Its tag and the wires' glow grow with it. */
export function humStrength(db: number): number {
  return Math.min(1, Math.max(0, (db - HUM_DBU) / 60))
}

/**
 * The health of a signal with average `db` and peaks at `peakDb` (the average when left out).
 * Clipping as soon as the peaks reach the clip level (+20 dBu) or the digital ceiling (0 dBFS);
 * otherwise from the average. Analog (dBu): too quiet below −40, good up to unity (0 dBu), hot
 * above it. Digital (dBFS): the same zones moved down by the converter alignment — good up to
 * −18 dBFS (unity).
 */
export function getHealth(db: number, domain: SignalDomain = 'analog', peakDb: number = db): SignalHealth {
  const unity = domain === 'digital' ? UNITY_DBU - ALIGNMENT_DB : UNITY_DBU
  if (Math.max(db, peakDb) >= ceilingOf(domain)) return 'clipping'
  if (db < unity - 40) return 'too-quiet'
  if (db <= unity) return 'good'
  return 'hot'
}

/** The colour of each signal health zone (meters, port rings, wires). */
export function healthColor(health: SignalHealth): string {
  return `var(--signal-${health})`
}

export function dbToPercent(db: number): number {
  // Map -60..+20 to 0..100
  return Math.max(0, Math.min(100, ((db + 60) / 80) * 100))
}

/** At or below this a level counts as silence: written −∞, no readings (a microphone sits at −60 dBu). */
export const SILENCE_DB = -100

export function formatDb(db: number, domain: SignalDomain = 'analog'): string {
  // A real reading down to −99.9; below that it is silence
  const unit = domain === 'digital' ? 'dBFS' : 'dBu'
  if (!isFinite(db) || db <= SILENCE_DB) return `-∞ ${unit}`
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} ${unit}`
}

/** Signals added together (voltages: two identical signals give +6 dB). Silent ones add nothing. */
export function sumSignalsToDb(dbs: number[]): number {
  const finite = dbs.filter((db) => isFinite(db))
  if (finite.length === 0) return -Infinity
  const linearSum = finite.reduce((acc, db) => acc + Math.pow(10, db / 20), 0)
  return 20 * Math.log10(linearSum)
}

/**
 * Noises added together (powers: two equal noises give +3 dB — noise from different places never
 * lines up). Silent ones add nothing; one alone comes out exactly as it went in.
 */
export function sumNoiseToDb(dbs: number[]): number {
  const finite = dbs.filter((db) => isFinite(db))
  if (finite.length <= 1) return finite[0] ?? -Infinity
  return 10 * Math.log10(finite.reduce((acc, db) => acc + Math.pow(10, db / 10), 0))
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
