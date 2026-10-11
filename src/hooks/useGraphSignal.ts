import { useSignalStore } from '../store/signalStore'
import type { SignalChainStore } from '../store/signalStore'
import { graphSignal } from '../signal/engine'
import type { GraphSignalResult, StageResult, WireSignal } from '../signal/engine'
import { SIGNAL_LEVEL, atLeast } from '../data/levels'

/** Beginner's picture: no signal is worked out there (D20) — the cards and wires read none. */
const NO_SIGNAL: GraphSignalResult = { stages: {}, wires: new Map(), hums: new Map() }

/**
 * The signal at every card and on every wire (graphSignal: the number engine's, the last render's
 * readings put in) — none below SIGNAL_LEVEL: Beginner works nothing out (D20, graph/reach.ts).
 * For store selectors.
 */
export function signalIn(s: Pick<SignalChainStore, 'nodes' | 'edges' | 'measured' | 'complexityLevel'>): GraphSignalResult {
  return atLeast(s.complexityLevel, SIGNAL_LEVEL) ? graphSignal(s.nodes, s.edges, s.measured) : NO_SIGNAL
}

/**
 * The signal at every card and on every wire, worked out once per change of the graph (and of the
 * readings measured on real sound). Redraws the caller on every change: cards use useStage /
 * useWire, which redraw only when their part changed.
 */
export function useGraphSignal(): GraphSignalResult {
  return useSignalStore(signalIn)
}

/** One card's result (undefined: not worked out — in a loop, being removed, or at Beginner). */
export function useStage(nodeId: string): StageResult | undefined {
  return useSignalStore((s) => signalIn(s).stages[nodeId])
}

/** What one output sends; `key` is its outputKey (graph/graph.ts). */
export function useWire(key: string): WireSignal | undefined {
  return useSignalStore((s) => signalIn(s).wires.get(key))
}
