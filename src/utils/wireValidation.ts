type Pt = { x: number; y: number }
type Rect = { left: number; right: number; top: number; bottom: number }

function nodeToRect(
  position: { x: number; y: number },
  width: number,
  height: number,
): Rect {
  // nodeOrigin=[0, 0.5] — position.x is left edge, position.y is vertical centre
  return {
    left:   position.x,
    right:  position.x + width,
    top:    position.y - height / 2,
    bottom: position.y + height / 2,
  }
}

// Does an axis-aligned segment (from a to b, horizontal or vertical) intersect rect?
function segmentIntersectsRect(a: Pt, b: Pt, r: Rect, pad = 4): boolean {
  const pl = r.left - pad, pr = r.right + pad
  const pt = r.top  - pad, pb = r.bottom + pad
  if (a.y === b.y) {
    // Horizontal segment
    const minX = Math.min(a.x, b.x)
    const maxX = Math.max(a.x, b.x)
    if (a.y < pt || a.y > pb) return false
    if (maxX < pl || minX > pr) return false
    return true
  }
  // Vertical segment
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  if (a.x < pl || a.x > pr) return false
  if (maxY < pt || minY > pb) return false
  return true
}

// Expand an H→V→H elbow into its three explicit axis-aligned segments.
function elbowSegments(a: Pt, b: Pt, isFirst: boolean): [Pt, Pt][] {
  const MIN_EXIT = 40
  const pivot = isFirst
    ? Math.max(a.x + MIN_EXIT, (a.x + b.x) / 2)
    : (a.x + b.x) / 2
  const mid1: Pt = { x: pivot, y: a.y }
  const mid2: Pt = { x: pivot, y: b.y }
  return [[a, mid1], [mid1, mid2], [mid2, b]]
}

type NodeInfo = {
  id: string
  position: { x: number; y: number }
  width?: number
  height?: number
}

/**
 * Returns true if the wire defined by `points` passes through any node bounding box,
 * excluding the source and target nodes (`excludeIds`).
 */
export function wirePassesThroughNode(
  points: Pt[],
  nodes: NodeInfo[],
  excludeIds: string[],
): boolean {
  if (points.length < 2) return false
  const excludeSet = new Set(excludeIds)
  const candidates = nodes.filter((n) => !excludeSet.has(n.id))

  for (let i = 0; i < points.length - 1; i++) {
    const segs = elbowSegments(points[i], points[i + 1], i === 0)
    for (const [a, b] of segs) {
      for (const n of candidates) {
        const w = n.width ?? 208
        const h = n.height ?? 120
        const rect = nodeToRect(n.position, w, h)
        if (segmentIntersectsRect(a, b, rect)) return true
      }
    }
  }
  return false
}
