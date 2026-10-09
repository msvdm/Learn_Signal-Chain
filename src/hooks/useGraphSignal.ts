import { useSignalStore } from '../store/signalStore'
import { graphSignal } from '../signal/engine'
import type { GraphSignalResult, StageResult, WireSignal } from '../signal/engine'

/**
 * The signal at every card and on every wire, worked out once per change of the graph (and of the
 * readings measured on real sound). Redraws the caller on every change: cards use useStage /
 * useWire, which redraw only when their part changed.
 */
export function useGraphSignal(): GraphSignalResult {
  const nodes    = useSignalStore((s) => s.nodes)
  const edges    = useSignalStore((s) => s.edges)
  const measured = useSignalStore((s) => s.measured)
  return graphSignal(nodes, edges, measured)
}

/** One card's result (undefined: not worked out — in a loop, or being removed). */
export function useStage(nodeId: string): StageResult | undefined {
  return useSignalStore((s) => graphSignal(s.nodes, s.edges, s.measured).stages[nodeId])
}

/** What one output sends; `key` is its outputKey (graph/graph.ts). */
export function useWire(key: string): WireSignal | undefined {
  return useSignalStore((s) => graphSignal(s.nodes, s.edges, s.measured).wires.get(key))
}
