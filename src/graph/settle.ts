import type { SignalEdge } from '../data/nodeRegistry'
import type { GraphView } from './graph'
import { settleSides } from './sides'
import { withUsbReturns } from './usbLink'
import { withLinkChannels, withoutStrayInterfaceWires } from './interfaceLink'
import { settleSlots } from './slots'

/**
 * The wires as `graph` leaves them: every wire's side settled (L and R only into speakers — D43),
 * every USB wire with its way back, a Digital Interface's wires on the ports it has, every cable
 * with its channels (D40), each wire into an input taking several on a port of its own. The store's
 * commitGraph runs it on every change, and on a chain opened (an older file's wires as today's).
 */
export function settle(graph: GraphView): SignalEdge[] {
  const { nodes } = graph
  let edges = withUsbReturns({ nodes, edges: settleSides(graph) })
  edges = withLinkChannels({ nodes, edges: withoutStrayInterfaceWires({ nodes, edges }) })
  return settleSlots({ nodes, edges })
}
