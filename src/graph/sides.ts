import type { SignalEdge } from '../data/nodeRegistry'
import { NODE_REGISTRY, SPLIT_PORT, TAKES_ONE_SIDE, portSide } from '../data/nodeRegistry'
import type { GraphView } from './graph'
import { outputKind } from './queries'

// L and R only toward speakers (D43 — the user's call, 2026-11-03): one wire carries a whole stereo
// signal everywhere — out of a bus, through effects and its Main Fader, into a Matrix Bus, headphones,
// a Recorder, Stream / Broadcast. Only where a stereo output is wired to a speaker does it turn into
// L and R, as a desk's Main L / R jacks: the first speaker on L, the next on R (one speaker alone
// plays the left side). An Amplifier's outputs are always L and R (D27): a stereo wire into it goes
// into both its channels. The ports themselves are read from the wires (getPorts): this only moves wires.

/** An older file's (1.0) outputs: a bus's Mix output past its Main Fader, the Matrix send — each the card's whole mix */
const OLD_WHOLE: ReadonlySet<string> = new Set(['mix', 'send'])

/** Same two ports joined twice — keep the first. */
function dedupe(edges: SignalEdge[]): SignalEdge[] {
  return edges.filter((e, i) => edges.findIndex((x) =>
    x.source === e.source && x.sourceHandle === e.sourceHandle &&
    x.target === e.target && x.targetHandle === e.targetHandle) === i)
}

/**
 * The wires with their sides settled, after any change: a wire on an output's L or R that is not
 * into a speaker, or from an output no longer stereo, goes back to the whole output; a stereo
 * output's wire into a speaker takes a side — L first, then whichever has fewer speakers. A side a
 * speaker was put on stays put. An older file's Mix outputs and Matrix sends are the whole output;
 * an Amplifier's one output its L (D27).
 */
export function settleSides(view: GraphView): SignalEdge[] {
  const byId = new Map(view.nodes.map((n) => [n.id, n]))
  /** A card whose `out` turns into L and R toward speakers (not an Amplifier: its are always) */
  const splits    = (id: string) => {
    const node = byId.get(id)
    return node !== undefined && node.typeKey !== 'amp' && NODE_REGISTRY[node.typeKey].outputs.some((p) => p.id === SPLIT_PORT)
  }
  const toSpeaker = (e: SignalEdge) => {
    const target = byId.get(e.target)
    return target !== undefined && TAKES_ONE_SIDE.has(target.typeKey)
  }

  // What is not into a speaker takes the whole output (no stereo signal is needed to know that)
  let edges = view.edges.map((e) => {
    if (byId.get(e.source)?.typeKey === 'amp') return portSide(e.sourceHandle) === null ? { ...e, sourceHandle: 'out-l' } : e
    if (OLD_WHOLE.has(e.sourceHandle) && splits(e.source)) return { ...e, sourceHandle: SPLIT_PORT }
    return portSide(e.sourceHandle) !== null && splits(e.source) && !toSpeaker(e) ? { ...e, sourceHandle: SPLIT_PORT } : e
  })

  // Whether each output is stereo, now only speakers take a side: no wire read on the way is one
  const graph  = { nodes: view.nodes, edges }
  const stereo = new Map<string, boolean>()
  const isStereo = (id: string) => {
    let known = stereo.get(id)
    if (known === undefined) stereo.set(id, known = outputKind(id, SPLIT_PORT, graph) === 'stereo')
    return known
  }

  // A side kept: into a speaker, from a stereo output
  const taken = new Map<string, { l: number; r: number }>()
  edges = edges.map((e) => {
    const side = portSide(e.sourceHandle)
    if (side === null || !splits(e.source)) return e
    if (!isStereo(e.source)) return { ...e, sourceHandle: SPLIT_PORT }
    const count = taken.get(e.source) ?? { l: 0, r: 0 }
    count[side]++
    taken.set(e.source, count)
    return e
  })

  // A stereo output's new wire into a speaker: L first, then whichever side has fewer
  edges = dedupe(edges.map((e) => {
    if (e.sourceHandle !== SPLIT_PORT || !splits(e.source) || !toSpeaker(e) || !isStereo(e.source)) return e
    const count = taken.get(e.source) ?? { l: 0, r: 0 }
    const side  = count.r < count.l ? 'r' : 'l'
    count[side]++
    taken.set(e.source, count)
    return { ...e, sourceHandle: `out-${side}` }
  }))
  // Nothing moved: the same array (what watches the wires sees no change)
  return edges.length === view.edges.length && edges.every((e, i) => e === view.edges[i]) ? view.edges : edges
}
