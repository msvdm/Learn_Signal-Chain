import { useMemo, useState } from 'react'
import type { Edge, Node as FlowNode, NodeChange } from '@xyflow/react'
import { useSignalStore } from '../store/signalStore'
import type { SignalNode, SignalEdge } from '../store/signalStore'
import { graphOf, outputKey } from '../graph/graph'
import { drawnPorts, outputKind } from '../graph/queries'
import { isUsbReturn, isUsbWire } from '../graph/usbLink'
import { wireFlows } from '../graph/wireFlow'
import type { WireFlow } from '../graph/wireFlow'
import { reachIn } from '../graph/reach'
import { humStrength } from '../signal/levels'
import { SOUND_PORT } from '../data/nodeRegistry'
import { SIGNAL_LEVEL, atLeast } from '../data/levels'
import type { ComplexityLevel } from '../data/levels'
import type { NodePort } from '../data/nodeRegistry'
import { healthOf, levelOf, outDomainOf } from '../signal/engine'
import { nodeDims, recordMeasuredSize, wireRoute } from '../utils/layoutHelpers'
import type { Box } from '../utils/geometry'
import { routeCrossesCards } from '../utils/wireValidation'
import { chainOfEdge } from '../graph/chainColors'
import type { ChainEdgeData } from '../components/ChainEdge'
import { useGraphSignal } from './useGraphSignal'
import { keepSame } from '../utils/sameShape'

// Wire width in overview (normal: 3), so wires stay visible when the whole chain fits on screen
const OVERVIEW_WIRE_WIDTH = 8

/** A wire's colour by where its sound goes (D24) */
const FLOW_COLOR: Record<WireFlow, string> = {
  main:   'var(--lsc-wire-main)',
  aux:    'var(--lsc-wire-aux)',
  matrix: 'var(--lsc-wire-matrix)',
  pfl:    'var(--lsc-wire-pfl)',
  record: 'var(--lsc-wire-record)',
}

/** A card's size as React Flow measured it, and the outputs it had then */
type MeasuredSize = { width: number; height: number; outputs: NodePort[] }

// What React Flow was handed last time: a card or wire that comes out the same is handed over as the
// same object, and React Flow does not redraw it (one canvas, so one of each)
const lastFlowNodes = new Map<string, FlowNode>()
const lastFlowEdges = new Map<string, Edge>()

/**
 * A card's outputs (a stereo Aux's L / R, a bus or fader taken over by a Main Fader …; inputs never
 * change): the same array while they stay the same (getPorts). When they change, React Flow must
 * re-read the ports.
 */
function outputsOf(node: SignalNode, nodes: SignalNode[], edges: SignalEdge[], level: ComplexityLevel): NodePort[] {
  return drawnPorts(node, level, { nodes, edges }).outputs
}

/**
 * The store's graph as React Flow draws it: nodes (selected, dimmed, with their measured size)
 * and wires (coloured by where their sound goes, red where it clips; at Beginner one colour,
 * flowing where their sound reaches an end point — D20). `keepSizes` takes the sizes React Flow measures.
 */
