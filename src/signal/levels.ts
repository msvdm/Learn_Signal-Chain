// Levels: the dB scale signals are measured on, the readings a signal carries, its health zones,
// how a reading is written, how signals add up, and the send knobs' audio taper.

import type { TypeKey } from '../data/nodeRegistry'

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

/** Unity in a domain: 0 dBu analog, −18 dBFS digital (the converter alignment). */
export function unityOf(domain: SignalDomain): number {
  return domain === 'digital' ? UNITY_DBU - ALIGNMENT_DB : UNITY_DBU
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

export type Reading = keyof SideLevels

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
  if (sides.length === 1) return sides[0]
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
  const unity = unityOf(domain)
  if (Math.max(db, peakDb) >= ceilingOf(domain)) return 'clipping'
  if (db < unity - 40) return 'too-quiet'
  if (db <= unity) return 'good'
  return 'hot'
}

/** The colour of each signal health zone (meters, port rings, wires). */
export function healthColor(health: SignalHealth): string {
  return `var(--signal-${health})`
}

/** How many dB a meter's bar spans evenly: from 80 dB under the ceiling up to it. */
export const METER_RANGE_DB = 80

/**
 * The share of a meter's bar (%) under its even part: everything quieter, squeezed, down to silence
 * (SILENCE_DB) — the bottom of the bar is −∞ (D16).
 */
export const METER_TAIL = 10

/** The bottom of a meter's even part: −60 dBu analog, −80 dBFS digital. */
export function meterFloorOf(domain: SignalDomain): number {
  return ceilingOf(domain) - METER_RANGE_DB
}

/**
 * Where a level sits along a meter's bar (0 … 100 %): the bar ends at the domain's ceiling — the
 * clip level analog (−60 … +20 dBu evenly), 0 dBFS digital (−80 … 0 dBFS) — so a bar reaching the
 * top clips, either way. Under the even part, the bottom METER_TAIL % hold everything quieter down
 * to silence: 0 % is −∞.
 */
export function dbToPercent(db: number, domain: SignalDomain = 'analog'): number {
  const floor = meterFloorOf(domain)
  if (db >= floor) return Math.min(100, METER_TAIL + ((db - floor) / METER_RANGE_DB) * (100 - METER_TAIL))
  if (db <= SILENCE_DB) return 0
  return ((db - SILENCE_DB) / (floor - SILENCE_DB)) * METER_TAIL
}

/** The top of a meter's scale painted red: this close under the ceiling, the peaks are about to clip. */
export const CLIP_ZONE_DB = 2

/**
 * What a part of a meter's scale shows (D17): the noise (blue — the noise measured with the music
 * stopped), a good level (green, up to unity), a hot one (yellow), clipping (red, the top
 * CLIP_ZONE_DB under the ceiling).
 */
export type MeterZoneKind = 'noise' | 'good' | 'hot' | 'clipping'

/** Each zone's colour, by the health it shares it with (the noise: the too-quiet blue). */
export const ZONE_HEALTH: Record<MeterZoneKind, SignalHealth> = { noise: 'too-quiet', good: 'good', hot: 'hot', clipping: 'clipping' }

/** One colour along a meter's bar: where its zone runs (%, bottom to top). */
export interface MeterZone {
  kind: MeterZoneKind
  from: number
  to: number
}

/**
 * A meter's colours along its bar (D17, after D16): blue from the bottom up to its `noise` — the
 * blue part is the noise, and it moves with it —, green above that up to unity, yellow hot, red in
 * the top CLIP_ZONE_DB under the ceiling (and anything above). No `noise` (Beginner — D3): green
 * from the bottom. `shift`: every reading is moved by this on the bar (a dB SPL meter); `noise` is
 * in the cable's units, like the zones' edges, so the colours still judge the signal in the cable.
 * Zones with no room are left out.
 */
export function meterZones(domain: SignalDomain = 'analog', shift = 0, noise?: number): MeterZone[] {
  const upTo: [MeterZoneKind, number][] = [
    ['noise', noise ?? -Infinity], ['good', unityOf(domain)], ['hot', ceilingOf(domain) - CLIP_ZONE_DB], ['clipping', Infinity],
  ]
  const zones: MeterZone[] = []
  let from = 0
  for (const [kind, db] of upTo) {
    const to = dbToPercent(db + shift, domain)
    if (to > from) zones.push({ kind, from, to })
    from = Math.max(from, to)
  }
  return zones
}

/** A level this close above the noise still reads as the noise (a meter's moving RMS in a pause). */
export const NOISE_MARGIN_DB = 1

/**
 * Where a value sits on a meter's scale (D17): its zone, as `meterZones` colours it — at the noise
 * (or within NOISE_MARGIN_DB of it) the noise. In the cable's units. Null: silence.
 */
export function zoneAt(db: number, domain: SignalDomain = 'analog', noise?: number): MeterZoneKind | null {
  if (!isFinite(db) || db <= SILENCE_DB) return null
  if (noise !== undefined && db <= noise + NOISE_MARGIN_DB) return 'noise'
  if (db >= ceilingOf(domain) - CLIP_ZONE_DB) return 'clipping'
  return db > unityOf(domain) ? 'hot' : 'good'
}

/** A number beside a meter. */
export interface ScaleMark {
  /** Where along the bar (%) */
  at: number
  /** As printed: "+20", "0", "-18", "130", "-∞" */
  label: string
  /** Unity: the level the chain is built around */
  strong: boolean
  /** The ceiling of a dBu / dBFS meter: where it clips */
  top: boolean
}

