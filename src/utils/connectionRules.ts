import type { SignalNode, SignalEdge } from '../data/nodeRegistry'
import type { WireSource } from '../store/signalStore'

// Input limits per node type — enforced when a wire is completed.
// Types not listed (buses, audio interface) accept any number of inputs.
export const INPUT_LIMITS: Record<string, number> = {
  gain: 1, hpf: 1, eq: 1, comp: 1, fader: 1, switch: 1, amp: 1,
  'di-box': 1, 'noise-gate': 1, limiter: 1, deesser: 1, potentiometer: 1,
  pan: 1, adc: 1, dac: 1, 'graphic-eq': 1, speaker: 1, 'active-speaker': 1,
  pad: 1, relay: 2, 'stereo-fader': 2, balance: 2,
}

/** True when a wire from `source` may end on any input of `targetNode`. */
export function nodeAcceptsWire(
  targetNode: Pick<SignalNode, 'id' | 'typeKey'>,
  source: WireSource,
  edges: SignalEdge[],
): boolean {
  if (targetNode.id === source.nodeId) return false
  const limit = INPUT_LIMITS[targetNode.typeKey]
  if (limit === undefined) return true
  return edges.filter((e) => e.target === targetNode.id).length < limit
}

/** True when this specific input port is free (one wire per input). */
export function portIsFree(nodeId: string, handleId: string, edges: SignalEdge[]): boolean {
  return !edges.some((e) => e.target === nodeId && e.targetHandle === handleId)
}
