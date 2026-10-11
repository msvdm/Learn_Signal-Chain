import type { SignalEdge } from '../data/nodeRegistry'
import { NODE_REGISTRY } from '../data/nodeRegistry'
import type { Graph, GraphView } from './graph'
import { graphOf } from './graph'

// Where the sound goes at Beginner (D20): no number engine and no render there — only the wiring
// says which cards a sound reaches and which end points play it. Pure and level-free; the cards
// and wires read it at Beginner (`reachIn`: one answer per change of the graph).

/**
 * What an end point (a speaker, Headphones, a Recorder, Stream / Broadcast) gets: a sound; nothing
 * plugged in; wires, but nothing that makes sound before it; a passive speaker's sound with no
 * Amplifier before it (it cannot play it).
 */
export type Verdict = 'sound' | 'not-connected' | 'no-source' | 'needs-amp'

export interface Reach {
  /** Each card input a sound arrives at (`<card id>:<port>`) */
  arriving: ReadonlySet<string>
  /** The wires carrying a sound */
  carrying: ReadonlySet<string>
  /** The wires whose sound reaches an end point that plays or records it: they flow */
  flowing: ReadonlySet<string>
  /** Each end point's verdict, by card id */
  verdicts: ReadonlyMap<string, Verdict>
}

/** A sound arrives at a card (on `port`; any input when left out). */
export function soundAt(reach: Reach, nodeId: string, port?: string): boolean {
  if (port !== undefined) return reach.arriving.has(`${nodeId}:${port}`)
  for (const key of reach.arriving) if (key.startsWith(`${nodeId}:`)) return true
  return false
}

/**
 * The wires leaving a card that carry what arrives on its input `port` (a card of several paths:
 * that path's — an Audio Interface's line input goes to the computer, not to its line output).
 */
function onward(graph: Graph, id: string, port: string): readonly SignalEdge[] {
  const node   = graph.node(id)
  const routes = node && NODE_REGISTRY[node.typeKey].routes
  if (!routes) return graph.from(id)
  const to = new Set(routes.filter((r) => r.from === port).flatMap((r) => r.to))
  return graph.from(id).filter((e) => to.has(e.sourceHandle))
}

/** The outputs a card makes a sound of its own on: a source's, a DAW's playback (a route from nothing). */
function ownSound(graph: Graph, id: string): readonly SignalEdge[] {
  const node = graph.node(id)
  if (!node) return []
  const def = NODE_REGISTRY[node.typeKey]
  if (def.routes) {
    const to = new Set(def.routes.filter((r) => r.from === null).flatMap((r) => r.to))
    return graph.from(id).filter((e) => to.has(e.sourceHandle))
  }
  return def.category === 'source' ? graph.from(id) : []
}

/** Where the sound goes: every card it reaches, each end point's verdict, the wires that flow. */
export function reachOf(view: GraphView): Reach {
  const graph    = graphOf(view)
  const arriving = new Set<string>()
  const carrying = new Set<string>()
  /** Wires carrying a sound that went through an Amplifier: what a passive speaker plays */
  const amplified = new Set<string>()

  // From every sound, along the wires (each wire once, and once more if it turns out amplified)
  const seen  = new Set<string>()
  const queue: { wire: SignalEdge; amped: boolean }[] = view.nodes.flatMap((n) => ownSound(graph, n.id).map((wire) => ({ wire, amped: false })))
  while (queue.length > 0) {
    const { wire, amped } = queue.pop()!
    const key = amped ? `${wire.id}+` : wire.id
    if (seen.has(key)) continue
    seen.add(key)
    carrying.add(wire.id)
    if (amped) amplified.add(wire.id)
    arriving.add(`${wire.target}:${wire.targetHandle}`)
    const ampsIt = amped || graph.node(wire.target)?.typeKey === 'amp'
    for (const next of onward(graph, wire.target, wire.targetHandle)) queue.push({ wire: next, amped: ampsIt })
  }

  const verdicts = new Map<string, Verdict>()
  for (const node of view.nodes) {
    if (NODE_REGISTRY[node.typeKey].category !== 'sink') continue
    const into = graph.into(node.id)
    const fed  = into.filter((e) => carrying.has(e.id))
    verdicts.set(node.id,
      into.length === 0 ? 'not-connected'
      : fed.length === 0 ? 'no-source'
      // A passive speaker plays only what an Amplifier sends it
      : node.typeKey === 'speaker' && !fed.some((e) => amplified.has(e.id)) ? 'needs-amp'
      : 'sound')
  }

  // A wire flows when its sound ends at an end point that plays it, or in a DAW that records it
  const ends = new Map<string, boolean>()
  function takesIt(id: string, port: string): boolean {
    const key   = `${id}:${port}`
    const known = ends.get(key)
    if (known !== undefined) return known
    ends.set(key, false)   // a loop takes nothing more
    const node = graph.node(id)
    const def  = node && NODE_REGISTRY[node.typeKey]
    const records = def?.routes?.some((r) => r.from === port && r.to.length === 0) ?? false
    const taken = def?.category === 'sink' ? verdicts.get(id) === 'sound'
      : records || onward(graph, id, port).some((e) => carrying.has(e.id) && takesIt(e.target, e.targetHandle))
    ends.set(key, taken)
    return taken
  }
  const flowing = new Set<string>()
  for (const e of view.edges) {
    // Into a passive speaker only the Amplifier's sound plays
    const played = graph.node(e.target)?.typeKey !== 'speaker' || amplified.has(e.id)
    if (carrying.has(e.id) && played && takesIt(e.target, e.targetHandle)) flowing.add(e.id)
  }

  return { arriving, carrying, flowing, verdicts }
}

// The store replaces its arrays on every change: every card reads one answer per change
let last: { nodes: GraphView['nodes']; edges: GraphView['edges']; reach: Reach } | null = null

/** reachOf, worked out once per change of the graph (every card at Beginner reads it). */
export function reachIn(view: GraphView): Reach {
  if (last && last.nodes === view.nodes && last.edges === view.edges) return last.reach
  const reach = reachOf(view)
  last = { nodes: view.nodes, edges: view.edges, reach }
  return reach
}
