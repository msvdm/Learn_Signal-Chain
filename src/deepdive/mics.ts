// Microphone types (Deep dive, D46), pure: four ways of turning the same sound into a voltage —
// a dynamic microphone (a coil moving round a magnet), a condenser (a diaphragm moving near a
// charged backplate), a ribbon (a strip of foil moving between a magnet's poles) and a piezo
// (a crystal bent by its diaphragm). The scene (scenes/MicrophonesScene.tsx) draws them with these.
//
// The same sound reaches all four: 94 dB SPL — 1 pascal on average, the sound every microphone's
// sensitivity is measured with. Each is built so that its voltage follows the air's pressure, so the
// four voltages rise and fall together (the user's call, 2026-11-24): what differs is the part that
// moves. A dynamic's and a ribbon's give a voltage while they move — the faster, the more — so they
// move with the air itself (at the pressure's top they pass their middle, moving fastest). A
// condenser's and a piezo's give one while they are pushed in — the further, the more — so they are
// pushed in furthest at the pressure's top.
//
// The phase is the air's at the microphone, as in Magnetic induction: at 0° it passes its middle,
// moving fastest, and its pressure is highest (in a sound wave the two go together).

export type MicKind = 'dynamic' | 'condenser' | 'ribbon' | 'piezo'

/** In the picture's order: the first step's, the second's … */
export const MIC_KINDS: readonly MicKind[] = ['dynamic', 'condenser', 'ribbon', 'piezo']

/** The sound: 94 dB SPL, 1 pascal on average (rms) */
export const SOUND_DB_SPL = 94
export const SOUND_PA = 1

/**
 * Each microphone's sensitivity: its voltage on average (rms), in millivolts, for 1 pascal — real
 * microphones' published figures (README's *Sources*):
 * - dynamic: Shure SM58, −54.5 dBV/Pa (1.85 mV) — its spec sheet
 * - condenser: Neumann U 87 Ai in cardioid, 28 mV/Pa — Neumann's data
 * - ribbon: Royer R-121, −54 dBV/Pa (2 mV) — Sound On Sound's review
 * - piezo: Shure 777, a crystal microphone (a bimorph of Rochelle salt), 1.05 mV per microbar —
 *   10.5 mV/Pa — into 1 to 5 MΩ: its user guide
 */
export const SENSITIVITY: Record<MicKind, number> = { dynamic: 1.85, condenser: 28, ribbon: 2, piezo: 10.5 }

/** The model each sensitivity is taken from, as the picture names it */
export const MODEL: Record<MicKind, string> = {
  dynamic: 'Shure SM58', condenser: 'Neumann U 87 Ai', ribbon: 'Royer R-121', piezo: 'Shure 777',
}

/**
 * The ribbon's transformer, 1 : RIBBON_STEP_UP: a ribbon mic's is 1:20 to 1:40 (Thomann's guide to
 * ribbon microphones; the ribbon itself is under 1 Ω) — the middle of that
 */
export const RIBBON_STEP_UP = 30

/** The piezo's input: a crystal microphone wants 1 to 5 MΩ (the Shure 777's guide) — a Hi-Z input's 1 MΩ */
export const PIEZO_LOAD_MOHM = 1

/** Each one's voltage at its peak, in millivolts (a sine's peak is √2 times its average) */
export function peakMv(kind: MicKind): number {
  return SENSITIVITY[kind] * SOUND_PA * Math.SQRT2
}

/** The air's pressure at the microphone, as a share of its peak, at phase `r` (radians) */
export const pressureAt = (r: number) => Math.cos(r)

/** Where the air at the microphone is, as a share of its swing: at its middle at 0°, moving fastest */
export const airAt = (r: number) => Math.sin(r)

/** Whether a microphone's voltage follows its part's speed (dynamic, ribbon) or how far it is pushed in (condenser, piezo) */
export const FOLLOWS: Record<MicKind, 'speed' | 'position'> = {
  dynamic: 'speed', ribbon: 'speed', condenser: 'position', piezo: 'position',
}

/**
 * Where its moving part is (the diaphragm, the ribbon, the crystal's free end), as a share of its
 * swing, + pushed away from the sound: a dynamic's and a ribbon's move with the air (their speed
 * follows the pressure); a condenser's and a piezo's are pushed in as far as the pressure pushes them.
 */
export function partAt(kind: MicKind, r: number): number {
  return FOLLOWS[kind] === 'speed' ? airAt(r) : pressureAt(r)
}

/** Its moving part's speed, as a share of its fastest (+ away from the sound) */
export function partSpeed(kind: MicKind, r: number): number {
  return FOLLOWS[kind] === 'speed' ? Math.cos(r) : -Math.sin(r)
}

/**
 * Its voltage at phase `r`, in millivolts: from its part's speed or from its position, whichever it
 * follows — so all four follow the pressure, in step
 */
export function voltageAt(kind: MicKind, r: number): number {
  const share = FOLLOWS[kind] === 'speed' ? partSpeed(kind, r) : partAt(kind, r)
  return peakMv(kind) * share
}

/** The ribbon's own voltage, before its transformer steps it up, in millivolts */
export function ribbonOwnMv(r: number): number {
  return voltageAt('ribbon', r) / RIBBON_STEP_UP
}

/** A voltage on average (rms, millivolts) in dBu, as the canvas reads it (0 dBu = 0.775 V) */
export function dbuOf(mvRms: number): number {
  return 20 * Math.log10(mvRms / 774.6)
}

/** How many times a dynamic's voltage another microphone's is, for the same sound */
export function timesDynamic(kind: MicKind): number {
  return SENSITIVITY[kind] / SENSITIVITY.dynamic
}
