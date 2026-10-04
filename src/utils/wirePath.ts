import type { Pt } from './geometry'

const MIN_EXIT = 40

/**
 * Corner points of the orthogonal route through a series of flow-coordinate points.
 *
 * Rules:
 * - The first segment exits rightward from the source handle with a minimum
 *   horizontal departure of MIN_EXIT px so the wire never doubles back immediately.
 * - Every subsequent segment uses an H→V→H elbow (horizontal then vertical then
 *   horizontal) so all turns are at right angles.
 * - Two points produce the simplest possible elbow; additional waypoints add
 *   extra corner segments as the user places them.
 */
export function orthogonalRoute(points: Pt[]): Pt[] {
  const route: Pt[] = [points[0]]
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const pivot = i === 0
      ? Math.max(a.x + MIN_EXIT, (a.x + b.x) / 2)
      : (a.x + b.x) / 2
    route.push({ x: pivot, y: a.y }, { x: pivot, y: b.y }, b)
  }
  // Drop zero-length segments so corner rounding sees real turns only
  return route.filter((p, i) => i === 0 || p.x !== route[i - 1].x || p.y !== route[i - 1].y)
}

/**
 * Build an orthogonal SVG path with rounded corners (radius shrinks on short segments).
 */
export function buildWirePath(points: Pt[], radius = 8): string {
  if (points.length < 2) return ''
  const route = orthogonalRoute(points)
  let d = `M ${route[0].x} ${route[0].y}`
  for (let i = 1; i < route.length; i++) {
    const cur  = route[i]
    const next = route[i + 1]
    if (!next) {
      d += ` L ${cur.x} ${cur.y}`
      break
    }
    const prev  = route[i - 1]
    const inLen  = Math.hypot(cur.x - prev.x, cur.y - prev.y)
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y)
    const r = Math.min(radius, inLen / 2, outLen / 2)
    const before = { x: cur.x - Math.sign(cur.x - prev.x) * r, y: cur.y - Math.sign(cur.y - prev.y) * r }
    const after  = { x: cur.x + Math.sign(next.x - cur.x) * r, y: cur.y + Math.sign(next.y - cur.y) * r }
    d += ` L ${before.x} ${before.y} Q ${cur.x} ${cur.y} ${after.x} ${after.y}`
  }
  return d
}
