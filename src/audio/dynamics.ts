import type { SignalNode } from '../data/nodeRegistry'
import { isDynamics, param } from '../data/nodeRegistry'
import type { DynamicsSettings } from './processors'
import { DEESSER_ATTACK_MS, DEESSER_RELEASE_MS, LIMITER_RELEASE_MS } from './processors'

// What the render on real sound knows of each dynamics card (Compressor, Noise Gate, Limiter,
// De-esser): its knobs as its processor takes them (audio/processors.ts), how long it takes to
// settle, and its makeup gain — one row per type, so a new dynamics type fails to compile until it
// has all three.

type DynamicsType = DynamicsSettings['type']

interface DynamicsCard {
  /** Its knobs, as its processor takes them */
  settings: (node: SignalNode) => DynamicsSettings
  /** How long it takes to forget where it started (s): seven times its slowest time (a gate: and its Hold) */
  settleS: (node: SignalNode) => number
  /** Its makeup gain (dB): it lifts everything after turning it down */
  makeupDb: (node: SignalNode) => number
}

const slowest = (attackMs: number, releaseMs: number) => 7 * Math.max(attackMs, releaseMs) / 1000

export const DYNAMICS: Record<DynamicsType, DynamicsCard> = {
  comp: {
    settings: (node) => ({
      type: 'comp', thresholdDb: param(node, 'thresholdDb'), ratio: param(node, 'ratio'),
      attackMs: param(node, 'attackMs'), releaseMs: param(node, 'releaseMs'), makeupDb: param(node, 'makeupGainDb'),
    }),
    settleS:  (node) => slowest(param(node, 'attackMs'), param(node, 'releaseMs')),
    makeupDb: (node) => param(node, 'makeupGainDb'),
  },
  'noise-gate': {
    settings: (node) => ({
      type: 'noise-gate', thresholdDb: param(node, 'thresholdDb'), rangeDb: param(node, 'rangeDb'),
      holdMs: param(node, 'holdMs'), attackMs: param(node, 'attackMs'), releaseMs: param(node, 'releaseMs'),
    }),
    settleS:  (node) => param(node, 'holdMs') / 1000 + slowest(param(node, 'attackMs'), param(node, 'releaseMs')),
    makeupDb: () => 0,
  },
  limiter: {
    settings: (node) => ({ type: 'limiter', thresholdDb: param(node, 'thresholdDb'), makeupDb: param(node, 'makeupGainDb') }),
    settleS:  () => 7 * LIMITER_RELEASE_MS / 1000,
    makeupDb: (node) => param(node, 'makeupGainDb'),
  },
  deesser: {
    settings: (node) => ({ type: 'deesser', thresholdDb: param(node, 'thresholdDb'), frequencyHz: param(node, 'frequencyHz') }),
    settleS:  () => slowest(DEESSER_ATTACK_MS, DEESSER_RELEASE_MS),
    makeupDb: () => 0,
  },
}

/** A dynamics card's row (undefined: not a dynamics card). */
export function dynamicsOf(node: SignalNode): DynamicsCard | undefined {
  return isDynamics(node.typeKey) ? DYNAMICS[node.typeKey as DynamicsType] : undefined
}
