import type { Character, GeneratorSound, SignalNode, TypeKey } from '../data/nodeRegistry'
import { MIC_CHARACTERS, param } from '../data/nodeRegistry'
import type { SideLevels, SignalDomain } from './levels'
import { SILENT, ceilingOf, eachReading, shifted, sumNoiseToDb } from './levels'
import { GEQ_CENTERS, eqLevelChange, graphicEqLevelChange, hpfLevelChange } from './eqMath'
import type { Side } from './sided'
import { gainDbOf, geqBandDb } from './gains'

// What each card does to one channel, as the number engine reads it (signal/chain.ts runChain runs
// it once per side in stereo): to its peaks, its average and its noise (SideLevels). It answers at
// once, on every change; the render on real sound (audio/measure.ts) then measures what the card
// really does, and the cards show that (decision D9). Simplified on purpose: its filters change the
// level of pink noise, its dynamics put each reading through their curve on its own.

/**
 * Why a card sends nothing out, or what is wrong with what it sends (`blown`: far too much,
 * `needsDi`: a guitar losing its high notes). What the card says about each, and how:
 * components/nodes/conditions.tsx.
 */
export type StageCondition =
  | 'domainMixedBus'    // a bus fed analog and digital signals at once
  | 'digitalToAmp'      // an amplifier fed a digital signal
  | 'digitalToSpeaker'  // a speaker fed a digital signal
  | 'adcExpectsAnalog'  // an ADC fed a digital signal
  | 'dacExpectsDigital' // a DAC fed an analog signal
  | 'needsAmp'          // a passive speaker with no amplifier before it: silent
  | 'blown'             // an active speaker fed from an amplifier: far too strong, it breaks
  | 'needsDi'           // an instrument going into a desk input without a DI Box: levels fine, high notes lost

/** Whether a card in each condition sends nothing — every condition says (a new one does not compile without). */
export const SILENCES: Record<StageCondition, boolean> = {
  domainMixedBus:    true,
  digitalToAmp:      true,
  digitalToSpeaker:  true,
  adcExpectsAnalog:  true,
  dacExpectsDigital: true,
  needsAmp:          true,
  blown:             false,
  needsDi:           false,
}

/** One channel through a card. */
export interface SideResult {
  out: SideLevels
  /** Analog (dBu) or digital (dBFS), leaving the card */
  domain: SignalDomain
  /** How far a dynamics card turns the signal (its average) down right now */
  gainReductionDb?: number
  condition?: StageCondition
}

export interface SideContext {
  /** What arrives: analog or digital */
  domain: SignalDomain
  /** Analog and digital signals arrive at once */
  mixedDomains: boolean
  /** Which side of a stereo signal this is (null: the only channel) */
  side: Side
  /** This Gain is a Preamp (after a microphone or a DI Box's XLR Out) */
  preamp: boolean
  /** Something is plugged in (a microphone hearing a Guitar Amp; a card hisses only then) */
  fed: boolean
}

/**
 * How much stronger an amplifier's output (speaker level) is than the line level an active
 * speaker expects. Fed from an amplifier, an active speaker shows at least the clip level.
 */
export const SPEAKER_LEVEL_DB = 40

/**
 * A Guitar Amp playing at this level (a guitar at its usual level, Volume at 0 dB) gives a
 * microphone in front of it its usual level (its sensitivityDb); louder or quieter, the mic follows.
 */
export const GUITAR_REF_DB = -30

// ── Sources and noise ─────────────────────────────────────────────────────────

/** How a source sounds: its peaks above its average (dB), its noise below it (dB). */
export interface SourceSound {
  peakDb: number
  noiseDb: number
}

/**
 * What a source plays: a Microphone hears speech, singing or drums, a Line Input plays music or
 * drums (their `character`), an Instrument a guitar, the Generator its Sound. Each but the
 * Generator's is a loop of real sound (src/audio/loops).
 */
export type SoundKind = Character | GeneratorSound | 'guitar'

