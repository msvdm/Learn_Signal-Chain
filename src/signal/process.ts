import type { Character, GeneratorSound, SignalNode, TypeKey } from '../data/nodeRegistry'
import { param } from '../data/nodeRegistry'
import type { SideLevels, SignalDomain } from './levels'
import { CLIP_DBU, SILENT, ceilingOf, eachReading, shifted, sumNoiseToDb } from './levels'
import { GEQ_CENTERS, eqLevelChange, graphicEqLevelChange, hpfLevelChange } from './eqMath'

// What each card does to one channel (the engine, signal/engine.ts, runs it once per side in
// stereo): to its peaks, its average and its noise (SideLevels). Simplified on purpose: it teaches
// the idea, not the filter maths.

/**
 * Why a card sends nothing out, or what is wrong with what it sends (`blown`: far too much,
 * `needsDi`: a guitar losing its high notes). The names are the locale keys of the note the card
 * shows (`warnings.*`, `nodes.speaker.needsAmp`, `nodes.active-speaker.blown`, `nodes.instrument.needsDi`).
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
  side: 'l' | 'r' | null
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

/** A Gain (not a Preamp) or an Amplifier turned all the way down is switched off. */
export const GAIN_OFF_DB = -60

/** How far a DI Box's XLR Out brings an instrument down: to mic level, like a passive DI's transformer. */
export const DI_DROP_DB = 20

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

/** How far the loudest moments of each kind of sound reach above its average (dB). */
export const PEAKS_ABOVE = {
  /** A voice, keys (a Microphone or Line Input set to Melodic) */
  melodic:    12,
  /** Drums: sharp hits far above the average (set to Percussive) */
  percussive: 18,
  /** A guitar (the Instrument): plucks, sharper than a voice, softer than drums */
  guitar:     15,
  // The Generator's sounds
  /** A steady tone: a sine wave's peaks are 3 dB above its average */
  sine:       3,
  noise:      12,
  /** Short pulses, like a metronome: as far above the average as drums */
  click:      18,
} as const satisfies Record<Character | GeneratorSound | 'guitar', number>

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

/** A source's sound: what it plays (the Generator's Sound, a Melodic / Percussive switch, a guitar) and its own noise. */
export function soundOf(typeKey: Source, params: SignalNode['params']): SourceSound {
  const node = { typeKey, params }
  const kind = typeKey === 'instrument' ? 'guitar'
    : typeKey === 'generator' ? param(node, 'sound')
    : param(node, 'character')
  return { peakDb: PEAKS_ABOVE[kind], noiseDb: NOISE_BELOW[typeKey] }
}

/** A source playing at `level` (its average). */
export function sourceLevels(level: number, sound: SourceSound): SideLevels {
  return { peak: level + sound.peakDb, rms: level, noise: level - sound.noiseDb, hum: -Infinity }
}

/**
 * The hiss a powered card adds to what arrives, before it does its job (so a make-up gain after it
 * lifts it, and a gate can shut it off). A Preamp is built for tiny signals: far quieter.
 */
export const HISS_DBU = -80
export const PREAMP_HISS_DBU = -128

/**
 * Cards with no power of their own add no hiss: a transformer, a resistor, a switch, a pan pot, a
 * passive speaker. Sources bring their own noise (NOISE_BELOW); digital stages add none.
 */
const PASSIVE = new Set<TypeKey>(['mic', 'line-in', 'instrument', 'generator', 'di-box', 'pad', 'switch', 'relay', 'pan', 'speaker'])

/** The hiss this card adds to what arrives (−∞: none). The DAC adds its own on its analog side. */
function hissOf(node: SignalNode, ctx: SideContext): number {
  if (!ctx.fed || ctx.domain === 'digital' || PASSIVE.has(node.typeKey)) return -Infinity
  return ctx.preamp ? PREAMP_HISS_DBU : HISS_DBU
}

/** `s` with a hiss at `db` added to its noise. */
const withHiss = (s: SideLevels, db: number): SideLevels => ({ ...s, noise: sumNoiseToDb([s.noise, db]) })

