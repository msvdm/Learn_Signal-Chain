import { useMemo, useState } from 'react'
import type { Edge, Node as FlowNode, NodeChange } from '@xyflow/react'
import { useSignalStore } from '../store/signalStore'
import type { SignalNode, SignalEdge } from '../store/signalStore'
import { getPorts } from '../graph/queries'
import { healthColor, humStrength } from '../signal/levels'
import { SOUND_PORT, portRows } from '../data/nodeRegistry'
import { healthOf } from '../signal/engine'
import { nodeDims, portPoint, recordMeasuredSize } from '../utils/layoutHelpers'
import type { Box } from '../utils/geometry'
import { wirePassesThroughNode } from '../utils/wireValidation'
import { chainOfEdge } from '../graph/chainColors'
import type { ChainEdgeData } from '../components/ChainEdge'
import { useGraphSignal } from './useGraphSignal'
import { keepSame } from '../utils/sameShape'

// Wire width in overview (normal: 3), so wires stay visible when the whole chain fits on screen
const OVERVIEW_WIRE_WIDTH = 8

type MeasuredSize = { width: number; height: number; ports: string }

// What React Flow was handed last time: a card or wire that comes out the same is handed over as the
// same object, and React Flow does not redraw it (one canvas, so one of each)
const lastFlowNodes = new Map<string, FlowNode>()
const lastFlowEdges = new Map<string, Edge>()

/**
 * What a card's outputs are (a stereo Aux's L / R, a bus or fader taken over by a Main Fader …;
 * inputs never change). When this changes, React Flow must re-read the ports.
 */
function portLayoutKey(node: SignalNode, nodes: SignalNode[], edges: SignalEdge[]): string {
  return getPorts(node, { nodes, edges }).outputs.map((p) => p.id).join(',')
}

/**
 * The store's graph as React Flow draws it: nodes (selected, dimmed, with their measured size)
 * and wires (coloured by the level they carry). `keepSizes` takes the sizes React Flow measures.
 */