export function useFlowElements() {
  const graphNodes       = useSignalStore((s) => s.nodes)
  const graphEdges       = useSignalStore((s) => s.edges)
  const selectedNodeIds  = useSignalStore((s) => s.selectedNodeIds)
  const highlightEdgeIds = useSignalStore((s) => s.highlightEdgeIds)
  const overview         = useSignalStore((s) => s.overview)
  // Beginner works no signal out (D20): where the sound goes is all it shows
  const level            = useSignalStore((s) => s.complexityLevel)
  const beginner         = !atLeast(level, SIGNAL_LEVEL)
  const { stages, wires, hums } = useGraphSignal()
  // React Flow's measured card sizes, handed back with the nodes
  const [measuredSizes, setMeasuredSizes] = useState<Record<string, MeasuredSize>>({})

  /** Size bookkeeping (positions stay owned by the store: a drag commits on release). */
  function keepSizes(changes: NodeChange[]) {
    const { nodes, edges, complexityLevel, overview } = useSignalStore.getState()
    const sizes: Record<string, MeasuredSize> = {}
    for (const c of changes) {
      if (c.type !== 'dimensions' || !c.dimensions) continue
      const node = nodes.find((n) => n.id === c.id)
      if (!node) continue
      recordMeasuredSize(node.typeKey, c.dimensions.width, c.dimensions.height, complexityLevel, overview)
      sizes[c.id] = { ...c.dimensions, outputs: outputsOf(node, nodes, edges, complexityLevel) }
    }
    if (Object.keys(sizes).length > 0) setMeasuredSizes((prev) => ({ ...prev, ...sizes }))
  }

  // While wires are pointed at (unplug list, Matrix Bus row), their chains stay lit and the rest dims
  const highlight = useMemo(() => {
    const chains = graphEdges.filter((e) => highlightEdgeIds.includes(e.id)).map((e) => chainOfEdge(e, graphEdges, graphNodes))
    if (chains.length === 0) return null
    return {
      nodeIds: new Set(chains.flatMap((c) => [...c.nodeIds])),
      edgeIds: new Set(chains.flatMap((c) => [...c.edgeIds])),
    }
  }, [highlightEdgeIds, graphEdges, graphNodes])

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
          measured:  size && size.outputs === outputsOf(node, graphNodes, graphEdges, level)
            ? { width: size.width, height: size.height }
            : undefined,
          selected:  selectedNodeIds.includes(node.id),
          className: highlight && !highlight.nodeIds.has(node.id) ? 'lsc-dimmed' : undefined,
          data:      {},
        }
      })),
    [graphNodes, graphEdges, selectedNodeIds, highlight, measuredSizes, level]
  )

  const edges: Edge[] = useMemo(() => {
    const graph = { nodes: graphNodes, edges: graphEdges }
    const cards: Box[] = graphNodes.map((n) => {
      const size = measuredSizes[n.id]
      return { id: n.id, position: n.position, size: nodeDims(n.typeKey, size?.width, size?.height) }
    })

    /** The wire runs through another card, as it is drawn: port, corners (if any), port — as its preview did. */
    function crossesCard(edge: SignalEdge): boolean {
      const route = wireRoute(edge, cards, graph, level)
      return route !== null && routeCrossesCards(route, cards, [edge.source, edge.target])
    }

    const flows = beginner ? null : wireFlows(graph)
    const reach = beginner ? reachIn(graph) : null
    const wiring = graphOf(graph)
    // A USB wire's way back is not drawn: the USB wire carries both ways (graph/usbLink.ts)
    return keepSame(lastFlowEdges, graphEdges.filter((edge) => !isUsbReturn(edge)).map((edge): Edge => {
      const sourceStage = stages[edge.source]
      const key         = outputKey(edge.source, edge.sourceHandle)
      const signal      = sourceStage && (wires.get(key) ?? sourceStage.out)
      // Its colour is where its sound goes (D24); red where it clips (from the peaks, as the card it
      // leaves — red is kept for problems); grey while it carries nothing. At Beginner one colour.
      const health      = signal ? healthOf(signal, outDomainOf(sourceStage, edge.sourceHandle)) : null
      const color       = reach ? 'var(--lsc-wire-neutral)'
        : health === 'clipping' ? 'var(--signal-clipping)'
        : !signal || !isFinite(levelOf(signal)) ? 'var(--lsc-border)'
        : FLOW_COLOR[flows?.get(edge.id) ?? 'main']

      // A Guitar Amp's sound into a microphone travels through the air: crossing a card is fine
      const sound          = edge.sourceHandle === SOUND_PORT
      const humDb          = hums.get(key)
      const routingWarning = !sound && crossesCard(edge)

      const data: ChainEdgeData = {
        waypoints: edge.waypoints, routingWarning, overview, sound,
        // Beginner: what the wiring makes of the output (no signal is worked out there)
        stereo: (reach ? outputKind(edge.source, edge.sourceHandle, graph) : wires.get(key)?.kind) === 'stereo',
        hum: humDb === undefined ? undefined : humStrength(humDb),
        twoWay: isUsbWire(edge, wiring),
        still: reach !== null && !reach.flowing.has(edge.id),
      }
      return {
        id:           edge.id,
        source:       edge.source,
        sourceHandle: edge.sourceHandle,
        target:       edge.target,
        targetHandle: edge.targetHandle,
        type:         'chain',
        animated:     false,
        style:        {
          stroke: sound && !reach ? 'var(--lsc-fg-muted)' : color,
          strokeWidth: overview ? OVERVIEW_WIRE_WIDTH : 3,
          opacity: highlight && !highlight.edgeIds.has(edge.id) ? 0.15 : 1,
          transition: 'opacity 0.15s',
        },
        data,
      }
    }))
  }, [graphEdges, stages, wires, hums, graphNodes, highlight, overview, measuredSizes, beginner, level])

  return { nodes, edges, keepSizes }
}
