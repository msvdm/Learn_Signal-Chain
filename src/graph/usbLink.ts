import type { SignalEdge } from '../data/nodeRegistry'
import { FROM_PC_PORT, PLAYBACK_PORT, TO_PC_PORT } from '../data/nodeRegistry'
import type { GraphView } from './graph'
import { graphOf } from './graph'

// The USB link (D22): one wire, drawn from an Audio Interface's To computer into a DAW, carries the
// sound both ways. What the Interface records goes along it to the DAW; what the DAW plays back
// comes back along it — a wire of its own in the graph, from the DAW's hidden playback port into
// the Interface's hidden From computer, that nobody draws or sees. The store keeps one with every
// USB wire (commitGraph), so the engine, the render and every walk follow it like any other wire.

/** A USB wire's way back: never drawn (the USB wire is). */
export const isUsbReturn = (edge: SignalEdge): boolean => edge.sourceHandle === PLAYBACK_PORT

/** The way back of the USB wire `usb` (its id comes from the USB wire's: the same every time). */
function returnOf(usb: SignalEdge): SignalEdge {
  return { id: `${usb.id}:back`, source: usb.target, sourceHandle: PLAYBACK_PORT, target: usb.source, targetHandle: FROM_PC_PORT }
}

/**
 * The wires with exactly one way back for every USB wire (an Interface's To computer into a DAW)
 * and none without one. `view.edges` itself when nothing changes.
 */
export function withUsbReturns(view: GraphView): SignalEdge[] {
  const graph = graphOf(view)
  const usb   = view.edges.filter((e) =>
    e.sourceHandle === TO_PC_PORT && graph.node(e.source)?.typeKey === 'interface' && graph.node(e.target)?.typeKey === 'daw')
  const wanted = new Map(usb.map((e) => {
    const back = returnOf(e)
    return [`${back.source}>${back.target}`, back]
  }))
  const kept  = view.edges.filter((e) => !isUsbReturn(e) || wanted.delete(`${e.source}>${e.target}`))
  if (kept.length === view.edges.length && wanted.size === 0) return view.edges
  return [...kept, ...wanted.values()]
}