export function useFlowElements() {
  const graphNodes       = useSignalStore((s) => s.nodes)
  const graphEdges       = useSignalStore((s) => s.edges)
  const selectedNodeIds  = useSignalStore((s) => s.selectedNodeIds)
  const highlightEdgeIds = useSignalStore((s) => s.highlightEdgeIds)
  const overview         = useSignalStore((s) => s.overview)
  const { stages, wires, hums } = useGraphSignal()
  // React Flow's measured card sizes, handed back with the nodes
  const [measuredSizes, setMeasuredSizes] = useState<Record<string, MeasuredSize>>({})

  /** Size bookkeeping (positions stay owned by the store: a drag commits on release). */
  function keepSizes(changes: NodeChange[]) {
    const { nodes, edges } = useSignalStore.getState()
    const sizes: Record<string, MeasuredSize> = {}
    for (const c of changes) {
      if (c.type !== 'dimensions' || !c.dimensions) continue
      const node = nodes.find((n) => n.id === c.id)
      if (!node) continue
      recordMeasuredSize(node.typeKey, c.dimensions.width, c.dimensions.height)
      sizes[c.id] = { ...c.dimensions, ports: portLayoutKey(node, nodes, edges) }
    }
    if (Object.keys(sizes).length > 0) setMeasuredSizes((prev) => ({ ...prev, ...sizes }))
  }

  // While wires are pointed at (unplug list, Matrix Bus row), their chains stay lit and the rest dims
  const highlight = useMemo(() => {
    const chains = graphEdges.filter((e) => highlightEdgeIds.includes(e.id)).map((e) => chainOfEdge(e, graphEdges))
    if (chains.length === 0) return null
    return {
      nodeIds: new Set(chains.flatMap((c) => [...c.nodeIds])),
      edgeIds: new Set(chains.flatMap((c) => [...c.edgeIds])),
    }
  }, [highlightEdgeIds, graphEdges])

  // These objects are rebuilt on every store change; the ones that come out the same are swapped
  // back for last time's (keepSame), so React Flow redraws only the cards that changed. A rebuilt
  // card is handed over with its `measured` size: without it React Flow hides the card until it is
  // measured again on the next frame, and a click in that gap lands on the pane (a knob drag would
  // pan the canvas instead). A card whose ports changed is left unmeasured on purpose, so React Flow
  // re-reads its ports.
  const nodes: FlowNode[] = useMemo(
    () => keepSame(lastFlowNodes,
      graphNodes.map((node) => {
        const size = measuredSizes[node.id]
        return {
          id:        node.id,
          type:      node.typeKey,
          position:  node.position,
          measured:  size && size.ports === portLayoutKey(node, graphNodes, graphEdges)
            ? { width: size.width, height: size.height }
            : undefined,
          selected:  selectedNodeIds.includes(node.id),
          className: highlight && !highlight.nodeIds.has(node.id) ? 'lsc-dimmed' : undefined,
          data:      {},
        }
      })),
    [graphNodes, graphEdges, selectedNodeIds, highlight, measuredSizes]
  )

  const edges: Edge[] = useMemo(() => {
    const graph = { nodes: graphNodes, edges: graphEdges }
    const cards: Box[] = graphNodes.map((n) => {
      const size = measuredSizes[n.id]
      return { id: n.id, position: n.position, size: nodeDims(n.typeKey, size?.width, size?.height) }
    })

    /** The wire runs through another card, as it is drawn: port, corners (if any), port — as its preview did. */
    function crossesCard(edge: SignalEdge): boolean {
      const src = cards.find((c) => c.id === edge.source)
      const tgt = cards.find((c) => c.id === edge.target)
      const srcNode = graphNodes.find((n) => n.id === edge.source)
      const tgtNode = graphNodes.find((n) => n.id === edge.target)
      if (!src || !tgt || !srcNode || !tgtNode) return false
      const outs = getPorts(srcNode, graph).outputs
      const ins  = getPorts(tgtNode, graph).inputs
      // Each port on its own line (a port's row, else its place)
      const out  = portRows(outs)[outs.findIndex((p) => p.id === edge.sourceHandle)] ?? 0
      const inp  = portRows(ins)[ins.findIndex((p) => p.id === edge.targetHandle)] ?? 0
      const points = [portPoint(src, 'source', out), ...(edge.waypoints ?? []), portPoint(tgt, 'target', inp)]
      return wirePassesThroughNode(points, cards, [edge.source, edge.target])
    }

    return keepSame(lastFlowEdges, graphEdges.map((edge): Edge => {
      const sourceStage = stages[edge.source]
      const key         = `${edge.source}:${edge.sourceHandle}`
      // Clipping from the peaks, the rest from the average — as the card it leaves
      const health      = sourceStage ? healthOf(wires.get(key) ?? sourceStage.out, sourceStage.domain) : null
      const color       = health ? healthColor(health) : 'var(--lsc-border)'

      // A Guitar Amp's sound into a microphone travels through the air: crossing a card is fine
      const sound          = edge.sourceHandle === SOUND_PORT
      const humDb          = hums.get(key)
      const routingWarning = !sound && crossesCard(edge)

      const data: ChainEdgeData = {
        waypoints: edge.waypoints, routingWarning, stereo: wires.get(key)?.kind === 'stereo', overview, sound,
        hum: humDb === undefined ? undefined : humStrength(humDb),
      }
      // A send into a Matrix Bus has its own colour
      const toMatrix = graphNodes.find((n) => n.id === edge.target)?.typeKey === 'matrix-bus'

      return {
        id:           edge.id,
        source:       edge.source,
        sourceHandle: edge.sourceHandle,
        target:       edge.target,
        targetHandle: edge.targetHandle,
        type:         'chain',
        animated:     false,
        style:        {
          stroke: sound ? 'var(--lsc-fg-muted)' : toMatrix ? 'var(--lsc-matrix-send)' : color,
          strokeWidth: overview ? OVERVIEW_WIRE_WIDTH : 3,
          opacity: highlight && !highlight.edgeIds.has(edge.id) ? 0.15 : 1,
          transition: 'opacity 0.15s',
        },
        data,
      }
    }))
  }, [graphEdges, stages, wires, hums, graphNodes, highlight, overview, measuredSizes])

  return { nodes, edges, keepSizes }
}
