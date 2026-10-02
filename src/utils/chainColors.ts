import type { SignalNode, SignalEdge } from '../data/nodeRegistry'

/**
 * Colours that tag each chain (everything fed by one source).
 * Picked to stay apart from the four signal-health colours (blue / green / yellow / red),
 * which wires and meters already use.
 */
export const CHAIN_COLORS = [
  '#ec4899', // pink
  '#14b8a6', // teal
  '#a855f7', // purple
  '#f97316', // orange
  '#06b6d4', // cyan
  '#a16207', // brown
  '#64748b', // slate
  '#d946ef', // magenta
]

/** The chain colour used least so far — given to each new source node. */
export function pickChainColor(nodes: SignalNode[]): string {
  const uses = new Map(CHAIN_COLORS.map((c) => [c, 0]))
  for (const n of nodes) {
    if (n.color && uses.has(n.color)) uses.set(n.color, uses.get(n.color)! + 1)
  }
  let best = CHAIN_COLORS[0]
  for (const c of CHAIN_COLORS) {
    if (uses.get(c)! < uses.get(best)!) best = c
  }
  return best
}

/** Every node and wire upstream of `nodeId` (the node itself included). */
export function upstreamOf(nodeId: string, edges: SignalEdge[]): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set<string>([nodeId])
  const edgeIds = new Set<string>()
  const queue   = [nodeId]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const e of edges) {
      if (e.target !== id || edgeIds.has(e.id)) continue
      edgeIds.add(e.id)
      if (!nodeIds.has(e.source)) {
        nodeIds.add(e.source)
        queue.push(e.source)
      }
    }
  }
  return { nodeIds, edgeIds }
}

/** The chain one wire belongs to: the wire itself plus everything feeding it. */
export function chainOfEdge(edge: SignalEdge, edges: SignalEdge[]): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const up = upstreamOf(edge.source, edges)
  up.edgeIds.add(edge.id)
  up.nodeIds.add(edge.target)
  return up
}

/** Colours of the chains that pass through a node, in a stable order. */
export function chainColorsOf(nodeId: string, nodes: SignalNode[], edges: SignalEdge[]): string[] {
  const { nodeIds } = upstreamOf(nodeId, edges)
  const colors: string[] = []
  for (const n of nodes) {
    if (nodeIds.has(n.id) && n.color && !colors.includes(n.color)) colors.push(n.color)
  }
  return colors
}

/** The source nodes (chain starts) that feed a wire. */
export function chainSourcesOfEdge(edge: SignalEdge, nodes: SignalNode[], edges: SignalEdge[]): SignalNode[] {
  const { nodeIds } = upstreamOf(edge.source, edges)
  return nodes.filter((n) => nodeIds.has(n.id) && !edges.some((e) => e.target === n.id))
}
