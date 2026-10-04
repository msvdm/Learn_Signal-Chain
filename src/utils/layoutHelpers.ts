import type { SignalEdge } from '../store/signalStore'
import type { TypeKey } from '../data/nodeRegistry'
import { NODE_REGISTRY, isTypeKey } from '../data/nodeRegistry'
import { upstreamOf } from '../graph/graph'
import { orthogonalRoute } from './wirePath'
import type { Box, Pt, Size } from './geometry'
import { rectOf, rectsOverlap } from './geometry'

// Placing cards: where a new or moved card goes, and which cards make room for it. Every helper
// takes the cards as Boxes with their real sizes (useCanvasLayout's layoutSnapshot).

export const GRID = 36

/** `p` on the grid (Snap to grid on), else on whole pixels. */
export function snapPoint(p: Pt, toGrid: boolean): Pt {
  return toGrid
    ? { x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID }
    : { x: Math.round(p.x), y: Math.round(p.y) }
}

// Room left between cards: a wire into a card starts at least this far right of the card feeding
// it, and a copy sits this far beside its original.
export const MIN_NODE_GAP = 100

/** Cards closer than this to each other (in any direction) count as overlapping. */
const CLEARANCE = MIN_NODE_GAP / 2

// ── Card geometry ──────────────────────────────────────────────────────────────
// Every node card shares the same header height and port line, so wires between
// cards stay straight no matter how tall each card is.
export const HEADER_H = 56
// First port centre, measured from the card top: just below the header's divider, clear of its
// buttons. The ring is 28px (40px while it shows the unplug ×), so it never touches the line.
export const PORT_TOP = HEADER_H + 24
export const PORT_GAP = 36   // spacing between stacked ports on the same side (rings don't touch)

/** The centre of a port ring: on the left edge (inputs) or right edge (outputs), `index` down the stack. */
export function portPoint(card: Box, type: 'source' | 'target', index: number): Pt {
  return {
    x: type === 'source' ? card.position.x + card.size.w : card.position.x,
    y: card.position.y + PORT_TOP + index * PORT_GAP,
  }
}

// Every card is at least this big and landscape (never taller than wide, except a tall stack of
// ports), so its name has room to grow in overview (zoomed out). Some are bigger (`minSize` in the
// registry: the mixing buses).
export const CARD_MIN_W = 280
export const CARD_MIN_H = 210

/** The smallest a card of this type can be (it grows with its content). */
export function cardMinSize(typeKey: TypeKey): Size {
  return NODE_REGISTRY[typeKey].minSize ?? { w: CARD_MIN_W, h: CARD_MIN_H }
}

/**
 * Size of a node that React Flow has not measured yet (a node about to be dropped): its minimum
 * size. Nodes size themselves to their content, so once any node of a type has been measured its
 * real size is remembered and used instead.
 */
const measuredSizeByType = new Map<string, Size>()

export function recordMeasuredSize(typeKey: string, w: number, h: number) {
  if (w > 0 && h > 0) measuredSizeByType.set(typeKey, { w, h })
}

export const HIT_THRESHOLD = 48

// ── Dimension helpers ──────────────────────────────────────────────────────────

/** A type never measured: a free-standing control's usual size, else a card's minimum. */
function unmeasuredSize(typeKey: string): Size {
  if (!isTypeKey(typeKey)) return { w: CARD_MIN_W, h: CARD_MIN_H }
  return NODE_REGISTRY[typeKey].freeSize ?? cardMinSize(typeKey)
}

/**
 * An element's size: React Flow's measurement, else the last measured size of its type, else its
 * type's usual size (a free-standing control's `freeSize`, a card's minimum). The one fallback for
 * an element not drawn yet. `typeKey` may be React Flow's node type (a string).
 */
export function nodeDims(typeKey: string, measuredW?: number, measuredH?: number): Size {
  const known = measuredSizeByType.get(typeKey) ?? unmeasuredSize(typeKey)
  return {
    w: measuredW ?? known.w,
    h: measuredH ?? known.h,
  }
}

const boxRect = (b: Box, dx = 0) => rectOf({ x: b.position.x + dx, y: b.position.y }, b.size)

// ── Placement helpers ──────────────────────────────────────────────────────────

/** Where a card of `size` placed at `pos` goes: nudged down and right until it overlaps no other card. */
export function resolveOverlap(pos: Pt, size: Size, others: Box[], skipId?: string): Pt {
  let cur = { ...pos }
  for (let i = 0; i < 60; i++) {
    const r = rectOf(cur, size)
    const clash = others.find((n) => n.id !== skipId && rectsOverlap(r, boxRect(n), CLEARANCE))
    if (!clash) return cur
    // Alternate axis nudging — Y first (less disruptive), then X
    if (i % 2 === 0) {
      cur = { x: cur.x, y: cur.y + GRID }
    } else {
      cur = { x: cur.x + GRID, y: cur.y }
    }
  }
  return cur
}

// ── Push helpers ───────────────────────────────────────────────────────────────

/**
 * New positions that give src's wires to tgtIds room: each target starts at least MIN_NODE_GAP
 * right of src. Targets that are closer move right together with the chain they feed, plus any
 * card they would land on. src and the cards feeding it never move — taking them along would
 * leave the gap as it was.
 */
