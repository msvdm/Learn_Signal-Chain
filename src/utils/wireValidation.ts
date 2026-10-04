import type { Box, Pt } from './geometry'
import { rectOf, segmentTouchesRect } from './geometry'
import { orthogonalRoute } from './wirePath'

/** How close a wire may pass a card before it counts as crossing it */
const PAD = 4

/**
 * True if the wire through `points` — routed as it is drawn (orthogonalRoute) — runs through a
 * card other than `excludeIds` (the cards it starts and ends on).
 */
export function wirePassesThroughNode(points: Pt[], cards: Box[], excludeIds: string[]): boolean {
  if (points.length < 2) return false
  const exclude = new Set(excludeIds)
  const rects   = cards.filter((c) => !exclude.has(c.id)).map((c) => rectOf(c.position, c.size))
  const route   = orthogonalRoute(points)
  // All its points in one place: that point is the wire
  const runs: [Pt, Pt][] = route.length === 1 ? [[route[0], route[0]]] : route.slice(1).map((p, i) => [route[i], p])
  return runs.some(([a, b]) => rects.some((r) => segmentTouchesRect(a, b, r, PAD)))
}
