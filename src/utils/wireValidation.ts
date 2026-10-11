import type { Box, Pt } from './geometry'
import { rectOf, segmentTouchesRect } from './geometry'
import { orthogonalRoute } from './wirePath'
import type { RouteEnds } from './wirePath'

/** How close a wire may pass a card before it counts as crossing it */
const PAD = 4

/**
 * True if the wire through `points` — routed as it is drawn (orthogonalRoute, out of and into the
 * sides its ports face: `ends`) — runs through a card other than `excludeIds` (the cards it starts
 * and ends on).
 */
export function wirePassesThroughNode(points: Pt[], cards: Box[], excludeIds: string[], ends: RouteEnds = {}): boolean {
  if (points.length < 2) return false
  return routeCrossesCards(orthogonalRoute(points, ends), cards, excludeIds)
}

/** True if a wire's route (its corners, as drawn) runs through a card other than `excludeIds`. */
export function routeCrossesCards(route: Pt[], cards: Box[], excludeIds: string[]): boolean {
  const exclude = new Set(excludeIds)
  const rects   = cards.filter((c) => !exclude.has(c.id)).map((c) => rectOf(c.position, c.size))
  // All its points in one place: that point is the wire
  const runs: [Pt, Pt][] = route.length === 1 ? [[route[0], route[0]]] : route.slice(1).map((p, i) => [route[i], p])
  return runs.some(([a, b]) => rects.some((r) => segmentTouchesRect(a, b, r, PAD)))
}