/** What a source plays (a Guitar Amp plays what reaches it; a Microphone in front of one hears that). */
export function soundKindOf(node: Pick<SignalNode, 'typeKey' | 'params'>): SoundKind {
  switch (node.typeKey) {
    case 'instrument': return 'guitar'
    case 'generator':  return param(node, 'sound')
    default:           return param(node, 'character')
  }
}

/**
 * How far the loudest moments of each kind of sound reach above its average over its loop (dB) —
 * the loops are made so (scripts/make-loops.py), the Generator's sounds too (audio/sounds.ts).
 */
export const PEAKS_ABOVE = {
  /** A voice: someone speaking, someone singing */
  speech:  12,
  singing: 12,
  /** Music from a player: keys, a bass, a shaker */
  music:   12,
  /** Drums: sharp hits far above the average */
  drums:   18,
  /** A guitar (the Instrument): plucks, sharper than a voice, softer than drums */
  guitar:  15,
  // The Generator's sounds
  /** A steady tone: a sine wave's peaks are 3 dB above its average */
  sine:    3,
  noise:   12,
  /** Short pulses, like a metronome: as far above the average as drums */
  click:   18,
} as const satisfies Record<SoundKind, number>

/** How far each source's own noise sits below its average (dB). */
export const NOISE_BELOW = {
  /** The room and the mic's own hiss */
  mic:          66,
  /** Keys, a phone, a player */
  'line-in':    80,
  /** The pickups' hiss and buzz */
  instrument:   70,
  /** A test generator is cleaner than any player */
  generator:    90,
} as const satisfies Partial<Record<TypeKey, number>>

type Source = keyof typeof NOISE_BELOW

/** A source's sound: what it plays (soundKindOf) and its own noise. */
export function soundOf(typeKey: Source, params: SignalNode['params']): SourceSound {
  return { peakDb: PEAKS_ABOVE[soundKindOf({ typeKey, params })], noiseDb: NOISE_BELOW[typeKey] }
}

/** A source playing at `level` (its average). */
export function sourceLevels(level: number, sound: SourceSound): SideLevels {
  return { peak: level + sound.peakDb, rms: level, noise: level - sound.noiseDb, hum: -Infinity }
}

/**
 * How much louder than speech each sound reaches a Microphone, close up (dB): someone speaking gives
 * its usual level (sensitivityDb, −60 dBu: 86 dB SPL), someone singing 10 dB more (96), a drum 24
 * (110). The signal it sends follows, as a real microphone's does.
 */
export const AT_THE_MIC_DB = { speech: 0, singing: 10, drums: 24 } as const satisfies Record<typeof MIC_CHARACTERS[number], number>

/** How far a source's sound is above its usual level: a Microphone's by what it picks up, anything else 0. */
export function loudnessOf(node: Pick<SignalNode, 'typeKey' | 'params'>): number {
  if (node.typeKey !== 'mic') return 0
  return AT_THE_MIC_DB[param(node, 'character') as keyof typeof AT_THE_MIC_DB] ?? 0
}

// ── A card's own noise, as on a real analogue desk (D18) ───────────────────────────
// Two sources per powered card. Input noise is added before the card's gain and amplified by it:
// only a Gain has one — a mic preamp's equivalent input noise (EIN), or, as a trim on a line, the
// same preamp behind a 20 dB pad. Output noise is added after the card's job and stays put: the
// card's own controls never turn it down (a fader pulled down still leaves its stage's floor, an
// amplifier turned down still hisses). So a Preamp's noise rises with its gain once the EIN, lifted,
// passes its floor; noise arriving is turned up or down with the signal. Figures from real gear:
// EIN −128 dBu (150 Ω, 20 Hz – 20 kHz; Yamaha MG, Behringer Xenyx, Mackie VLZ: −128 … −129.5); a
// desk's residual output noise about −100 dBu (MG10XU: −102); a line stage about −95; a mix bus
// −86 … −91 with channels at unity / down; converters 112 dB under full scale; a power amp about
// 105 dB under its full output.

