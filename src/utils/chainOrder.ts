import type { SignalNode, SignalEdge } from '../data/nodeRegistry'

/**
 * Order nodes the way signal flows through them: sources first, each node
 * after everything that feeds it. Ties (and unconnected nodes) fall back to
 * left-to-right, then top-to-bottom canvas position.
 * Used by the help popover's Previous / Next stage buttons.
 */
export function chainOrder(nodes: SignalNode[], edges: SignalEdge[]): SignalNode[] {
  const byPosition = (a: SignalNode, b: SignalNode) =>
    a.position.x - b.position.x || a.position.y - b.position.y

  const inDegree = new Map(nodes.map((n) => [n.id, 0]))
  for (const e of edges) {
    if (inDegree.has(e.target) && inDegree.has(e.source)) {
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
    }
  }

  const ready  = nodes.filter((n) => inDegree.get(n.id) === 0).sort(byPosition)
  const result: SignalNode[] = []
  const seen   = new Set<string>()

  while (ready.length > 0) {
    const node = ready.shift()!
    if (seen.has(node.id)) continue
    seen.add(node.id)
    result.push(node)
    const next: SignalNode[] = []
    for (const e of edges) {
      if (e.source !== node.id) continue
      const remaining = (inDegree.get(e.target) ?? 0) - 1
      inDegree.set(e.target, remaining)
      const target = nodes.find((n) => n.id === e.target)
      if (remaining === 0 && target) next.push(target)
    }
    ready.push(...next)
    ready.sort(byPosition)
  }

  // Anything left is part of a cycle — append in position order
  for (const n of [...nodes].sort(byPosition)) {
    if (!seen.has(n.id)) result.push(n)
  }
  return result
}
