import type { Route, SignalNode, SignalEdge, TypeKey } from '../data/nodeRegistry'
import { NODE_REGISTRY, param, passesThrough } from '../data/nodeRegistry'

// The graph with lookups, and the walks every query is built from (graph/queries.ts).

/** The cards and the wires between them. */
export type GraphView = { nodes: SignalNode[]; edges: SignalEdge[] }

/** The output port a wire is drawn from. */
export interface WireSource {
  nodeId: string
  handleId: string
}

/** An output's key: what the engine's `wires` (what each output sends) are keyed by. */
export function outputKey(nodeId: string, portId: string): string {
  return `${nodeId}:${portId}`
}

/** The card an output key belongs to (a port id never holds ':'). */
export function nodeOfOutput(key: string): string {
  return key.slice(0, key.lastIndexOf(':'))
}

/** The port of an output key. */
export function portOfOutput(key: string): string {
  return key.slice(key.lastIndexOf(':') + 1)
}

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

/**
 * Every card and wire upstream of `nodeId` (the card itself included). Given the cards (`nodes`),
 * through a card of several paths only the one the signal comes out of (NodeTypeDef `routes`):
 * what an Audio Interface plays back never came from what it records.
 */
export function upstreamOf(nodeId: string, edges: SignalEdge[], nodes?: SignalNode[]): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const { into } = wireIndex(edges)
  const byId     = nodes && nodeIndex(nodes)
  /** A card's paths, when it has several */
  const routesOf = (id: string) => {
    const node = byId?.get(id)
    return node && NODE_REGISTRY[node.typeKey].routes
  }
  /** The wires into a card that feed its output `port` (every wire: a card of one path, or the card we start from) */
  const feeding = (id: string, port: string | null) => {
    const wires  = into.get(id) ?? NO_WIRES
    const routes = port === null ? undefined : routesOf(id)
    if (!routes) return wires
    const from = routes.find((r) => r.to.includes(port!))?.from
    return from ? wires.filter((e) => e.targetHandle === from) : NO_WIRES
  }
  const nodeIds = new Set<string>([nodeId])
  const edgeIds = new Set<string>()
  // A card of several paths is walked once per output the signal leaves on, any other card once
  const walked  = new Set<string>([nodeId])
  const queue: [string, string | null][] = [[nodeId, null]]
  while (queue.length > 0) {
    const [id, port] = queue.shift()!
    for (const e of feeding(id, port)) {
      edgeIds.add(e.id)
      nodeIds.add(e.source)
      const step = routesOf(e.source) ? `${e.source}:${e.sourceHandle}` : e.source
      if (walked.has(step)) continue
      walked.add(step)
      queue.push([e.source, e.sourceHandle])
    }
  }
  return { nodeIds, edgeIds }
}

/** True when a card of type `typeKey` is anywhere before this one (an amplifier before a speaker). */
export function fedBy(nodeId: string, typeKey: TypeKey, view: GraphView): boolean {
  const graph = graphOf(view)
  for (const id of upstreamOf(nodeId, view.edges, view.nodes).nodeIds) {
    if (id !== nodeId && graph.node(id)?.typeKey === typeKey) return true
  }
  return false
}

/**
 * One path through a card: the whole card (every input into every output), or one of its routes
 * (NodeTypeDef `routes`: an Audio Interface records and plays back on two paths that never meet).
 */
export interface CardPath {
  node: SignalNode
  route?: Route
}

const WHOLE: readonly (Route | undefined)[] = [undefined]

/** A card's paths: one per route, or the whole card. */
export function pathsOf(node: SignalNode): CardPath[] {
  return (NODE_REGISTRY[node.typeKey].routes ?? WHOLE).map((route) => ({ node, route }))
}

/** The wires a path works on: those into its route's input (none for one making its own sound), or every wire in. */
export function wiresInto(path: CardPath, graph: Graph): readonly SignalEdge[] {
  const into = graph.into(path.node.id)
  const { route } = path
  return route ? into.filter((e) => e.targetHandle === route.from) : into
}

/** Does this path send on output `port`? */
export function pathSends(path: CardPath, port: string): boolean {
  return !path.route || path.route.to.includes(port)
}

/**
 * Paths in the order the signal flows through them: each after everything that feeds it — so a
 * card's paths that never meet can sit apart (an Audio Interface's recording after its playback,
 * when what it plays back goes into the desk it records). Paths ready at the same time keep their
 * cards' order in the graph. Paths in a loop, and everything after one, are left out.
 */
export function flowPaths(view: GraphView): CardPath[] {
  const graph = graphOf(view)
  const paths = view.nodes.flatMap(pathsOf)
  // The path each routed input feeds (keyed like an output: card and port)
  const reading = new Map<string, CardPath>()
  for (const p of paths) {
    if (p.route?.from) reading.set(outputKey(p.node.id, p.route.from), p)
  }
  const whole   = new Map(paths.filter((p) => !p.route).map((p) => [p.node.id, p]))
  const feeding = (e: SignalEdge) => reading.get(outputKey(e.target, e.targetHandle)) ?? whole.get(e.target)

  const waiting = new Map<CardPath, number>()
  for (const p of paths) waiting.set(p, wiresInto(p, graph).filter((e) => graph.node(e.source)).length)
  const ready  = paths.filter((p) => waiting.get(p) === 0)
  const sorted: CardPath[] = []
  while (ready.length > 0) {
    const path = ready.shift()!
    sorted.push(path)
    for (const e of graph.from(path.node.id)) {
      if (!pathSends(path, e.sourceHandle)) continue
      const next = feeding(e)
      if (!next) continue
      const remaining = waiting.get(next)! - 1
      waiting.set(next, remaining)
      if (remaining === 0) ready.push(next)
    }
  }
  return sorted
}
