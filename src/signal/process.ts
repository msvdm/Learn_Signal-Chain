import type { SignalNode, TypeKey } from '../data/nodeRegistry'
import { param } from '../data/nodeRegistry'
import type { SignalDomain } from './levels'
import { CLIP_DBU } from './levels'
import { GEQ_CENTERS, eqLevelChange, graphicEqLevelChange, hpfLevelChange } from './eqMath'

// What each card does to the level of one channel (the engine, signal/engine.ts, runs it once per
// side in stereo). Simplified on purpose: it teaches the idea, not the filter maths.

/**
 * Why a card sends nothing out (or, for `blown`, far too much). The names are the locale keys of
 * the note the card shows (`warnings.*`, `nodes.speaker.needsAmp`, `nodes.active-speaker.blown`).
 */
export type StageCondition =
  | 'domainMixedBus'    // a bus fed analog and digital signals at once
  | 'digitalToAmp'      // an amplifier fed a digital signal
  | 'digitalToSpeaker'  // a speaker fed a digital signal
  | 'adcExpectsAnalog'  // an ADC fed a digital signal
  | 'dacExpectsDigital' // a DAC fed an analog signal
  | 'needsAmp'          // a passive speaker with no amplifier before it: silent
  | 'blown'             // an active speaker fed from an amplifier: far too strong, it breaks

/** One channel through a card. */
export interface SideResult {
  out: number
  /** Analog (dBu) or digital (dBFS), leaving the card */
  domain: SignalDomain
  /** How far a dynamics card turns the signal down right now */
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
  /** This Gain is a microphone's Preamp */
  preamp: boolean
}

/**
 * How much stronger an amplifier's output (speaker level) is than the line level an active
 * speaker expects. Fed from an amplifier, an active speaker shows at least the clip level.
 */
export const SPEAKER_LEVEL_DB = 40

/** A Gain (not a Preamp) or an Amplifier turned all the way down is switched off. */
export const GAIN_OFF_DB = -60

// ── Dynamics ─────────────────────────────────────────────────────────────────
// What a compressor, noise gate or limiter does to a level: the level out and how far it turned the
// signal down. The cards draw their curves from the same functions (TransferCurve).

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

/** What one type does to one channel. */
type Process = (node: SignalNode, input: number, ctx: SideContext) => SideResult

const pass    = (level: number, ctx: SideContext): SideResult => ({ out: level, domain: ctx.domain })
const blocked = (condition: StageCondition, domain: SignalDomain): SideResult => ({ out: -Infinity, domain, condition })

/** A bus cannot add analog and digital signals together. */
const summing = (process: Process): Process => (node, input, ctx) =>
  ctx.mixedDomains ? blocked('domainMixedBus', ctx.domain) : process(node, input, ctx)

/** Amplifiers and speakers cannot take a digital signal. */
const analogOnly = (condition: StageCondition, process: Process): Process => (node, input, ctx) =>
  ctx.domain === 'digital' ? blocked(condition, ctx.domain) : process(node, input, ctx)

const busFader: Process = summing((node, input, ctx) =>
  pass(isFinite(input) ? input + param(node, 'faderDb') : -Infinity, ctx))

const sourceLevel: Process = (node) => ({ out: param(node, 'levelDb'), domain: 'analog' })

