import { useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import { useSignalStore } from '../store/signalStore'
import type { NodePort, TypeKey } from '../data/nodeRegistry'
import { graphOf } from '../graph/graph'
import { getPorts } from '../graph/queries'
import { nodeAcceptsWire } from '../utils/connectionRules'
import { chainColorsOf } from '../utils/chainColors'

/** A card's port ids as one string ("in|out-l,out-r"), so "did they change?" is one comparison. */
const portLayout = (ports: { inputs: NodePort[]; outputs: NodePort[] }) =>
  `${ports.inputs.map((p) => p.id).join(',')}|${ports.outputs.map((p) => p.id).join(',')}`

const toPorts = (ids: string): NodePort[] => (ids === '' ? [] : ids.split(',').map((id) => ({ id })))

/**
 * What the shell around an element's controls shows (NodeWrapper, FreeControl): its ports, the
 * colours of the chains passing through it, whether it is selected (or its help is open), and
 * whether the wire being drawn could land on it. Each part is read on its own, so the shell is
 * redrawn only when one of them changes — not on every change of the graph.
 */
export function useNodeChrome(nodeId: string, typeKey: TypeKey) {
  // (Gone for the moment the card is drawn while being removed)
  const node     = useSignalStore((s) => graphOf(s).node(nodeId))
  // The outputs follow the wiring (a bus's L / R taken over by its Main Fader …)
  const layout   = useSignalStore((s) => portLayout(getPorts(graphOf(s).node(nodeId) ?? { typeKey, params: {} }, s)))
  const ports    = useMemo(() => {
    const [inputs, outputs] = layout.split('|')
    return { inputs: toPorts(inputs), outputs: toPorts(outputs) }
  }, [layout])
  /** Colours of the chains (sources) passing through, in a stable order */
  const chains   = useSignalStore(useShallow((s) => chainColorsOf(nodeId, s.nodes, s.edges)))
  const selected = useSignalStore((s) => s.selectedNodeIds.includes(nodeId) || s.help?.nodeId === nodeId)
  const overview = useSignalStore((s) => s.overview)
  /** A wire is being drawn and this element can take it */
  const wireTarget = useSignalStore((s) => {
    if (s.wire === null) return false
    const n = graphOf(s).node(nodeId)
    return n !== undefined && nodeAcceptsWire(n, s.wire.source, s.edges, s.nodes)
  })

  return { node, ports, chains, selected, overview, wireTarget }
}
