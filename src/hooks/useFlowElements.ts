import { useMemo, useState } from 'react'
import type { Edge, Node as FlowNode, NodeChange } from '@xyflow/react'
import { useSignalStore } from '../store/signalStore'
import type { SignalNode, SignalEdge } from '../store/signalStore'
import { getPorts } from '../graph/queries'
import { getHealth, healthColor } from '../signal/levels'
import { levelOf } from '../signal/engine'
import { recordMeasuredSize } from '../utils/layoutHelpers'
import { wirePassesThroughNode } from '../utils/wireValidation'
import { chainOfEdge } from '../utils/chainColors'
import type { ChainEdgeData } from '../components/ChainEdge'
import { useGraphSignal } from './useGraphSignal'

// Wire width in overview (normal: 3), so wires stay visible when the whole chain fits on screen
const OVERVIEW_WIRE_WIDTH = 8

type MeasuredSize = { width: number; height: number; ports: string }

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
  const { stages, wires } = useGraphSignal()
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

  // These objects are rebuilt on every store change. Without `measured`, React Flow treats each
  // rebuilt node as new: it hides the card until it is measured again on the next frame, and a
  // click in that gap lands on the pane (a knob drag would pan the canvas instead).
  // A card whose ports changed is left unmeasured on purpose, so React Flow re-reads its ports.
  const nodes: FlowNode[] = useMemo(
    () =>
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
          data:      { color: node.color, label: node.label },
        }
      }),
    [graphNodes, graphEdges, selectedNodeIds, highlight, measuredSizes]
  )

  const edges: Edge[] = useMemo(() => {
    const nodesForValidation = graphNodes.map((n) => ({ id: n.id, position: n.position }))

    return graphEdges.map((edge) => {
      const sourceStage = stages[edge.source]
      const key         = `${edge.source}:${edge.sourceHandle}`
      const db          = levelOf(wires.get(key) ?? sourceStage?.out)
      const health      = sourceStage ? getHealth(db, sourceStage.domain) : null
      const color       = health ? healthColor(health) : 'var(--lsc-border)'

      const routingWarning = (edge.waypoints?.length ?? 0) > 0
        ? wirePassesThroughNode(edge.waypoints!, nodesForValidation, [edge.source, edge.target])
        : false

      const data: ChainEdgeData = {
        waypoints: edge.waypoints, routingWarning, stereo: wires.get(key)?.kind === 'stereo', overview,
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
          stroke: toMatrix ? 'var(--lsc-matrix-send)' : color,
          strokeWidth: overview ? OVERVIEW_WIRE_WIDTH : 3,
          opacity: highlight && !highlight.edgeIds.has(edge.id) ? 0.15 : 1,
          transition: 'opacity 0.15s',
        },
        data,
      }
    })
  }, [graphEdges, stages, wires, graphNodes, highlight, overview])

  return { nodes, edges, keepSizes }
}
