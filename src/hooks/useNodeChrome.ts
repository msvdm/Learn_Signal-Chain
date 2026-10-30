import { useShallow } from 'zustand/shallow'
import { useSignalStore } from '../store/signalStore'
import type { TypeKey } from '../data/nodeRegistry'
import { graphOf } from '../graph/graph'
import { drawnPorts, unwiredSource } from '../graph/queries'
import { nodeAcceptsWire } from '../graph/connectionRules'

/**
 * What the shell around an element's controls shows (CardFrame, FreeControl): its ports, whether
 * it is selected, whether
 * the wire being drawn could land on it, and whether it is a source not connected yet. Each part is
 * read on its own, so the shell is redrawn only when one of them changes — not on every change of
 * the graph.
 */
export function useNodeChrome(nodeId: string, typeKey: TypeKey) {
  // (Gone for the moment the card is drawn while being removed)
  const node     = useSignalStore((s) => graphOf(s).node(nodeId))
  // The outputs follow the wiring (a bus's L / R taken over by its Main Fader …); a layout is always
  // the same arrays (drawnPorts: the hidden ones left out), so this changes only when the ports do
  const ports    = useSignalStore(useShallow((s) => drawnPorts(graphOf(s).node(nodeId) ?? { typeKey, params: {} }, s.complexityLevel, s)))
  const selected = useSignalStore((s) => s.selectedNodeIds.includes(nodeId))
  const overview = useSignalStore((s) => s.overview)
  /** A wire is being drawn and this element can take it */
  const wireTarget = useSignalStore((s) => {
    if (s.wire === null) return false
    const n = graphOf(s).node(nodeId)
    return n !== undefined && nodeAcceptsWire(n, s.wire.source, s.edges, s.nodes, s.complexityLevel)
  })
  /** A source with nothing on its output: no level, no readings (D11) */
  const notConnected = useSignalStore((s) => unwiredSource(nodeId, s))

  return { node, ports, selected, overview, wireTarget, notConnected }
}

/** What the shell around an element's controls shows (useNodeChrome). */
export type NodeChrome = ReturnType<typeof useNodeChrome>
