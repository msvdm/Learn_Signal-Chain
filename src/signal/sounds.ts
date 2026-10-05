import type { SignalNode, TypeKey } from '../data/nodeRegistry'
import { param } from '../data/nodeRegistry'
import { PEAKS_ABOVE } from './process'

// What each source plays over time (the time engine, signal/time.ts): one loop of two bars, played
// over and over — a level for every millisecond, and the peaks at that moment. Each loop is tuned
// so that over the loop its average is 0 dB (the source's average, as the still picture has it)
// and its loudest moment is as far above it as the still picture says (PEAKS_ABOVE). Built from a
// fixed list of notes and hits, so it plays the same every time.

/** One loop: two bars of 4/4 at 120 beats a minute. */
export const LOOP_MS = 4000
/** A beat */
const BEAT_MS = 500

/** What a source plays. */
export type SoundKind = 'voice' | 'keys' | 'drums' | 'guitar' | 'sine' | 'noise' | 'click'

/** Each sound's peaks above its average, as the still picture has them. */
const PEAKS_OF: Record<SoundKind, keyof typeof PEAKS_ABOVE> = {
  voice: 'melodic', keys: 'melodic', drums: 'percussive', guitar: 'guitar',
  sine: 'sine', noise: 'noise', click: 'click',
}

/** Every sound. */
export const SOUND_KINDS = Object.keys(PEAKS_OF) as SoundKind[]

/** How far a sound's loudest moment reaches above its average (dB), as the still picture has it. */
export const peaksAboveOf = (kind: SoundKind): number => PEAKS_ABOVE[PEAKS_OF[kind]]

/** What a source plays: a Microphone a voice and a Line Input keys (drums when set to Percussive), an Instrument a guitar, the Generator its Sound. */
export function soundKindOf(node: Pick<SignalNode, 'typeKey' | 'params'>): SoundKind {
  switch (node.typeKey as TypeKey) {
    case 'instrument': return 'guitar'
    case 'generator':  return param(node, 'sound')
    case 'line-in':    return param(node, 'character') === 'percussive' ? 'drums' : 'keys'
    default:           return param(node, 'character') === 'percussive' ? 'drums' : 'voice'
  }
}

/** One loop of a sound, a value per millisecond, in dB from its average (−∞: silent). */
export interface SoundLoop {
  /** The level of the moment: over the loop its average is 0 dB */
  rms: Float64Array
  /** The peaks at that moment: never below the level; the loudest, at the start of the loop, is PEAKS_ABOVE */
  peak: Float64Array
}

// ── Notes and hits ───────────────────────────────────────────────────────────

/** A note or a hit: it rises, holds, fades, and stops. */
interface Hit {
  /** When it reaches its level (ms into the loop); it starts rising `attackMs` before */
  at: number
  /** How loud, before tuning (dB) */
  db: number
  /** Rising from 20 dB below (0: at once — a pick, a stick, a hammer, a "p") */
  attackMs: number
  /** At its level */
  holdMs: number
  /** Then fading (dB a millisecond) … */
  fadeDbPerMs: number
  /** … until it stops, this long after it reached its level */
  lengthMs: number
  /** How far its peaks reach above its level, before tuning (dB) */
  crestDb: number
}

/** A hit's level `ms` after it reached it (rising before; −∞ before it starts and once it has stopped). */
function levelAt(hit: Hit, ms: number): number {
  if (ms < -hit.attackMs || ms >= hit.lengthMs) return -Infinity
  if (ms < 0) return hit.db + 20 * ms / hit.attackMs
  return hit.db - hit.fadeDbPerMs * Math.max(0, ms - hit.holdMs)
}

/**
 * The hits laid out over one loop (one running past the end comes back at the start, one rising
 * before the start rises at the end, so the loop joins up): at each millisecond the level is all
 * of them added (as powers), the peaks those of the loudest one.
 */
function render(hits: Hit[]): { rms: Float64Array; crest: Float64Array } {
  const rms   = new Float64Array(LOOP_MS)
  const crest = new Float64Array(LOOP_MS)
  for (let t = 0; t < LOOP_MS; t++) {
    let power = 0
    let top   = -Infinity
    for (const hit of hits) {
      const ms = t - hit.at
      const db = Math.max(levelAt(hit, ms), levelAt(hit, ms + LOOP_MS), levelAt(hit, ms - LOOP_MS))
      if (!isFinite(db)) continue
      power += Math.pow(10, db / 10)
      if (db > top) { top = db; crest[t] = hit.crestDb }
    }
    rms[t] = power > 0 ? 10 * Math.log10(power) : -Infinity
  }
  return { rms, crest }
}

/** `n` hits, one every `everyMs` from `fromMs`, each `like` the template with its level from `dbs`. */
function every(everyMs: number, dbs: number[], like: Omit<Hit, 'at' | 'db'>, fromMs = 0): Hit[] {
  return dbs.map((db, i) => ({ ...like, at: fromMs + i * everyMs, db }))
}

// The sounds. Each starts with its loudest moment — the first beat — so the peaks of different
// sounds meet there, as the still picture adds them on a bus.

