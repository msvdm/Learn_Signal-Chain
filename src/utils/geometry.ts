import type { Size } from '../data/nodeRegistry'

// Canvas geometry, in flow coordinates. An element's position is its top-left corner (React Flow's
// nodeOrigin is [0, 0]). Pure: the layout helpers, the copy placement and the wire checks share it.

export type { Size }

export type Pt = { x: number; y: number }

/** An element on the canvas: where it is and how big (useCanvasLayout's layoutSnapshot). */
export interface Box {
  id: string
  position: Pt
  size: Size
}

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

export function rectOf(position: Pt, size: Size): Rect {
  return { left: position.x, top: position.y, right: position.x + size.w, bottom: position.y + size.h }
}

/** a and b overlap, or come closer than `pad` to each other (exactly `pad` apart is clear). */
export function rectsOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return (
    a.left   < b.right  + pad &&
    a.right  > b.left   - pad &&
    a.top    < b.bottom + pad &&
    a.bottom > b.top    - pad
  )
}

/** The straight (horizontal or vertical) segment a → b touches r grown by `pad` — touching counts. */
export function segmentTouchesRect(a: Pt, b: Pt, r: Rect, pad = 0): boolean {
  return (
    Math.min(a.x, b.x) <= r.right  + pad &&
    Math.max(a.x, b.x) >= r.left   - pad &&
    Math.min(a.y, b.y) <= r.bottom + pad &&
    Math.max(a.y, b.y) >= r.top    - pad
  )
}
