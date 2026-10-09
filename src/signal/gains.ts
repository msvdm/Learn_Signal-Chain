import type { SignalNode, TypeKey } from '../data/nodeRegistry'
import { param } from '../data/nodeRegistry'
import type { Side } from './sided'

// What a card whose job is a gain does to a signal: one number of dB (−∞: off), read from its
// knobs. The number engine (signal/process.ts PROCESS) moves every reading by it; the render on
// real sound (audio/chainAudio.ts) plays it as a gain node — both read it from here, and so do
// the cards whose knobs follow the other side (the Amplifier, the Graphic EQ). Pure.

/** A Gain (not a Preamp) or an Amplifier turned all the way down is switched off. */
export const GAIN_OFF_DB = -60

/**
 * A Fader at the bottom of its travel: −∞, the signal muted — its scale ends at −∞, like a
 * meter's (utils/faderTaper.ts). Above it the fader turns down by its setting.
 */
export const FADER_OFF_DB = -100

/** What a Fader set to `db` does to the level: −∞ at the bottom of its travel. */
export const faderGainDb = (db: number) => (db <= FADER_OFF_DB ? -Infinity : db)

/** How far a Pad turns a signal down while it is in (dB). */
export const PAD_DB = 20

/** How far a DI Box's XLR Out brings an instrument down: to mic level, like a passive DI's transformer. */
export const DI_DROP_DB = 20

/**
 * A Guitar Amp's Volume knob goes to 11 — one louder. At 1 it plays a guitar at its usual level
 * 14 dB up (−16 dBu: 100 dB SPL, levels.ts SPL_DB), every step 1.5 dB more, 115 dB SPL at 11; 0 is
 * silent. At 5 (its default) the microphone in front of it gets −40 dBu.
 */
export const GUITAR_AMP_MAX = 11
export function guitarAmpGainDb(volume: number): number {
  return volume <= 0 ? -Infinity : 14 + (volume - 1) * 1.5
}

/** What a gain depends on besides the card's knobs. */
export interface GainContext {
  /** This Gain is a Preamp (after a microphone or a DI Box's XLR Out) */
  preamp: boolean
  side: Side
}

/** Off at the bottom of a Gain's or an Amplifier's knob. */
const offBelow = (db: number) => (db <= GAIN_OFF_DB ? -Infinity : db)

/**
 * An Amplifier's Volume knob for a side (dB): it only turns down (−∞ … 0 dB). In stereo it is a
 * two-channel amp: channel A takes the left side (`gainDb`), B the right (`gainDbR`) — until B is
 * turned it follows A.
 */
export function ampVolumeDb(node: Pick<SignalNode, 'typeKey' | 'params'>, side: Side): number {
  const a = param(node, 'gainDb')
  return Math.min(side === 'r' ? (param(node, 'gainDbR') ?? a) : a, 0)
}

/**
 * A Graphic EQ's slider `band` for a side (dB): mono and the left side use b0…b30, the right side
 * r0…r30 — until they are first touched, they copy the left.
 */
export function geqBandDb(node: Pick<SignalNode, 'typeKey' | 'params'>, side: Side, band: number): number {
  const left = param(node, `b${band}`)
  return side === 'r' ? (param(node, `r${band}`) ?? left) : left
}

/** Every type whose job is a gain, and its gain (dB, −∞: off). */
const GAINS = {
  // Preamp: lifts a microphone up to line level. Gain: turns any signal up or down, off at the bottom
  gain:             (node, at) => (at.preamp ? param(node, 'preampDb') : offBelow(param(node, 'gainDb'))),
  amp:              (node, at) => offBelow(ampVolumeDb(node, at.side)),
  pad:              (node) => (param(node, 'engaged') ? -PAD_DB : 0),
  fader:            (node) => faderGainDb(param(node, 'faderDb')),
  switch:           (node) => (param(node, 'on') ? 0 : -Infinity),
  // The Relay passes on its selected input (the engine hands it only that one)
  relay:            () => 0,
  // Unity (0 dBu) lands at −18 dBFS, leaving headroom up to the digital ceiling (0 dBFS); and back
  adc:              (node) => -param(node, 'alignmentDb'),
  dac:              (node) => param(node, 'alignmentDb'),
  'master-bus':     (node) => param(node, 'faderDb'),
  'aux-bus':        (node) => param(node, 'faderDb'),
  'matrix-bus':     (node) => param(node, 'faderDb'),
  speaker:          (node) => param(node, 'outputTrimDb'),
  'active-speaker': (node) => param(node, 'volumeDb'),
  headphones:       (node) => param(node, 'volumeDb'),
  // What it plays: the guitar turned up by its Volume (0 … 11)
  'guitar-amp':     (node) => guitarAmpGainDb(param(node, 'volume')),
  // Its XLR Out: down to mic level (its Direct Out passes on what arrives)
  'di-box':         () => -DI_DROP_DB,
} satisfies Partial<Record<TypeKey, (node: SignalNode, at: GainContext) => number>>

/** A type whose job is a gain (the rest: sources, filters, dynamics, Pan). */
export type GainType = keyof typeof GAINS

export function isGainType(typeKey: TypeKey): typeKey is GainType {
  return typeKey in GAINS
}

/** A card's gain (dB, −∞: off); undefined for a card whose job is not a gain. */
export function gainDbOf(node: SignalNode, at: GainContext): number | undefined {
  return isGainType(node.typeKey) ? GAINS[node.typeKey](node, at) : undefined
}