/** A mic preamp's equivalent input noise (dBu), amplified by its gain. */
export const PREAMP_EIN_DBU = -128
/** A Gain's own floor at its output (dBu): what is left at low gain. */
export const GAIN_FLOOR_DBU = -100
/** A Gain as a trim on a line signal: the same preamp behind a 20 dB pad (dBu, before its gain). */
export const TRIM_INPUT_NOISE_DBU = PREAMP_EIN_DBU + 20
/** A line stage at its output: filter, EQ, dynamics, fader (dBu). */
export const LINE_NOISE_DBU = -95
/** A mix bus's summing amplifier at its output (dBu). */
export const BUS_NOISE_DBU = -90
/** A converter's own noise: 112 dB under its full scale (dBFS — at the usual alignment −94 dBu). */
export const CONVERTER_NOISE_DBFS = -112
/** A power amplifier's — or a powered speaker's own amp's — noise at its output (dBu at line level: 25 dB SPL from a speaker). */
export const AMP_NOISE_DBU = -85
/** A Guitar Amp's hiss and hum (dBu at line level: 40 dB SPL). */
export const GUITAR_AMP_NOISE_DBU = -76

/**
 * Cards with no power of their own add no noise: a transformer, a resistor, a switch, a pan pot, a
 * passive speaker. Sources bring their own noise (NOISE_BELOW).
 */
const PASSIVE = new Set<TypeKey>(['mic', 'line-in', 'instrument', 'generator', 'di-box', 'pad', 'switch', 'relay', 'pan', 'speaker'])

/** Each powered card's output noise (the Gain and the converters are worked out below). */
const OUTPUT_NOISE: Partial<Record<TypeKey, number>> = {
  hpf: LINE_NOISE_DBU, eq: LINE_NOISE_DBU, 'graphic-eq': LINE_NOISE_DBU,
  comp: LINE_NOISE_DBU, 'noise-gate': LINE_NOISE_DBU, limiter: LINE_NOISE_DBU, deesser: LINE_NOISE_DBU,
  fader: LINE_NOISE_DBU,
  'master-bus': BUS_NOISE_DBU, 'aux-bus': BUS_NOISE_DBU, 'matrix-bus': BUS_NOISE_DBU,
  amp: AMP_NOISE_DBU, 'active-speaker': AMP_NOISE_DBU, headphones: AMP_NOISE_DBU,
  'guitar-amp': GUITAR_AMP_NOISE_DBU,
}

/** A card's own noise: before its gain (`in`) and after its job (`out`), each in its side's units (−∞: none). */
export interface OwnNoise {
  in: number
  out: number
}

const QUIET: OwnNoise = { in: -Infinity, out: -Infinity }

/**
 * The noise this card adds (D18). None with nothing plugged in, none from a passive card, none
 * working digitally (32-bit float processing adds none) — but the converters: an ADC adds its own
 * on its digital side (dBFS), a DAC on its analog side (dBu: the same 112 dB under its full scale).
 */
export function ownNoiseOf(node: SignalNode, ctx: Pick<SideContext, 'domain' | 'preamp' | 'fed'>): OwnNoise {
  if (!ctx.fed || PASSIVE.has(node.typeKey)) return QUIET
  if (node.typeKey === 'dac') return ctx.domain === 'digital' ? { in: -Infinity, out: CONVERTER_NOISE_DBFS + param(node, 'alignmentDb') } : QUIET
  if (ctx.domain === 'digital') return QUIET
  if (node.typeKey === 'adc') return { in: -Infinity, out: CONVERTER_NOISE_DBFS }
  if (node.typeKey === 'gain') return { in: ctx.preamp ? PREAMP_EIN_DBU : TRIM_INPUT_NOISE_DBU, out: GAIN_FLOOR_DBU }
  return { in: -Infinity, out: OUTPUT_NOISE[node.typeKey] ?? -Infinity }
}

/** `s` with a noise at `db` added to its noise (as powers). */
const withNoise = (s: SideLevels, db: number): SideLevels => {
  if (!isFinite(db)) return s
  // Written out, not spread: every powered card on every change
  const noise = isFinite(s.noise) ? 10 * Math.log10(Math.pow(10, s.noise / 10) + Math.pow(10, db / 10)) : db
  return { peak: s.peak, rms: s.rms, noise, hum: s.hum }
}

