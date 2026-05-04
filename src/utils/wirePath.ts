type Pt = { x: number; y: number }

/**
 * Build an orthogonal SVG path through a series of flow-coordinate points.
 *
 * Rules:
 * - The first segment exits rightward from the source handle with a minimum
 *   horizontal departure of MIN_EXIT px so the wire never doubles back immediately.
 * - Every subsequent segment uses an H→V→H elbow (horizontal then vertical then
 *   horizontal) so all turns are at right angles.
 * - Two points produce the simplest possible elbow; additional waypoints add
 *   extra corner segments as the user places them.
 */
export function buildWirePath(points: Pt[]): string {
  if (points.length < 2) return ''
  const MIN_EXIT = 40
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const pivot = i === 0
      ? Math.max(a.x + MIN_EXIT, (a.x + b.x) / 2)
      : (a.x + b.x) / 2
    d += ` H ${pivot} V ${b.y} H ${b.x}`
  }
  return d
}
