import type { SignalNode, SignalEdge } from '../data/nodeRegistry'
import { NODE_REGISTRY, MATRIX_PORT, MIX_PORT } from '../data/nodeRegistry'
import type { GraphView } from './graph'
import { getPorts } from './queries'
import { pickChainColor } from '../utils/chainColors'

// Pure edits of the graph: each takes a graph and gives the new one. The store runs the result
// through commitGraph (signalStore.ts), which settles the L / R takeovers (utils/mainFader.ts).

let lastStamp = 0

/** A wire with a fresh id: the time, made unique when several wires are made in the same millisecond. */
export function newEdge(wire: Omit<SignalEdge, 'id'>): SignalEdge {
  lastStamp = Math.max(Date.now(), lastStamp + 1)
  return { ...wire, id: `e-${wire.source}-${wire.target}-${lastStamp}` }
}

/** The graph with these elements (and wires) added; a source without a colour starts a chain of its own colour. */
export function withNodes(graph: GraphView, added: SignalNode[], addedEdges: SignalEdge[] = []): GraphView {
  let nodes = graph.nodes
  for (const n of added) {
    const isSource = NODE_REGISTRY[n.typeKey]?.category === 'source'
    nodes = [...nodes, isSource && !n.color ? { ...n, color: pickChainColor(nodes) } : n]
  }
  return { nodes, edges: addedEdges.length > 0 ? [...graph.edges, ...addedEdges] : graph.edges }
}

/** The graph without these elements and their wires. */
export function withoutNodes(graph: GraphView, nodeIds: Iterable<string>): GraphView {
  const gone = new Set(nodeIds)
  return {
    nodes: graph.nodes.filter((n) => !gone.has(n.id)),
    edges: graph.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)),
  }
}

/**
 * The graph without one element: if it had exactly one wire in and one out, they are joined, so the
 * chain stays connected — unless that wire would go from a card back into itself (the element sat in
 * a loop of two cards, A → it → A).
 */
export function withoutNode(graph: GraphView, nodeId: string): GraphView {
  const next = withoutNodes(graph, [nodeId])
  const into = graph.edges.filter((e) => e.target === nodeId)
  const out  = graph.edges.filter((e) => e.source === nodeId)
  if (into.length !== 1 || out.length !== 1 || into[0].source === out[0].target) return next
  const bridge = newEdge({
    source: into[0].source, sourceHandle: into[0].sourceHandle,
    target: out[0].target,  targetHandle: out[0].targetHandle,
  })
  return { nodes: next.nodes, edges: [...next.edges, bridge] }
}

/**
 * The graph with `node` added in the middle of a wire: the wire is replaced by one into the
 * node's first input and one from its first output. Unchanged if the wire is gone.
 */
export function withNodeOnWire(graph: GraphView, node: SignalNode, edgeId: string): GraphView {
  const wire = graph.edges.find((e) => e.id === edgeId)
  if (!wire) return graph
  const ports = getPorts(node)
  const added = withNodes(graph, [node])
  return {
    nodes: added.nodes,
    edges: [
      ...graph.edges.filter((e) => e.id !== edgeId),
      newEdge({ source: wire.source, sourceHandle: wire.sourceHandle, target: node.id, targetHandle: ports.inputs[0].id }),
      newEdge({ source: node.id, sourceHandle: ports.outputs[0].id, target: wire.target, targetHandle: wire.targetHandle }),
    ],
  }
}

/** The graph with these elements moved to new positions. */
export function withPositions(graph: GraphView, moves: Map<string, { x: number; y: number }>): GraphView {
  if (moves.size === 0) return graph
  return {
    nodes: graph.nodes.map((n) => {
      const position = moves.get(n.id)
      return position ? { ...n, position } : n
    }),
    edges: graph.edges,
  }
}

/**
 * The graph with an element's Mono / Stereo switch set (Line In, Aux Bus); null when nothing
 * changes. Inputs never change. Only a bus splits its output: Mono → Stereo moves 'out' to 'out-l'
 * (into a Matrix Bus it then becomes the Matrix send); Stereo → Mono moves 'out-l', 'out-r', the
 * Matrix send and a Main Fader's 'mix' back to 'out'.
 */
export function withStereo(graph: GraphView, nodeId: string, on: boolean): GraphView | null {
  const node = graph.nodes.find((n) => n.id === nodeId)
  if (!node || NODE_REGISTRY[node.typeKey]?.stereo !== 'optional') return null
  if ((node.params.stereo === true) === on) return null

  const updated = { ...node, params: { ...node.params, stereo: on } }
  const outIds  = new Set(getPorts(updated).outputs.map((p) => p.id))

  function remap(portId: string): string | null {
    if (outIds.has(portId)) return portId
    if (on) return outIds.has(`${portId}-l`) ? `${portId}-l` : null
    const base = portId === MIX_PORT || portId === MATRIX_PORT ? 'out' : portId.replace(/-[lr]$/, '')
    return outIds.has(base) ? base : null
  }

  const edges: SignalEdge[] = []
  for (const e of graph.edges) {
    let next = e
    if (e.source === nodeId) {
      const h = remap(e.sourceHandle)
      if (!h) continue
      next = { ...next, sourceHandle: h }
    }
    // Left and right wires to the same input collapse into one — keep one
    const dup = edges.some((x) =>
      x.source === next.source && x.sourceHandle === next.sourceHandle &&
      x.target === next.target && x.targetHandle === next.targetHandle)
    if (!dup) edges.push(next)
  }

  return { nodes: graph.nodes.map((n) => (n.id === nodeId ? updated : n)), edges }
}