/** What a card works on: `input` with the noise it adds before its gain (only a Gain adds any). */
function withInputNoise(node: SignalNode, input: SideLevels, ctx: SideContext): SideLevels {
  return withNoise(input, ownNoiseOf(node, ctx).in)
}

/** What leaves a card: its result with its own output noise — none from a card that sends nothing (a blocked one). */
export function withOutputNoise(node: SignalNode, result: SideResult, ctx: SideContext): SideLevels {
  return result.condition === undefined ? withNoise(result.out, ownNoiseOf(node, ctx).out) : result.out
}

/**
 * Peaks no stage can pass are flattened at the clip level (+20 dBu) or the digital ceiling (0 dBFS):
 * the gap between peak and average shrinks — that is the distortion — and turning down later does
 * not bring it back. A peak is never below the average.
 */
export function flattenPeaks(s: SideLevels, domain: SignalDomain): SideLevels {
  const peak = Math.max(s.rms, Math.min(s.peak, ceilingOf(domain)))
  return peak === s.peak ? s : { peak, rms: s.rms, noise: s.noise, hum: s.hum }
}

// ── Dynamics ─────────────────────────────────────────────────────────────────
// What a compressor, noise gate or limiter does to a level: the level out and how far it turned the
// signal down. The cards draw their curves from the same functions (TransferCurve), and every
// reading goes through them on its own: the peaks, the average and the noise in the pauses.

export interface Dynamics {
  out: number
  gainReductionDb: number
}

/** Level in (dBu / dBFS) → what leaves. */
export type Transfer = (input: number) => Dynamics

/** Above the threshold, every `ratio` dB in comes out as 1 dB; then the makeup gain lifts it all. */
export const compressor = (thresholdDb: number, ratio: number, makeupGainDb: number): Transfer => (input) => {
  const gainReductionDb = input > thresholdDb ? (input - thresholdDb) * (1 - 1 / ratio) : 0
  return { out: input - gainReductionDb + makeupGainDb, gainReductionDb }
}

/**
 * Closed (below the threshold): turned down by the Range (−80 dB ≈ silence). Hold, Attack and
 * Release are shown on the card but are timings, not part of this level math.
 */
export const noiseGate = (thresholdDb: number, rangeDb: number): Transfer => (input) => {
  const open = input >= thresholdDb
  return { out: open ? input : input + rangeDb, gainReductionDb: open || !isFinite(input) ? 0 : -rangeDb }
}

/** Nothing gets above the ceiling; then the makeup gain lifts it all. */
export const limiter = (ceilingDb: number, makeupGainDb: number): Transfer => (input) =>
  ({ out: Math.min(input, ceilingDb) + makeupGainDb, gainReductionDb: Math.max(0, input - ceilingDb) })

/**
 * How far below a speaking voice's average its "s" sounds reach (dB): the number engine's guess,
 * for the moment before a render measures it (audio/processors.ts turns the sibilant band down
 * for real — on a singing voice, with hardly any "s", far less).
 */
export const SIBILANCE_BELOW_DB = 6

/**
 * 8:1 on the sibilant frequencies above its threshold: they are a small part of the sound, so the
 * signal as a whole hardly changes; the gain reduction is the sibilance's.
 */
export const deesser = (thresholdDb: number): Transfer => (input) =>
  ({ out: input, gainReductionDb: Math.max(0, (input - SIBILANCE_BELOW_DB - thresholdDb) * (1 - 1 / 8)) })

/**
 * A filter's level change, worked out once per setting: it samples the whole frequency range, and
 * every change of the graph asks again. A card's params are replaced, never changed in place, so
 * they key it.
 */
const levelChanges = new WeakMap<object, Map<string, number>>()
function levelChange(node: SignalNode, key: string, work: () => number): number {
  let known = levelChanges.get(node.params)
  if (!known) levelChanges.set(node.params, known = new Map())
  let db = known.get(key)
  if (db === undefined) known.set(key, db = work())
  return db
}

/** What one type does to one channel (`input` already carries the card's own hiss). */
type Process = (node: SignalNode, input: SideLevels, ctx: SideContext) => SideResult