/** A voice: two phrases of syllables, each followed by a pause (silence — a gate closes there). */
function voice(): Hit[] {
  const syllable = { attackMs: 20, holdMs: 70, fadeDbPerMs: 0.06, lengthMs: 150, crestDb: 7 }
  const phrase = (at: number, dbs: number[]) => dbs.map((db, i) => ({ ...syllable, at: at + i * 195, db }))
  return [
    // The first syllable, the strongest, with the sharpest peaks
    { ...syllable, at: 0, db: 0, crestDb: 8 },
    ...phrase(195, [-5, -3, -7, -2, -6, -4, -8]),          // … to 1515, then a pause
    ...phrase(2020, [-1, -5, -3, -6, -4, -7, -5, -8]),     // … to 3535, then a pause
  ]
}

/** Keys: a chord on beats 1 and 3, a melody note on 2 and 4 — struck, then fading, never silent. */
function keys(): Hit[] {
  const chord  = { attackMs: 2, holdMs: 0, fadeDbPerMs: 0.02, lengthMs: 2 * BEAT_MS, crestDb: 6 }
  const melody = { attackMs: 2, holdMs: 0, fadeDbPerMs: 0.03, lengthMs: BEAT_MS, crestDb: 5 }
  return [
    ...every(2 * BEAT_MS, [0, -2, -1, -2], chord),
    ...every(2 * BEAT_MS, [-6, -7, -6, -8], melody, BEAT_MS),
  ]
}

/** Drums: a kick on beats 1 and 3, a snare on 2 and 4, a hi-hat every half beat — sharp hits that die away. */
function drums(): Hit[] {
  const kick  = { attackMs: 2, holdMs: 5, fadeDbPerMs: 0.15, lengthMs: 300, crestDb: 8 }
  const snare = { attackMs: 2, holdMs: 5, fadeDbPerMs: 0.2,  lengthMs: 250, crestDb: 8 }
  const hat   = { attackMs: 1, holdMs: 2, fadeDbPerMs: 0.5,  lengthMs: 60,  crestDb: 8 }
  return [
    ...every(2 * BEAT_MS, [0, -1, -1, -1], kick),
    ...every(2 * BEAT_MS, [-2, -2, -2, -2], snare, BEAT_MS),
    ...every(BEAT_MS / 2, Array.from({ length: 16 }, () => -12), hat),
  ]
}

/** A guitar: a pluck on every beat, the first of each bar the strongest, each ringing until the next. */
function guitar(): Hit[] {
  const pluck = { attackMs: 1, holdMs: 3, fadeDbPerMs: 0.04, lengthMs: BEAT_MS, crestDb: 8 }
  return every(BEAT_MS, [0, -4, -2, -4, -1, -4, -2, -5], pluck)
}

/** Clicks: a short burst on every beat, the first of each bar a little louder; silence between. */
function click(): Hit[] {
  const burst = { attackMs: 0, holdMs: 10, fadeDbPerMs: 0.5, lengthMs: 100, crestDb: 4 }
  return every(BEAT_MS, [0, -3, -3, -3, 0, -3, -3, -3], burst)
}

/** A steady tone: the same level all the time, its peaks 3 dB above it (a sine wave's). */
function sine(): { rms: Float64Array; crest: Float64Array } {
  return { rms: new Float64Array(LOOP_MS), crest: new Float64Array(LOOP_MS).fill(1) }
}

/** A small random number generator that always gives the same numbers from the same seed (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Noise (hiss): steady, its level wandering a little, its peaks jumping about from moment to moment. */
function noise(): { rms: Float64Array; crest: Float64Array } {
  const random = seeded(2026)
  const rms    = new Float64Array(LOOP_MS)
  const crest  = new Float64Array(LOOP_MS)
  let wander = 0
  for (let t = 0; t < LOOP_MS; t++) {
    wander  = 0.95 * wander + 0.05 * (random() * 2 - 1)
    rms[t]   = 4 * wander                // within about ±1 dB
    crest[t] = 7 + 2 * random()
  }
  // The loudest moment first, like every sound
  rms[0]   = Math.max(...rms)
  crest[0] = 9
  return { rms, crest }
}

const SHAPES: Record<SoundKind, () => { rms: Float64Array; crest: Float64Array }> = {
  voice:  () => render(voice()),
  keys:   () => render(keys()),
  drums:  () => render(drums()),
  guitar: () => render(guitar()),
  click:  () => render(click()),
  sine,
  noise,
}

/**
 * The shape tuned to the still picture: moved so its average over the loop is 0 dB, and its peaks
 * (above the level by its crest, all crests scaled alike) so the loudest — at the start, where the
 * level and the crest are highest — is `peaksAbove`.
 */
function tuned({ rms, crest }: { rms: Float64Array; crest: Float64Array }, peaksAbove: number): SoundLoop {
  const power = rms.reduce((sum, db) => sum + Math.pow(10, db / 10), 0) / LOOP_MS
  const mean  = 10 * Math.log10(power)
  const scale = (peaksAbove - (rms[0] - mean)) / crest[0]
  const level = rms.map((db) => db - mean)
  return { rms: level, peak: level.map((db, t) => db + scale * crest[t]) }
}

const loops = new Map<SoundKind, SoundLoop>()

/** One loop of a sound (worked out the first time it is asked for). */
export function loopOf(kind: SoundKind): SoundLoop {
  let loop = loops.get(kind)
  if (!loop) loops.set(kind, loop = tuned(SHAPES[kind](), peaksAboveOf(kind)))
  return loop
}
