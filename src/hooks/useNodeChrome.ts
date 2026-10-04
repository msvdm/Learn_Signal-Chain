import { useSignalStore } from '../store/signalStore'
import type { TypeKey } from '../data/nodeRegistry'
import { getPorts } from '../graph/queries'
import { nodeAcceptsWire } from '../utils/connectionRules'
import { chainColorsOf } from '../utils/chainColors'

/**
 * What the shell around an element's controls shows (NodeWrapper, FreeControl): its ports, the
 * colours of the chains passing through it, whether it is selected (or its help is open), and
 * whether the wire being drawn could land on it. Re-renders on every change of the graph — the
 * ports and chains are read from the wires.
 */
export function useNodeChrome(nodeId: string, typeKey: TypeKey) {
  const nodes      = useSignalStore((s) => s.nodes)
  const edges      = useSignalStore((s) => s.edges)
  const wireSource = useSignalStore((s) => s.wire?.source ?? null)
  const selected   = useSignalStore((s) => s.selectedNodeIds.includes(nodeId) || s.activeTooltipId === nodeId)
  const overview   = useSignalStore((s) => s.overview)
  // (Gone for the moment the card is drawn while being removed)
  const node       = nodes.find((n) => n.id === nodeId)

  return {
    node,
    ports:    getPorts(node ?? { typeKey, params: {} }, { nodes, edges }),
    /** Colours of the chains (sources) passing through, in a stable order */
    chains:   chainColorsOf(nodeId, nodes, edges),
    selected,
    overview,
    /** A wire is being drawn and this element can take it */
    wireTarget: wireSource !== null && node !== undefined && nodeAcceptsWire(node, wireSource, edges, nodes),
  }
}
