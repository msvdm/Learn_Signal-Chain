import type { SignalNode, SignalEdge } from './nodeRegistry'

export type BusType = 'aux' | 'fx' | 'pfl' | 'matrix'

// ── Default graph ─────────────────────────────────────────────────────────────

/** Every level starts from a blank canvas — the learner builds the chain. */
export function buildDefaultGraph(): { nodes: SignalNode[]; edges: SignalEdge[] } {
  return { nodes: [], edges: [] }
}
