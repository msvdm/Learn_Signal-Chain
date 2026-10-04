import type { SignalNode } from '../data/nodeRegistry'
import { MULTI_WIRE_TYPES, param } from '../data/nodeRegistry'
import type { SignalDomain } from './levels'
import { CLIP_DBU } from './levels'
import { GEQ_CENTERS, eqLevelChange, graphicEqLevelChange, hpfLevelChange } from './eqMath'

// What each card does to the level of one channel (the engine, signal/engine.ts, runs it once per
// side in stereo). Simplified on purpose: it teaches the idea, not the filter maths.

/**
 * Why a card sends nothing out (or, for `blown`, far too much). The names are the locale keys of
 * the note the card shows (`warnings.*`, `nodes.speaker.needsAmp`, `nodes.activeSpeaker.blown`).
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

/** Dynamics that run "linked" in stereo: the louder side decides, both sides get the same change. */
export const LINKED_DYNAMICS = new Set(['comp', 'limiter', 'deesser', 'noise-gate'])

/**
 * One channel of `node` with `input` arriving (dBu, or dBFS after an ADC). A bus or the audio
 * interface gets everything plugged into it already added up.
 */
export function processSide(node: SignalNode, input: number, ctx: SideContext): SideResult {
  const { domain } = ctx // most nodes pass domain through unchanged
  const out = (level: number): SideResult => ({ out: level, domain })
  const blocked = (condition: StageCondition, d = domain): SideResult => ({ out: -Infinity, domain: d, condition })

  // Domain mismatch in bus nodes — cannot sum analog and digital signals
  if (ctx.mixedDomains && (MULTI_WIRE_TYPES.has(node.typeKey) || node.typeKey === 'audio-interface')) {
    return blocked('domainMixedBus')
  }

  // Amp and speakers cannot process digital signals
  if (domain === 'digital' && (node.typeKey === 'amp' || node.typeKey === 'speaker' || node.typeKey === 'active-speaker')) {
    return blocked(node.typeKey === 'amp' ? 'digitalToAmp' : 'digitalToSpeaker')
  }

  switch (node.typeKey) {
    case 'mic':
      return { out: param(node, 'sensitivityDb'), domain: 'analog' }
    case 'line-in':
    case 'instrument':
      return { out: param(node, 'levelDb'), domain: 'analog' }
    case 'di-box':
      // Passive DI: impedance conversion only, no level change. Both outputs carry same signal.
      return { out: input, domain: 'analog' }
    case 'gain': {
      // Preamp: lifts a microphone up to line level. Gain: turns any signal up or down.
      if (ctx.preamp) return out(Math.min(input + param(node, 'preampDb'), CLIP_DBU))
      const gainDb = param(node, 'gainDb')
      return out(gainDb <= GAIN_OFF_DB ? -Infinity : Math.min(input + gainDb, CLIP_DBU))
    }
    case 'amp': {
      // Only turns down (−∞…0 dB): fully left = off. In stereo each side has its own channel
      // (a two-channel amp): Left uses gainDb, Right gainDbR (until turned, it follows gainDb).
      const raw    = ctx.side === 'r' ? (param(node, 'gainDbR') ?? param(node, 'gainDb')) : param(node, 'gainDb')
      const gainDb = Math.min(raw, 0)
      return out(gainDb <= GAIN_OFF_DB ? -Infinity : input + gainDb)
    }
    case 'hpf':
      return out(input + hpfLevelChange(param(node, 'cutoffHz')))
    case 'eq':
      return out(input + eqLevelChange(param(node, 'bands')))
    case 'graphic-eq': {
      // In stereo the right side has its own sliders (r0…r30); untouched, they copy the left
      const gains = GEQ_CENTERS.map((_, i) => {
        const left = param(node, `b${i}`)
        return ctx.side === 'r' ? (param(node, `r${i}`) ?? left) : left
      })
      return out(input + graphicEqLevelChange(gains))
    }
    case 'comp': {
      const threshold = param(node, 'thresholdDb')
      const ratio     = param(node, 'ratio')
      const gainReductionDb = input > threshold ? (input - threshold) * (1 - 1 / ratio) : 0
      return { out: input - gainReductionDb + param(node, 'makeupGainDb'), domain, gainReductionDb }
    }
    case 'noise-gate': {
      // Closed (below the threshold): turned down by the Range (−80 dB ≈ silence). Hold, Attack and
      // Release are shown on the card but are timings, not part of this level math.
      const range = param(node, 'rangeDb')
      const open  = input >= param(node, 'thresholdDb')
      const gainReductionDb = open || !isFinite(input) ? 0 : -range
      return { out: open ? input : input + range, domain, gainReductionDb }
    }
    case 'limiter': {
      const ceiling = param(node, 'thresholdDb')
      const gainReductionDb = Math.max(0, input - ceiling)
      return { out: Math.min(input, ceiling) + param(node, 'makeupGainDb'), domain, gainReductionDb }
    }
    case 'deesser': {
      // 8:1 ratio on sibilant frequencies — simplified to overall level reduction
      const gainReductionDb = Math.max(0, (input - param(node, 'thresholdDb')) * (1 - 1 / 8))
      return { out: input - gainReductionDb, domain, gainReductionDb }
    }
    case 'pad':
      return out(param(node, 'engaged') ? input - 20 : input)
    case 'fader':
      return out(input + param(node, 'faderDb'))
    case 'switch':
      return out(param(node, 'on') ? input : -Infinity)
    case 'master-bus':
    case 'aux-bus':
    case 'matrix-bus':
      return out(isFinite(input) ? input + param(node, 'faderDb') : -Infinity)
    case 'audio-interface':
      return out(input)
    case 'adc': {
      if (domain === 'digital') return blocked('adcExpectsAnalog', 'digital')
      // Unity (0 dBu) lands at −18 dBFS, leaving headroom up to the digital ceiling (0 dBFS)
      return { out: isFinite(input) ? input - param(node, 'alignmentDb') : -Infinity, domain: 'digital' }
    }
    case 'dac': {
      if (domain === 'analog') return blocked('dacExpectsDigital', 'analog')
      return { out: isFinite(input) ? input + param(node, 'alignmentDb') : -Infinity, domain: 'analog' }
    }
    case 'speaker':
      // Only runs with an amplifier before it (the engine checks); otherwise it is silent
      return out(input + param(node, 'outputTrimDb'))
    case 'active-speaker':
      return out(isFinite(input) ? input + param(node, 'volumeDb') : -Infinity)
    default:
      // The Relay passes on its selected input (the engine hands it only that one)
      return out(input)
  }
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