/** What each type does to one channel (every type has one: a new type without it does not compile). */
const PROCESS: Record<TypeKey, Process> = {
  mic:          (node) => ({ out: param(node, 'sensitivityDb'), domain: 'analog' }),
  'line-in':    sourceLevel,
  instrument:   sourceLevel,
  // Passive DI: impedance conversion only, no level change. Both outputs carry same signal.
  'di-box':     (_, input) => ({ out: input, domain: 'analog' }),
  gain: (node, input, ctx) => {
    // Preamp: lifts a microphone up to line level. Gain: turns any signal up or down.
    if (ctx.preamp) return pass(Math.min(input + param(node, 'preampDb'), CLIP_DBU), ctx)
    const gainDb = param(node, 'gainDb')
    return pass(gainDb <= GAIN_OFF_DB ? -Infinity : Math.min(input + gainDb, CLIP_DBU), ctx)
  },
  amp: analogOnly('digitalToAmp', (node, input, ctx) => {
    // Only turns down (−∞…0 dB): fully left = off. In stereo each side has its own channel
    // (a two-channel amp): Left uses gainDb, Right gainDbR (until turned, it follows gainDb).
    const raw    = ctx.side === 'r' ? (param(node, 'gainDbR') ?? param(node, 'gainDb')) : param(node, 'gainDb')
    const gainDb = Math.min(raw, 0)
    return pass(gainDb <= GAIN_OFF_DB ? -Infinity : input + gainDb, ctx)
  }),
  hpf: (node, input, ctx) => pass(input + hpfLevelChange(param(node, 'cutoffHz')), ctx),
  eq:  (node, input, ctx) => pass(input + eqLevelChange(param(node, 'bands')), ctx),
  'graphic-eq': (node, input, ctx) => {
    // In stereo the right side has its own sliders (r0…r30); untouched, they copy the left
    const gains = GEQ_CENTERS.map((_, i) => {
      const left = param(node, `b${i}`)
      return ctx.side === 'r' ? (param(node, `r${i}`) ?? left) : left
    })
    return pass(input + graphicEqLevelChange(gains), ctx)
  },
  comp: (node, input, ctx) => ({
    ...compressor(param(node, 'thresholdDb'), param(node, 'ratio'), param(node, 'makeupGainDb'))(input),
    domain: ctx.domain,
  }),
  'noise-gate': (node, input, ctx) => ({
    ...noiseGate(param(node, 'thresholdDb'), param(node, 'rangeDb'))(input),
    domain: ctx.domain,
  }),
  limiter: (node, input, ctx) => ({
    ...limiter(param(node, 'thresholdDb'), param(node, 'makeupGainDb'))(input),
    domain: ctx.domain,
  }),
  deesser: (node, input, ctx) => {
    // 8:1 ratio on sibilant frequencies — simplified to overall level reduction
    const gainReductionDb = Math.max(0, (input - param(node, 'thresholdDb')) * (1 - 1 / 8))
    return { out: input - gainReductionDb, domain: ctx.domain, gainReductionDb }
  },
  pad:    (node, input, ctx) => pass(param(node, 'engaged') ? input - 20 : input, ctx),
  fader:  (node, input, ctx) => pass(input + param(node, 'faderDb'), ctx),
  switch: (node, input, ctx) => pass(param(node, 'on') ? input : -Infinity, ctx),
  // The Relay passes on its selected input (the engine hands it only that one)
  relay:  (_, input, ctx) => pass(input, ctx),
  // Pan / Balance spread the signal over L / R in the engine (panSides, balanceSides)
  pan:    (_, input, ctx) => pass(input, ctx),
  adc: (node, input, ctx) => {
    if (ctx.domain === 'digital') return blocked('adcExpectsAnalog', 'digital')
    // Unity (0 dBu) lands at −18 dBFS, leaving headroom up to the digital ceiling (0 dBFS)
    return { out: isFinite(input) ? input - param(node, 'alignmentDb') : -Infinity, domain: 'digital' }
  },
  dac: (node, input, ctx) => {
    if (ctx.domain === 'analog') return blocked('dacExpectsDigital', 'analog')
    return { out: isFinite(input) ? input + param(node, 'alignmentDb') : -Infinity, domain: 'analog' }
  },
  'master-bus':      busFader,
  'aux-bus':         busFader,
  'matrix-bus':      busFader,
  // Only runs with an amplifier before it (the engine checks); otherwise it is silent
  speaker: analogOnly('digitalToSpeaker', (node, input, ctx) => pass(input + param(node, 'outputTrimDb'), ctx)),
  'active-speaker': analogOnly('digitalToSpeaker', (node, input, ctx) =>
    pass(isFinite(input) ? input + param(node, 'volumeDb') : -Infinity, ctx)),
}

/**
 * One channel of `node` with `input` arriving (dBu, or dBFS after an ADC). A bus gets everything
 * plugged into it already added up.
 */
export function processSide(node: SignalNode, input: number, ctx: SideContext): SideResult {
  return PROCESS[node.typeKey](node, input, ctx)
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