/**
 * Peaks no stage can pass are flattened at the clip level (+20 dBu) or the digital ceiling (0 dBFS):
 * the gap between peak and average shrinks — that is the distortion — and turning down later does
 * not bring it back. A peak is never below the average.
 */
export function flattenPeaks(s: SideLevels, domain: SignalDomain): SideLevels {
  return { ...s, peak: Math.max(s.rms, Math.min(s.peak, ceilingOf(domain))) }
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

/** 8:1 on the sibilant frequencies above its threshold — simplified to the overall level. */
export const deesser = (thresholdDb: number): Transfer => (input) => {
  const gainReductionDb = Math.max(0, (input - thresholdDb) * (1 - 1 / 8))
  return { out: input - gainReductionDb, gainReductionDb }
}

/** What one type does to one channel (`input` already carries the card's own hiss). */
type Process = (node: SignalNode, input: SideLevels, ctx: SideContext) => SideResult

const pass    = (levels: SideLevels, ctx: SideContext): SideResult => ({ out: levels, domain: ctx.domain })
const blocked = (condition: StageCondition, domain: SignalDomain): SideResult => ({ out: SILENT, domain, condition })

/** Every reading through a level curve; the gain reduction shown is the average's. */
const dynamics = (curve: Transfer, input: SideLevels, ctx: SideContext): SideResult => ({
  out: eachReading((k) => curve(input[k]).out),
  domain: ctx.domain,
  gainReductionDb: curve(input.rms).gainReductionDb,
})

/** A bus cannot add analog and digital signals together. */
const summing = (process: Process): Process => (node, input, ctx) =>
  ctx.mixedDomains ? blocked('domainMixedBus', ctx.domain) : process(node, input, ctx)

/** Amplifiers and speakers cannot take a digital signal. */
const analogOnly = (condition: StageCondition, process: Process): Process => (node, input, ctx) =>
  ctx.domain === 'digital' ? blocked(condition, ctx.domain) : process(node, input, ctx)

const busFader: Process = summing((node, input, ctx) => pass(shifted(input, param(node, 'faderDb')), ctx))

/** A source with a level of its own (Line Input, Instrument, Generator): its sound at that level. */
const source = (node: SignalNode, typeKey: Exclude<Source, 'mic'>): SideResult =>
  ({ out: sourceLevels(param(node, 'levelDb'), soundOf(typeKey, node.params)), domain: 'analog' })

/** A gain that stops at the clip level (−∞ dB: off). */
const gainUpToClip = (input: SideLevels, gainDb: number) => eachReading((k) => Math.min(input[k] + gainDb, CLIP_DBU))

/** What each type does to one channel (every type has one: a new type without it does not compile). */
const PROCESS: Record<TypeKey, Process> = {
  // On its own it picks up a voice (or drums) at its usual level; in front of a Guitar Amp, it
  // hears what the amp plays (silent when the amp is), and the room on top
  mic: (node, input, ctx) => {
    const usual = param(node, 'sensitivityDb')
    const own   = sourceLevels(usual, soundOf('mic', node.params))
    if (!ctx.fed) return { out: own, domain: 'analog' }
    const heard = shifted(input, usual - GUITAR_REF_DB)
    return { out: { ...heard, noise: sumNoiseToDb([heard.noise, own.noise]) }, domain: 'analog' }
  },
  'line-in':    (node) => source(node, 'line-in'),
  instrument:   (node) => source(node, 'instrument'),
  generator:    (node) => source(node, 'generator'),
  // XLR Out: down to mic level. The Direct Out passes on what arrives (the engine sends it there).
  'di-box':     (_, input) => ({ out: shifted(input, -DI_DROP_DB), domain: 'analog' }),
  // What it plays: the guitar turned up or down by its Volume
  'guitar-amp': analogOnly('digitalToSpeaker', (node, input, ctx) => pass(shifted(input, param(node, 'volumeDb')), ctx)),
  gain: (node, input, ctx) => {
    // Preamp: lifts a microphone up to line level. Gain: turns any signal up or down.
    if (ctx.preamp) return pass(gainUpToClip(input, param(node, 'preampDb')), ctx)
    const gainDb = param(node, 'gainDb')
    return pass(gainUpToClip(input, gainDb <= GAIN_OFF_DB ? -Infinity : gainDb), ctx)
  },
  amp: analogOnly('digitalToAmp', (node, input, ctx) => {
    // Only turns down (−∞…0 dB): fully left = off. In stereo each side has its own channel
    // (a two-channel amp): Left uses gainDb, Right gainDbR (until turned, it follows gainDb).
    const raw    = ctx.side === 'r' ? (param(node, 'gainDbR') ?? param(node, 'gainDb')) : param(node, 'gainDb')
    const gainDb = Math.min(raw, 0)
    return pass(shifted(input, gainDb <= GAIN_OFF_DB ? -Infinity : gainDb), ctx)
  }),
  hpf: (node, input, ctx) => pass(shifted(input, hpfLevelChange(param(node, 'cutoffHz'))), ctx),
  eq:  (node, input, ctx) => pass(shifted(input, eqLevelChange(param(node, 'bands'))), ctx),
  'graphic-eq': (node, input, ctx) => {
    // In stereo the right side has its own sliders (r0…r30); untouched, they copy the left
    const gains = GEQ_CENTERS.map((_, i) => {
      const left = param(node, `b${i}`)
      return ctx.side === 'r' ? (param(node, `r${i}`) ?? left) : left
    })
    return pass(shifted(input, graphicEqLevelChange(gains)), ctx)
  },
  comp: (node, input, ctx) =>
    dynamics(compressor(param(node, 'thresholdDb'), param(node, 'ratio'), param(node, 'makeupGainDb')), input, ctx),
  'noise-gate': (node, input, ctx) => dynamics(noiseGate(param(node, 'thresholdDb'), param(node, 'rangeDb')), input, ctx),
  limiter: (node, input, ctx) => dynamics(limiter(param(node, 'thresholdDb'), param(node, 'makeupGainDb')), input, ctx),
  deesser: (node, input, ctx) => dynamics(deesser(param(node, 'thresholdDb')), input, ctx),
  pad:    (node, input, ctx) => pass(param(node, 'engaged') ? shifted(input, -20) : input, ctx),
  fader:  (node, input, ctx) => pass(shifted(input, param(node, 'faderDb')), ctx),
  switch: (node, input, ctx) => pass(param(node, 'on') ? input : SILENT, ctx),
  // The Relay passes on its selected input (the engine hands it only that one)
  relay:  (_, input, ctx) => pass(input, ctx),
  // Pan / Balance spread the signal over L / R in the engine (panSides, balanceSides)
  pan:    (_, input, ctx) => pass(input, ctx),
  adc: (node, input, ctx) => {
    if (ctx.domain === 'digital') return blocked('adcExpectsAnalog', 'digital')
    // Unity (0 dBu) lands at −18 dBFS, leaving headroom up to the digital ceiling (0 dBFS)
    return { out: shifted(input, -param(node, 'alignmentDb')), domain: 'digital' }
  },
  dac: (node, input, ctx) => {
    if (ctx.domain === 'analog') return blocked('dacExpectsDigital', 'analog')
    // Its analog side hisses like any powered card
    const out = shifted(input, param(node, 'alignmentDb'))
    return { out: ctx.fed ? withHiss(out, HISS_DBU) : out, domain: 'analog' }
  },
  'master-bus':      busFader,
  'aux-bus':         busFader,
  'matrix-bus':      busFader,
  // Only runs with an amplifier before it (the engine checks); otherwise it is silent
  speaker: analogOnly('digitalToSpeaker', (node, input, ctx) => pass(shifted(input, param(node, 'outputTrimDb')), ctx)),
  'active-speaker': analogOnly('digitalToSpeaker', (node, input, ctx) => pass(shifted(input, param(node, 'volumeDb')), ctx)),
}

/**
 * One channel of `node` with `input` arriving (dBu, or dBFS after an ADC). A bus gets everything
 * plugged into it already added up. The card adds its hiss to what arrives, does its job, and
 * flattens the peaks it cannot pass.
 */
export function processSide(node: SignalNode, input: SideLevels, ctx: SideContext): SideResult {
  const result = PROCESS[node.typeKey](node, withHiss(input, hissOf(node, ctx)), ctx)
  return { ...result, out: flattenPeaks(result.out, result.domain) }
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
