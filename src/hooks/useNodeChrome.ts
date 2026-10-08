import { useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import { useSignalStore } from '../store/signalStore'
import type { NodePort, TypeKey } from '../data/nodeRegistry'
import { graphOf } from '../graph/graph'
import { getPorts, unwiredSource } from '../graph/queries'
import { nodeAcceptsWire } from '../utils/connectionRules'
import { chainColorsOf } from '../utils/chainColors'

/**
 * A card's ports as one string ("in|out-l,out-r"; a port on its own line "in-b@2"), so "did they
 * change?" is one comparison.
 */
const portText   = (p: NodePort) => (p.row === undefined ? p.id : `${p.id}@${p.row}`)
const portLayout = (ports: { inputs: NodePort[]; outputs: NodePort[] }) =>
  `${ports.inputs.map(portText).join(',')}|${ports.outputs.map(portText).join(',')}`

const toPorts = (text: string): NodePort[] => (text === '' ? [] : text.split(',').map((t) => {
  const [id, row] = t.split('@')
  return row === undefined ? { id } : { id, row: Number(row) }
}))

/**
 * What the shell around an element's controls shows (NodeWrapper, FreeControl): its ports, the
 * colours of the chains passing through it, whether it is selected (or its help is open), whether
 * the wire being drawn could land on it, and whether it is a source not connected yet. Each part is
 * read on its own, so the shell is redrawn only when one of them changes — not on every change of
 * the graph.
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
  /** A source with nothing on its output: no level, no readings (D11) */
  const notConnected = useSignalStore((s) => unwiredSource(nodeId, s))

  return { node, ports, chains, selected, overview, wireTarget, notConnected }
}