/**
 * The numbers beside a meter (D16), top to bottom: every 10 dB of its even part, then −∞ at the
 * bottom — dBu (+20 … −60), dBFS (0 … −80, unity −18 in place of −20), or dB SPL on a meter reading
 * the sound in the air (`spl`: 130 … 50, the bar's own scale — SPL_SCALE_DB). `overview`: only the
 * top, unity and −∞ (+20 0 −∞, 0 −18 −∞, 130 110 −∞) — the meter zoomed out.
 */
export function scaleMarks(domain: SignalDomain = 'analog', { spl, overview = false }: { spl?: number; overview?: boolean } = {}): ScaleMark[] {
  const ceiling = ceilingOf(domain)
  const unity   = unityOf(domain)
  const steps = overview
    ? [ceiling, unity]
    // The step nearest unity is unity itself (digital: −18 for −20)
    : Array.from({ length: METER_RANGE_DB / 10 + 1 }, (_, i) => ceiling - 10 * i).map((db) => (Math.abs(db - unity) < 5 ? unity : db))
  const label = (db: number) => (spl !== undefined ? String(db + SPL_SCALE_DB) : db > 0 ? `+${db}` : String(db))
  return [
    ...steps.map((db) => ({
      at: dbToPercent(db, domain), label: label(db), strong: spl === undefined && db === unity, top: spl === undefined && db === ceiling,
    })),
    { at: 0, label: '-∞', strong: false, top: false },
  ]
}

/**
 * The marks that fit a meter `length` px long, each label `label` px tall: the top, unity and −∞
 * always; every other one, from the top down, only if it stays a label's height clear of those
 * kept — a short meter drops −60 (10 % above −∞) first.
 */
export function fitScaleMarks(marks: ScaleMark[], length: number, label: number): ScaleMark[] {
  const always = (m: ScaleMark) => m.top || m.strong || m === marks[0] || m === marks[marks.length - 1]
  const kept = marks.filter(always)
  for (const m of marks) {
    if (!always(m) && kept.every((k) => (Math.abs(k.at - m.at) * length) / 100 >= label)) kept.push(m)
  }
  return marks.filter((m) => kept.includes(m))
}

/**
 * At or below this a level counts as silence: written −∞, no readings. Under the quietest noise a
 * chain has (a microphone's room, −126 dBu; a preamp's input noise, −128): real noise floors read
 * as numbers (D18).
 */
export const SILENCE_DB = -140

export function formatDb(db: number, domain: SignalDomain = 'analog'): string {
  // A real reading down to −139.9; below that it is silence
  const unit = domain === 'digital' ? 'dBFS' : 'dBu'
  if (!isFinite(db) || db <= SILENCE_DB) return `-∞ ${unit}`
  // Rounded first: a hair under 0 is "+0.0", never "-0.0"
  const shown = Math.round(db * 10) / 10 || 0
  return `${shown >= 0 ? '+' : ''}${shown.toFixed(1)} ${unit}`
}

// ── Sound in the air (dB SPL) ──────────────────────────────────────────────────

/**
 * Where a card turns sound into a signal or a signal into sound, its meter reads dB SPL — how loud
 * the sound is in the air: its level in dBu plus this. A Microphone: a typical dynamic mic sends
 * −52 dBu at 94 dB SPL (1 pascal), so its usual −60 dBu is a voice at 86 (singing and drums reach
 * it louder: process.ts AT_THE_MIC_DB). A speaker, a metre away: 0 dBu in plays 110 dB SPL, the clip
 * level (+20 dBu) 130 — a powerful PA speaker's most. Headphones: 0 dBu plays 95 (−10 dBu: 85, the
 * level studios mix at; 115 at most). A Guitar Amp: as loud as the Microphone in front of it hears
 * it (process.ts GUITAR_REF_DB, a mic at −60 dBu).
 */
export const SPL_DB: Partial<Record<TypeKey, number>> = {
  mic: 146, 'guitar-amp': 116, speaker: 110, 'active-speaker': 110, headphones: 95,
}

/** A dB SPL meter's bar runs 50 … 130 dB SPL: the dBu scale (−60 … +20) moved up by this. */
export const SPL_SCALE_DB = 110

/** A level as dB SPL (`spl`: its card's SPL_DB), in whole dB: "86 dB SPL"; −∞ below silence. */
export function formatSpl(db: number, spl: number): string {
  if (!isFinite(db) || db <= SILENCE_DB) return '-∞ dB SPL'
  return `${Math.round(db + spl)} dB SPL`
}

/** `dbs` added as amplitudes (`per` 20) or powers (10). Silent ones add nothing; one alone comes out exactly as it went in. */
function sumDb(dbs: number[], per: number): number {
  // Plain loops: every bus on every change adds up a list of these
  let only = -Infinity
  let count = 0
  let sum = 0
  for (const db of dbs) {
    if (!isFinite(db)) continue
    only = db
    count++
    sum += Math.pow(10, db / per)
  }
  return count <= 1 ? only : per * Math.log10(sum)
}

/** Signals added together (voltages: two identical signals give +6 dB). Silent ones add nothing. */
export function sumSignalsToDb(dbs: number[]): number {
  return sumDb(dbs, 20)
}

/**
 * Noises added together (powers: two equal noises give +3 dB — noise from different places never
 * lines up). Silent ones add nothing; one alone comes out exactly as it went in.
 */
export function sumNoiseToDb(dbs: number[]): number {
  return sumDb(dbs, 10)
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
