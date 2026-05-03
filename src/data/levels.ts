import type { ComplexityLevel } from '../store/signalStore'
import type { SignalNode, SignalEdge } from './nodeRegistry'
import { NODE_REGISTRY } from './nodeRegistry'
import { MASTER_BUS_FLOW_POS } from './zoneConstants'

export type BusType = 'aux' | 'fx' | 'pfl' | 'matrix'

export const MASTER_BUS_DEFAULT_ID = 'master-bus-default'

// ── Default graph ─────────────────────────────────────────────────────────────

export function buildDefaultGraph(level: ComplexityLevel): { nodes: SignalNode[]; edges: SignalEdge[] } {
  if (level === 'beginner') return { nodes: [], edges: [] }

  const def = NODE_REGISTRY['master-bus']
  const masterBus: SignalNode = {
    id:       MASTER_BUS_DEFAULT_ID,
    typeKey:  'master-bus',
    position: MASTER_BUS_FLOW_POS,
    params:   { ...def.defaultParams },
    bypassed: false,
    label:    def.label,
  }
  return { nodes: [masterBus], edges: [] }
}
