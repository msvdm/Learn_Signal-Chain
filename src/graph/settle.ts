import type { SignalEdge } from '../data/nodeRegistry'
import type { GraphView } from './graph'
import { reconcileMainFaders } from './mainFader'
import { withUsbReturns } from './usbLink'
import { withLinkChannels, withoutStrayInterfaceWires } from './interfaceLink'
import { settleSlots } from './slots'

/**
 * The wires as `graph` leaves them, after `prev`: its L / R takeovers settled, every USB wire with its
 * way back, a Digital Interface's wires on the ports it has, every cable with its channels (D40), each
 * wire into an input taking several on a port of its own. The store's commitGraph runs it on every
 * change; a new canvas (an opened chain) comes after nothing (`prev` empty).
 */
export function settle(prev: GraphView, graph: GraphView): SignalEdge[] {
  const { nodes } = graph
  let edges = withUsbReturns({ nodes, edges: reconcileMainFaders(prev, graph) })
  edges = withLinkChannels({ nodes, edges: withoutStrayInterfaceWires({ nodes, edges }) })
  return settleSlots({ nodes, edges })
}
