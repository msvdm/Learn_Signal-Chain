import type { SignalNode, SignalEdge, GraphView } from '../data/nodeRegistry'
import { MATRIX_PORT, MIX_PORT, isStereoBus, mixBusOf, portSide } from '../data/nodeRegistry'

// Main Fader: a Fader wired to a stereo bus's L or R output takes over the bus's outputs.
// The wire becomes the Mix wire (the whole stereo mix), the fader gets Left / Right outputs,
// and every wire on the bus's L / R (and its Matrix send) moves to the fader. Effects may sit
// between the bus's Mix output and the fader.
// Matrix send: the same idea for Matrix Buses. A stereo bus's (or Main Fader's) L or R wired to a
// Matrix Bus becomes its Matrix send — one stereo wire, after the fader.
// The ports themselves are read from the wires (getPorts), so these functions only move wires.

/** Same two ports joined twice — keep the first. */
function dedupe(edges: SignalEdge[]): SignalEdge[] {
  return edges.filter((e, i) => edges.findIndex((x) =>
    x.source === e.source && x.sourceHandle === e.sourceHandle &&
    x.target === e.target && x.targetHandle === e.targetHandle) === i)
}

/** An output whose wires follow the bus's mix to its Main Fader and back: L, R and the Matrix send. */
function isBusOutput(portId: string): boolean {
  return portSide(portId) !== null || portId === MATRIX_PORT
}

/** A wire that now starts at another card: its old bends no longer fit. */
function moveSource(e: SignalEdge, source: string, sourceHandle: string): SignalEdge {
  return source === e.source
    ? { ...e, sourceHandle }
    : { ...e, source, sourceHandle, waypoints: undefined }
}

/** Every Main Fader and the bus it belongs to. */
function mainFaders(graph: GraphView): Map<string, string> {
  const found = new Map<string, string>()
  for (const n of graph.nodes) {
    if (n.typeKey !== 'fader') continue
    const bus = mixBusOf(n.id, graph)
    if (bus) found.set(n.id, bus)
  }
  return found
}

/**
 * Applies the Main Fader rule to every Fader wired straight to a stereo bus's L or R output.
 * Also tidies Faders whose layout changed: a Fader no longer fed from Mix folds its
 * L / R wires back onto its one output; a Main Fader's stray one-output wires go to L.
 */
export function attachMainFaders(nodes: SignalNode[], edges: SignalEdge[]): SignalEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let next = edges

  for (;;) {
    const hit = next.find((e) => {
      const bus = byId.get(e.source)
      return bus !== undefined && isStereoBus(bus) && portSide(e.sourceHandle) !== null &&
        byId.get(e.target)?.typeKey === 'fader'
    })
    if (!hit) break
    const side = portSide(hit.sourceHandle)
    next = next.map((e) => {
      if (e.id === hit.id) return { ...e, sourceHandle: MIX_PORT }
      // The bus's L / R wires (and its Matrix send) move to the same output of the fader
      if (e.source === hit.source && isBusOutput(e.sourceHandle)) return moveSource(e, hit.target, e.sourceHandle)
      // What the fader already fed stays on the side its new wire came from
      if (e.source === hit.target && e.sourceHandle === 'out') return { ...e, sourceHandle: `out-${side}` }
      return e
    })
  }

  const main = mainFaders({ nodes, edges: next })
  next = next.map((e) => {
    if (byId.get(e.source)?.typeKey !== 'fader') return e
    const isMain = main.has(e.source)
    if (!isMain && isBusOutput(e.sourceHandle)) return { ...e, sourceHandle: 'out' }
    if (isMain && e.sourceHandle === 'out') return { ...e, sourceHandle: 'out-l' }
    return e
  })

  // L or R into a Matrix Bus is the whole mix: it becomes the Matrix send (only buses and
  // Main Faders have L / R outputs, so only they get one)
  next = next.map((e) => (byId.get(e.target)?.typeKey === 'matrix-bus' && portSide(e.sourceHandle) !== null
    ? { ...e, sourceHandle: MATRIX_PORT }
    : e))
  return dedupe(next)
}

/**
 * After wires or cards were removed: a bus left without any Main Fader gets its L / R wires
 * back from the fader that lost the Mix (even if that fader was deleted). Other wires on its
 * Mix output fall back to its L output — one side cannot carry the whole mix.
 */
export function reconcileMainFaders(prev: GraphView, next: GraphView): SignalEdge[] {
  const before = mainFaders(prev)
  const after  = mainFaders(next)
  const kept   = new Set(after.values())
  const lost   = [...before].filter(([fader, bus]) =>
    !after.has(fader) && !kept.has(bus) && next.nodes.some((n) => n.id === bus))
  if (lost.length === 0) return attachMainFaders(next.nodes, next.edges)

  const busOfLost  = new Map(lost)
  const orphanBus  = new Set(busOfLost.values())
  const nodeExists = (id: string) => next.nodes.some((n) => n.id === id)
  // The lost faders' L / R wires and Matrix send, taken from before the change (a deleted fader has none left)
  const handBack = prev.edges
    .filter((e) => busOfLost.has(e.source) && isBusOutput(e.sourceHandle) && nodeExists(e.target))
    .map((e) => moveSource(e, busOfLost.get(e.source)!, e.sourceHandle))
  const handedIds = new Set(handBack.map((e) => e.id))

  const edges = next.edges
    .filter((e) => !handedIds.has(e.id))
    .map((e) => (orphanBus.has(e.source) && e.sourceHandle === MIX_PORT ? { ...e, sourceHandle: 'out-l' } : e))
  return attachMainFaders(next.nodes, [...edges, ...handBack])
}
