import type { SignalEdge, TypeKey } from '../data/nodeRegistry'
import { FROM_PC_PORT, PLAYBACK_PORT, TO_PC_PORT } from '../data/nodeRegistry'
import type { Graph, GraphView } from './graph'
import { graphOf } from './graph'

// The USB link (D22): one wire, drawn from an Audio Interface's To computer into a DAW, carries the
// sound both ways. What the Interface records goes along it to the DAW; what the DAW plays back
// comes back along it — a wire of its own in the graph, from the DAW's hidden playback port into
// the Interface's hidden From computer, that nobody draws or sees. The store keeps one with every
// USB wire (commitGraph), so the engine, the render and every walk follow it like any other wire.
// At Beginner a Mixer is a desk with USB: a wire from one of its outputs into a DAW is a USB wire
// too, and the computer's sound comes back into the Mixer's input.

/** The cards a USB wire into a DAW leaves, and the input the computer's sound comes back on. */
const BACK_INTO: Partial<Record<TypeKey, string>> = { interface: FROM_PC_PORT, mixer: 'in' }

/** A USB wire: an Interface's To computer, or a Mixer's output, into a DAW (it carries both ways: no flow). */
export function isUsbWire(edge: SignalEdge, graph: Graph): boolean {
  if (graph.node(edge.target)?.typeKey !== 'daw' || isUsbReturn(edge)) return false
  const from = graph.node(edge.source)?.typeKey
  return from === 'interface' ? edge.sourceHandle === TO_PC_PORT : from === 'mixer'
}

/** A USB wire's way back: never drawn (the USB wire is). */
export const isUsbReturn = (edge: SignalEdge): boolean => edge.sourceHandle === PLAYBACK_PORT

/** The way back of the USB wire `usb` (its id comes from the USB wire's: the same every time). */
function returnOf(usb: SignalEdge, graph: Graph): SignalEdge {
  const into = BACK_INTO[graph.node(usb.source)!.typeKey]!
  return { id: `${usb.id}:back`, source: usb.target, sourceHandle: PLAYBACK_PORT, target: usb.source, targetHandle: into }
}

/**
 * The wires with exactly one way back for every USB wire (isUsbWire) and none without one.
 * `view.edges` itself when nothing changes.
 */
export function withUsbReturns(view: GraphView): SignalEdge[] {
  const graph  = graphOf(view)
  const wanted = new Map(view.edges.filter((e) => isUsbWire(e, graph)).map((e) => {
    const back = returnOf(e, graph)
    return [`${back.source}>${back.target}:${back.targetHandle}`, back]
  }))
  const kept  = view.edges.filter((e) => !isUsbReturn(e) || wanted.delete(`${e.source}>${e.target}:${e.targetHandle}`))
  if (kept.length === view.edges.length && wanted.size === 0) return view.edges
  return [...kept, ...wanted.values()]
}