function gapMoves(srcId: string, tgtIds: string[], nodes: Box[], edges: SignalEdge[]): Map<string, Pt> {
  const moves   = new Map<string, Pt>()
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const src = nodeMap.get(srcId)
  if (!src) return moves
  const srcRight = boxRect(src).right
  const fixed    = upstreamOf(srcId, edges).nodeIds

  // A wire that loops back into its own chain has no left-to-right order to restore
  const gapTo    = (id: string) => nodeMap.get(id)!.position.x - srcRight
  const tooClose = tgtIds.filter((id) => nodeMap.has(id) && !fixed.has(id) && gapTo(id) < MIN_NODE_GAP)
  if (tooClose.length === 0) return moves
  const shift = Math.ceil(Math.max(...tooClose.map((id) => MIN_NODE_GAP - gapTo(id))) / GRID) * GRID

  const moving = new Set<string>()
  let next = tooClose
  while (next.length > 0) {
    // These cards move, and so does everything they feed
    while (next.length > 0) {
      const id = next.pop()!
      if (moving.has(id) || fixed.has(id) || !nodeMap.has(id)) continue
      moving.add(id)
      for (const e of edges) if (e.source === id) next.push(e.target)
    }
    // Then any card a moved card would now land on
    const moved = [...moving].map((id) => boxRect(nodeMap.get(id)!, shift))
    next = nodes
      .filter((n) => !moving.has(n.id) && !fixed.has(n.id) && moved.some((r) => rectsOverlap(r, boxRect(n), CLEARANCE)))
      .map((n) => n.id)
  }

  for (const id of moving) {
    const n = nodeMap.get(id)!
    moves.set(id, { x: n.position.x + shift, y: n.position.y })
  }
  return moves
}

/**
 * New positions that give a new src→tgt wire room: tgt starts at least MIN_NODE_GAP right of src
 * (see gapMoves). `edges` are the wires before this one.
 */
export function enforceGap(srcId: string, tgtId: string, nodes: Box[], edges: SignalEdge[]): Map<string, Pt> {
  return gapMoves(srcId, [tgtId], nodes, edges)
}

/**
 * New positions that make room for a card just dropped onto a wire (`nodes` hold it with its
 * real size, `edges` its new wires). The chain after it slides right (gapMoves); then, if a tall
 * card would cover cards below it or the wires running there, everything from the highest of
 * those cards down moves down as one block, so the rows underneath keep their shape and their
 * wires stay straight. The chain feeding the new card never moves.
 */
export function makeRoomForInsert(newId: string, nodes: Box[], edges: SignalEdge[]): Map<string, Pt> {
  const targets = edges.filter((e) => e.source === newId).map((e) => e.target)
  const moves   = gapMoves(newId, targets, nodes, edges)
  const placed  = nodes.map((n) => {
    const pos = moves.get(n.id)
    return pos ? { ...n, position: pos } : n
  })
  const byId = new Map(placed.map((n) => [n.id, n]))
  const card = byId.get(newId)
  if (!card) return moves
  const r     = boxRect(card)
  const fixed = upstreamOf(newId, edges).nodeIds
  // Cards in its own row (top within its header) can't be moved out of its way downward
  const isBelow = (n: Box) => !fixed.has(n.id) && n.position.y >= r.top + HEADER_H

  // A wire's first and last runs sit on its cards' port lines: one under the new card moves with its card
  const runUnderCard = (a: Pt, b: Pt) =>
    a.y === b.y && a.y > r.top - CLEARANCE && a.y < r.bottom + CLEARANCE &&
    Math.max(a.x, b.x) > r.left && Math.min(a.x, b.x) < r.right

  const inTheWay = placed.filter((n) => isBelow(n) && rectsOverlap(r, boxRect(n), CLEARANCE))
  for (const e of edges) {
    if (e.source === newId || e.target === newId) continue
    const src = byId.get(e.source)
    const tgt = byId.get(e.target)
    if (!src || !tgt) continue
    // (Both ends on the first port line)
    const route = orthogonalRoute([portPoint(src, 'source', 0), ...(e.waypoints ?? []), portPoint(tgt, 'target', 0)])
    if (isBelow(src) && runUnderCard(route[0], route[1])) inTheWay.push(src)
    if (isBelow(tgt) && runUnderCard(route[route.length - 2], route[route.length - 1])) inTheWay.push(tgt)
  }
  if (inTheWay.length === 0) return moves

  const top   = Math.min(...inTheWay.map((n) => n.position.y))
  const shift = Math.ceil((r.bottom + MIN_NODE_GAP - top) / GRID) * GRID
  if (shift <= 0) return moves
  for (const n of placed) {
    if (n.id === newId || fixed.has(n.id) || n.position.y < top) continue
    moves.set(n.id, { x: n.position.x, y: n.position.y + shift })
  }
  return moves
}

// ── Edge insertion helpers ─────────────────────────────────────────────────────

/**
 * Returns the edge that "owns" the given flow-coordinate drop point.
 * Each edge owns the horizontal band between the centre of its source and target.
 * Vertical tolerance is ±HIT_THRESHOLD around both nodes' port lines.
 */
export function findEdgeAtPoint(point: Pt, edges: SignalEdge[], nodes: Box[]): SignalEdge | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  for (const edge of edges) {
    const src = nodeMap.get(edge.source)
    const tgt = nodeMap.get(edge.target)
    if (!src || !tgt) continue
    const srcCX = src.position.x + src.size.w / 2
    const tgtCX = tgt.position.x + tgt.size.w / 2
    if (point.x < srcCX || point.x > tgtCX) continue
    const minY = Math.min(src.position.y, tgt.position.y) + PORT_TOP - HIT_THRESHOLD
    const maxY = Math.max(src.position.y, tgt.position.y) + PORT_TOP + HIT_THRESHOLD
    if (point.y < minY || point.y > maxY) continue
    return edge
  }
  return null
}

