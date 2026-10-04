import type { SignalNode, SignalEdge } from '../data/nodeRegistry'
import { MATRIX_PORT, MIX_PORT, SPLIT_TYPES, isStereoBus, portSide } from '../data/nodeRegistry'
import type { GraphView } from '../graph/graph'
import { getPorts, isMatrixSource, mixBusOf, mixSourceOf, splitsStereo } from '../graph/queries'

// Taking over a stereo mix's Left / Right outputs.
// Main Fader: a Fader wired to a stereo bus's L or R output takes over the bus's outputs.
// The wire becomes the Mix wire (the whole stereo mix), the fader gets Left / Right outputs,
// and every wire on the bus's L / R (and its Matrix send) moves to the fader. Effects may sit
// between the bus's Mix output and the fader.
// The Graphic EQ and the Amplifier do the same, from whichever card holds the L / R at that point
// (a bus, its Main Fader, another EQ or amp): the chain carries one stereo wire up to the last of
// them, which sends Left and Right out. The Matrix send stays where it is (it is after the fader).
// Matrix send: the same idea for Matrix Buses. A stereo bus's (or Main Fader's) L or R wired to a
// Matrix Bus becomes its Matrix send — one stereo wire, after the fader.
// The ports themselves are read from the wires (getPorts), so these functions only move wires.

/** Same two ports joined twice — keep the first. */
function dedupe(edges: SignalEdge[]): SignalEdge[] {
  return edges.filter((e, i) => edges.findIndex((x) =>
    x.source === e.source && x.sourceHandle === e.sourceHandle &&
    x.target === e.target && x.targetHandle === e.targetHandle) === i)
}

/** An output whose wires follow the mix to the card that takes it over, and back: L, R and the Matrix send. */
function isSideOutput(portId: string): boolean {
  return portSide(portId) !== null || portId === MATRIX_PORT
}

/** A wire that now starts at another card: its old bends no longer fit. */
function moveSource(e: SignalEdge, source: string, sourceHandle: string): SignalEdge {
  return source === e.source
    ? { ...e, sourceHandle }
    : { ...e, source, sourceHandle, waypoints: undefined }
}

/** A card that holds a stereo mix's L / R outputs right now: a stereo bus, or a Main Fader / EQ / amp splitting it. */
function holdsSides(node: SignalNode, graph: GraphView): boolean {
  return (isStereoBus(node) || SPLIT_TYPES.has(node.typeKey)) &&
    getPorts(node, graph).outputs.some((p) => portSide(p.id) !== null)
}

/**
 * The card a Matrix send from `nodeId` belongs on: `nodeId` itself if it may feed a Matrix Bus
 * (a bus or its Main Fader), else the first such card up the chain the mix came through.
 */
function sendHolder(nodeId: string, graph: GraphView): string | null {
  const seen = new Set<string>()
  let cur: string | null = nodeId
  while (cur && !seen.has(cur)) {
    if (isMatrixSource(cur, MATRIX_PORT, graph)) return cur
    seen.add(cur)
    cur = mixSourceOf(cur, graph)
  }
  return null
}

/**
 * Every card that took the L / R over from the card feeding it the mix (straight in, or through
 * effects), and that card.
 */
function takeovers(graph: GraphView): Map<string, string> {
  const found = new Map<string, string>()
  for (const n of graph.nodes) {
    if (!splitsStereo(n, graph)) continue
    const from = mixSourceOf(n.id, graph)
    if (from) found.set(n.id, from)
  }
  return found
}

/**
 * Applies the takeover rule to every Fader, Graphic EQ or Amplifier wired straight to the L or R
 * of a card that holds them (a Fader only after a bus — that makes it the Main Fader).
 * Also tidies cards whose layout changed: one that no longer splits folds its L / R / Mix wires
 * back onto its one output; one that now splits moves its one-output wires to L.
 */
