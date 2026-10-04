import { useSignalStore } from '../store/signalStore'
import { graphSignal } from '../signal/engine'
import type { GraphSignalResult } from '../signal/engine'

/** The signal at every card and on every wire, worked out once per change of the graph. */
export function useGraphSignal(): GraphSignalResult {
  const nodes = useSignalStore((s) => s.nodes)
  const edges = useSignalStore((s) => s.edges)
  return graphSignal(nodes, edges)
}
