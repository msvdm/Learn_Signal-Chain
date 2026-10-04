import type { SignalNode, SignalEdge } from '../data/nodeRegistry'
import { param, passesThrough } from '../data/nodeRegistry'

// The graph with lookups, and the walks every query is built from (graph/queries.ts).

/** The cards and the wires between them. */
export type GraphView = { nodes: SignalNode[]; edges: SignalEdge[] }

/** A graph that can look up a card and the wires into / out of it without scanning. */
export interface Graph extends GraphView {
  node(id: string): SignalNode | undefined
  /** Wires into a card, in wire order */
  into(id: string): readonly SignalEdge[]
  /** Wires out of a card, in wire order */
  from(id: string): readonly SignalEdge[]
}

type WireIndex = { into: Map<string, SignalEdge[]>; from: Map<string, SignalEdge[]> }

// The store replaces its arrays on every change and never edits them, so each index is built
// once per change and shared by every query on it.
const nodeIndexes = new WeakMap<SignalNode[], Map<string, SignalNode>>()
const wireIndexes = new WeakMap<SignalEdge[], WireIndex>()
const NO_WIRES: readonly SignalEdge[] = []

function nodeIndex(nodes: SignalNode[]): Map<string, SignalNode> {
  let index = nodeIndexes.get(nodes)
  if (!index) {
    index = new Map(nodes.map((n) => [n.id, n]))
    nodeIndexes.set(nodes, index)
  }
  return index
}

function wireIndex(edges: SignalEdge[]): WireIndex {
  let index = wireIndexes.get(edges)
  if (!index) {
    index = { into: new Map(), from: new Map() }
    for (const e of edges) {
      const into = index.into.get(e.target)
      if (into) into.push(e)
      else index.into.set(e.target, [e])
      const from = index.from.get(e.source)
      if (from) from.push(e)
      else index.from.set(e.source, [e])
    }
    wireIndexes.set(edges, index)
  }
  return index
}

/** The graph with lookups (built once per change of its arrays). */
export function graphOf({ nodes, edges }: GraphView): Graph {
  const byId = nodeIndex(nodes)
  const { into, from } = wireIndex(edges)
  return {
    nodes, edges,
    node: (id) => byId.get(id),
    into: (id) => into.get(id) ?? NO_WIRES,
    from: (id) => from.get(id) ?? NO_WIRES,
  }
}

/**
 * The wire a one-input card works on: the Relay's selected input, the first wire in for any other
 * card. Undefined when nothing is plugged in there.
 */
export function drivingWire(node: SignalNode, graph: Graph): SignalEdge | undefined {
  const into = graph.into(node.id)
  if (node.typeKey !== 'relay') return into[0]
  const port = `in-${param(node, 'selectedInput')}`
  return into.find((e) => e.targetHandle === port)
}

/**
 * Walks back up the chain from a card, one wire at a time: yields the wire into it and the card that
 * wire comes from, then carries on through that card while it is a one-input effect (passesThrough —
 * an EQ, a compressor, a pad, a fader …). Ends at a card that is not, where nothing is plugged in,
 * or where the chain loops. The caller stops it as soon as it finds what it looks for.
 */
export function* walkPassthrough(
  nodeId: string,
  view: GraphView,
): Generator<{ wire: SignalEdge; source: SignalNode }> {
  const graph = graphOf(view)
  const seen  = new Set([nodeId])
  let cur = nodeId
  for (;;) {
    const wire   = graph.into(cur)[0]
    const source = wire && graph.node(wire.source)
    if (!source) return
    yield { wire, source }
    if (seen.has(source.id) || !passesThrough(source.typeKey)) return
    seen.add(source.id)
    cur = source.id
  }
}

/** Every card and wire upstream of `nodeId` (the card itself included). */
export function upstreamOf(nodeId: string, edges: SignalEdge[]): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const { into } = wireIndex(edges)
  const nodeIds  = new Set<string>([nodeId])
  const edgeIds  = new Set<string>()
  const queue    = [nodeId]
  while (queue.length > 0) {
    for (const e of into.get(queue.shift()!) ?? NO_WIRES) {
      if (edgeIds.has(e.id)) continue
      edgeIds.add(e.id)
      if (!nodeIds.has(e.source)) {
        nodeIds.add(e.source)
        queue.push(e.source)
      }
    }
  }
  return { nodeIds, edgeIds }
}

/** True when a card of type `typeKey` is anywhere before this one (an amplifier before a speaker). */
export function fedBy(nodeId: string, typeKey: string, view: GraphView): boolean {
  const graph = graphOf(view)
  for (const id of upstreamOf(nodeId, view.edges).nodeIds) {
    if (id !== nodeId && graph.node(id)?.typeKey === typeKey) return true
  }
  return false
}

/**
 * Cards in the order the signal flows through them: each after everything that feeds it.
 * `first` picks between cards that are ready at the same time (default: their order in the graph).
 * Cards in a loop, and everything after one, are left out.
 */
export function flowOrder(view: GraphView, first?: (a: SignalNode, b: SignalNode) => number): SignalNode[] {
  const graph    = graphOf(view)
  const inDegree = new Map<string, number>()
  for (const n of view.nodes) {
    inDegree.set(n.id, graph.into(n.id).filter((e) => graph.node(e.source)).length)
  }
  const ready  = view.nodes.filter((n) => inDegree.get(n.id) === 0)
  const sorted: SignalNode[] = []
  if (first) ready.sort(first)
  while (ready.length > 0) {
    const node = ready.shift()!
    sorted.push(node)
    for (const e of graph.from(node.id)) {
      const target = graph.node(e.target)
      if (!target) continue
      const remaining = inDegree.get(target.id)! - 1
      inDegree.set(target.id, remaining)
      if (remaining === 0) ready.push(target)
    }
    if (first) ready.sort(first)
  }
  return sorted
}

/**
 * Cards in signal-flow order for the help popover's Previous / Next: sources first, each after
 * everything that feeds it; ties (and loops, at the end) go left to right, then top to bottom.
 */
export function chainOrder(view: GraphView): SignalNode[] {
  const byPosition = (a: SignalNode, b: SignalNode) =>
    a.position.x - b.position.x || a.position.y - b.position.y
  const ordered = flowOrder(view, byPosition)
  const placed  = new Set(ordered.map((n) => n.id))
  return [...ordered, ...[...view.nodes].sort(byPosition).filter((n) => !placed.has(n.id))]
}