const pass    = (levels: SideLevels, ctx: SideContext): SideResult => ({ out: levels, domain: ctx.domain })
const blocked = (condition: StageCondition, domain: SignalDomain): SideResult => ({ out: SILENT, domain, condition })

/** Every reading through a level curve on its own: the peaks, the average and the noise (the dots on a card's curve). */
export const throughCurve = (curve: Transfer, input: SideLevels): SideLevels => eachReading((k) => curve(input[k]).out)

/** Every reading through a level curve; the gain reduction shown is the average's. */
const dynamics = (curve: Transfer, input: SideLevels, ctx: SideContext): SideResult => ({
  out: throughCurve(curve, input),
  domain: ctx.domain,
  gainReductionDb: curve(input.rms).gainReductionDb,
})

/** A bus cannot add analog and digital signals together. */
const summing = (process: Process): Process => (node, input, ctx) =>
  ctx.mixedDomains ? blocked('domainMixedBus', ctx.domain) : process(node, input, ctx)

/** Amplifiers and speakers cannot take a digital signal. */
const analogOnly = (condition: StageCondition, process: Process): Process => (node, input, ctx) =>
  ctx.domain === 'digital' ? blocked(condition, ctx.domain) : process(node, input, ctx)

/** A card whose job is a gain (signal/gains.ts): every reading moved by it. */
const gained: Process = (node, input, ctx) => pass(shifted(input, gainDbOf(node, ctx)!), ctx)

const busFader: Process = summing(gained)

/** A source with a level of its own (Line Input, Instrument, Generator): its sound at that level. */
const source = (node: SignalNode, typeKey: Exclude<Source, 'mic'>): SideResult =>
  ({ out: sourceLevels(param(node, 'levelDb'), soundOf(typeKey, node.params)), domain: 'analog' })

/** An Active Speaker, or Headphones (the same, amplifier built in): its Volume. */
const poweredSpeaker: Process = analogOnly('digitalToSpeaker', gained)

/** What each type does to one channel (every type has one: a new type without it does not compile). */
const PROCESS: Record<TypeKey, Process> = {
  // On its own it picks up a voice or drums, as loud as they reach it (AT_THE_MIC_DB) — the room and
  // its own hiss stay at its usual level's; in front of a Guitar Amp, it hears what the amp plays
  // (silent when the amp is), and the room on top
  mic: (node, input, ctx) => {
    const usual = param(node, 'sensitivityDb')
    const sound = soundOf('mic', node.params)
    const own   = { ...sourceLevels(usual + loudnessOf(node), sound), noise: usual - sound.noiseDb }
    if (!ctx.fed) return { out: own, domain: 'analog' }
    const heard = shifted(input, usual - GUITAR_REF_DB)
    return { out: { ...heard, noise: sumNoiseToDb([heard.noise, own.noise]) }, domain: 'analog' }
  },
  'line-in':    (node) => source(node, 'line-in'),
  instrument:   (node) => source(node, 'instrument'),
  generator:    (node) => source(node, 'generator'),
  // XLR Out: down to mic level. The Direct Out passes on what arrives (the engine sends it there).
  'di-box':     (node, input, ctx) => ({ out: shifted(input, gainDbOf(node, ctx)!), domain: 'analog' }),
  'guitar-amp': analogOnly('digitalToSpeaker', gained),
  // A gain that stops at the clip level — after an ADC, at 0 dBFS
  gain: (node, input, ctx) => {
    const gainDb = gainDbOf(node, ctx)!
    return pass(eachReading((k) => Math.min(input[k] + gainDb, ceilingOf(ctx.domain))), ctx)
  },
  amp: analogOnly('digitalToAmp', gained),
  hpf: (node, input, ctx) =>
    pass(shifted(input, levelChange(node, 'hpf', () => hpfLevelChange(param(node, 'cutoffHz')))), ctx),
  eq: (node, input, ctx) =>
    pass(shifted(input, levelChange(node, 'eq', () => eqLevelChange(param(node, 'bands')))), ctx),
  'graphic-eq': (node, input, ctx) => {
    // In stereo the right side has its own sliders (geqBandDb)
    const side = ctx.side === 'r' ? 'r' : 'l'
    const db = levelChange(node, side, () => graphicEqLevelChange(GEQ_CENTERS.map((_, i) => geqBandDb(node, side, i))))
    return pass(shifted(input, db), ctx)
  },
  comp: (node, input, ctx) =>
    dynamics(compressor(param(node, 'thresholdDb'), param(node, 'ratio'), param(node, 'makeupGainDb')), input, ctx),
  'noise-gate': (node, input, ctx) => dynamics(noiseGate(param(node, 'thresholdDb'), param(node, 'rangeDb')), input, ctx),
  limiter: (node, input, ctx) => dynamics(limiter(param(node, 'thresholdDb'), param(node, 'makeupGainDb')), input, ctx),
  deesser: (node, input, ctx) => dynamics(deesser(param(node, 'thresholdDb')), input, ctx),
  pad:    gained,
  fader:  gained,
  switch: gained,
  relay:  gained,
  // Pan / Balance spread the signal over L / R in the engine (panSides, balanceSides)
  pan:    (_, input, ctx) => pass(input, ctx),
  adc: (node, input, ctx) => {
    if (ctx.domain === 'digital') return blocked('adcExpectsAnalog', 'digital')
    return { out: shifted(input, gainDbOf(node, ctx)!), domain: 'digital' }
  },
  dac: (node, input, ctx) => {
    if (ctx.domain === 'analog') return blocked('dacExpectsDigital', 'analog')
    // Its own noise is added on its analog side (ownNoiseOf)
    return { out: shifted(input, gainDbOf(node, ctx)!), domain: 'analog' }
  },
  'master-bus':      busFader,
  'aux-bus':         busFader,
  'matrix-bus':      busFader,
  // Only runs with an amplifier before it (the engine checks); otherwise it is silent
  speaker: analogOnly('digitalToSpeaker', gained),
  'active-speaker': poweredSpeaker,
  headphones:       poweredSpeaker,
}