function attachMainFaders(nodes: SignalNode[], edges: SignalEdge[]): SignalEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  // L or R into a Matrix Bus is the whole mix: it becomes the Matrix send (only buses and Main
  // Faders may feed one — isMatrixSource). Done before every takeover too, so a wire to a Matrix
  // Bus never follows L / R onto a Graphic EQ or Amplifier: the send stays on the Main Fader.
  const matrixSends = (list: SignalEdge[]) => list.map((e) =>
    byId.get(e.target)?.typeKey === 'matrix-bus' && portSide(e.sourceHandle) !== null
      ? { ...e, sourceHandle: MATRIX_PORT }
      : e)
  let next = edges

  for (let guard = 0; guard < 100; guard++) {
    next = matrixSends(next)
    const graph = { nodes, edges: next }
    const hit = next.find((e) => {
      const src = byId.get(e.source)
      const tgt = byId.get(e.target)
      if (!src || !tgt || portSide(e.sourceHandle) === null || !SPLIT_TYPES.has(tgt.typeKey)) return false
      if (!holdsSides(src, graph)) return false
      // A Fader takes the sides over only from a bus's mix (it becomes the Main Fader)
      return tgt.typeKey !== 'fader' || isStereoBus(src) || mixBusOf(src.id, graph) !== null
    })
    if (!hit) break
    const side   = portSide(hit.sourceHandle)
    const target = byId.get(hit.target)!
    // The Matrix send is after the fader: only a Main Fader takes it over
    const follows = (portId: string) => portSide(portId) !== null || (portId === MATRIX_PORT && target.typeKey === 'fader')
    next = next.map((e) => {
      if (e.id === hit.id) return { ...e, sourceHandle: MIX_PORT }
      // The holder's L / R wires (and a bus's Matrix send) move to the same output of the new card
      if (e.source === hit.source && follows(e.sourceHandle)) return moveSource(e, hit.target, e.sourceHandle)
      // What the new card already fed stays on the side its new wire came from
      if (e.source === hit.target && e.sourceHandle === 'out') return { ...e, sourceHandle: `out-${side}` }
      return e
    })
  }

  // Tidy until settled: one card's change can change what the next one receives
  for (let pass = 0; pass < 10; pass++) {
    const graph   = { nodes, edges: next }
    let changed   = false
    next = next.map((e) => {
      const src = byId.get(e.source)
      if (!src || !SPLIT_TYPES.has(src.typeKey)) return e
      const splits = splitsStereo(src, graph)
      let handle   = e.sourceHandle
      if (!splits && (isSideOutput(handle) || handle === MIX_PORT)) handle = 'out'
      else if (splits && handle === 'out') handle = 'out-l'
      if (handle === e.sourceHandle) return e
      changed = true
      return { ...e, sourceHandle: handle }
    })
    if (!changed) break
  }

  // (The tidy can move a one-output wire to L)
  next = matrixSends(next)

  // A Graphic EQ or Amplifier that fed a Matrix Bus while its chain was mono (a mono Aux), then
  // took the L / R over, may not keep the send: it goes back to the bus, or its Main Fader
  const graph = { nodes, edges: next }
  next = next.map((e) => {
    if (e.sourceHandle !== MATRIX_PORT || byId.get(e.target)?.typeKey !== 'matrix-bus') return e
    const holder = sendHolder(e.source, graph)
    return holder && holder !== e.source ? moveSource(e, holder, MATRIX_PORT) : e
  })
  return dedupe(next)
}

/**
 * After any change to the graph: a card left without anything taking over its mix gets its L / R
 * wires back from the card that had them (even if that card was deleted) — unless it can no longer
 * split its mix (a bus switched to Mono). Other wires on its Mix output fall back to its L output —
 * one side cannot carry the whole mix. Ends with attachMainFaders.
 */
export function reconcileMainFaders(prev: GraphView, next: GraphView): SignalEdge[] {
  const before = takeovers(prev)
  const after  = takeovers(next)
  const kept   = new Set(after.values())
  const canHold = (id: string) => next.nodes.some((n) => n.id === id && (isStereoBus(n) || SPLIT_TYPES.has(n.typeKey)))
  const lost   = [...before].filter(([card, holder]) => !after.has(card) && !kept.has(holder) && canHold(holder))
  if (lost.length === 0) return attachMainFaders(next.nodes, next.edges)

  const holderOf   = new Map(lost)
  const orphans    = new Set(holderOf.values())
  const nodeExists = (id: string) => next.nodes.some((n) => n.id === id)
  // The lost cards' L / R wires and Matrix send, taken from before the change (a deleted card has none left)
  const handBack = prev.edges
    .filter((e) => holderOf.has(e.source) && isSideOutput(e.sourceHandle) && nodeExists(e.target))
    .map((e) => moveSource(e, holderOf.get(e.source)!, e.sourceHandle))
  const handedIds = new Set(handBack.map((e) => e.id))

  const edges = next.edges
    .filter((e) => !handedIds.has(e.id))
    .map((e) => (orphans.has(e.source) && e.sourceHandle === MIX_PORT ? { ...e, sourceHandle: 'out-l' } : e))
  return attachMainFaders(next.nodes, [...edges, ...handBack])
}
