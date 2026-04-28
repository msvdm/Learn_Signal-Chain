import type { ComplexityLevel } from '../store/signalStore'
import type { SignalNode, SignalEdge } from './nodeRegistry'

export type BusType = 'aux' | 'fx' | 'pfl' | 'matrix'

// ── Default graph ─────────────────────────────────────────────────────────────
// App starts as a blank canvas — user builds chains freely from the palette.

export function buildDefaultGraph(_level: ComplexityLevel): { nodes: SignalNode[]; edges: SignalEdge[] } {
  return { nodes: [], edges: [] }
}