/**
 * What a card does to one channel before its own output noise: its input noise added, its job done
 * (linked stereo dynamics take the change from here — signal/chain.ts).
 */
export function processJob(node: SignalNode, input: SideLevels, ctx: SideContext): SideResult {
  return PROCESS[node.typeKey](node, withInputNoise(node, input, ctx), ctx)
}

/**
 * One channel of `node` with `input` arriving (dBu, or dBFS after an ADC). A bus gets everything
 * plugged into it already added up. The card adds its input noise, does its job, adds its output
 * noise (D18), and flattens the peaks it cannot pass.
 */
export function processSide(node: SignalNode, input: SideLevels, ctx: SideContext): SideResult {
  const result = processJob(node, input, ctx)
  return { ...result, out: flattenPeaks(withOutputNoise(node, result, ctx), result.domain) }
}

/** Pan knob (0 = full left, 50 = centre, 100 = full right): equal-power, −3 dB each side at centre. */
export function panSides(position: number, input: number): { l: number; r: number } {
  const ratio = position / 100
  // A side turned fully off is silent (−∞), not a tiny number
  const side = (g: number) => (isFinite(input) && g > 1e-6 ? input + 20 * Math.log10(g) : -Infinity)
  return { l: side(Math.cos(ratio * Math.PI / 2)), r: side(Math.sin(ratio * Math.PI / 2)) }
}

/**
 * Balance knob (the Pan node fed a stereo wire): 0 = full left, 50 = centre, 100 = full right.
 * Unlike pan, the centre is unity on both sides; turning one way only fades the other side.
 */
export function balanceSides(position: number, inL: number, inR: number): { l: number; r: number } {
  const pos = position / 100
  const leftGainLin  = pos <= 0.5 ? 1 : 1 - (pos - 0.5) * 2
  const rightGainLin = pos >= 0.5 ? 1 : pos * 2
  return {
    l: isFinite(inL) && leftGainLin  > 0 ? inL + 20 * Math.log10(leftGainLin)  : -Infinity,
    r: isFinite(inR) && rightGainLin > 0 ? inR + 20 * Math.log10(rightGainLin) : -Infinity,
  }
}
