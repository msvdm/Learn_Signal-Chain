import type { Node as FlowNode } from '@xyflow/react'
import type { SignalEdge } from '../store/signalStore'
import { NODE_REGISTRY } from '../data/nodeRegistry'
import { upstreamOf } from './chainColors'
import { orthogonalRoute } from './wirePath'

export type Pt = { x: number; y: number }

export const GRID = 36

// Minimum clearance between any two nodes, in all directions.
export const MIN_NODE_GAP = 100

// ── Card geometry ──────────────────────────────────────────────────────────────
// Every node card shares the same header height and port line, so wires between
// cards stay straight no matter how tall each card is.
export const HEADER_H = 56
// First port centre, measured from the card top: just below the header's divider, clear of its
// buttons. The ring is 28px (40px while it shows the unplug ×), so it never touches the line.
export const PORT_TOP = HEADER_H + 24
export const PORT_GAP = 36   // spacing between stacked ports on the same side (rings don't touch)

// Every card is at least this big and landscape (never taller than wide, except a tall stack of
// ports), so its name has room to grow in overview (zoomed out)
export const CARD_MIN_W = 280
export const CARD_MIN_H = 210

// Cards with their own minimum size
const CARD_MIN_BY_TYPE: Record<string, { w: number; h: number }> = {
  // Mixing buses: the size of the Compressor card, so their long names stay big in overview
  'master-bus': { w: 398, h: 298 },
  'aux-bus':    { w: 398, h: 298 },
  'matrix-bus': { w: 398, h: 298 },
}

// Free-standing controls (Gain, Pan, Fader, Switch — FreeControl, not cards): their usual size, for drop previews
const FREE_CONTROL_SIZE: Record<string, { w: number; h: number }> = {
  gain:   { w: 162, h: 216 },
  pan:    { w: 232, h: 266 },
  fader:  { w: 174, h: 541 },
  switch: { w: 175, h: 188 },
}

/** The smallest a card of this type can be (it grows with its content). */
export function cardMinSize(typeKey: string): { w: number; h: number } {
  return CARD_MIN_BY_TYPE[typeKey] ?? { w: CARD_MIN_W, h: CARD_MIN_H }
}

/**
 * Size of a node that React Flow has not measured yet (a node about to be dropped): its minimum
 * size. Nodes size themselves to their content, so once any node of a type has been measured its
 * real size is remembered and used instead.
 */
const measuredSizeByType = new Map<string, { w: number; h: number }>()

export function recordMeasuredSize(typeKey: string, w: number, h: number) {
  if (w > 0 && h > 0) measuredSizeByType.set(typeKey, { w, h })
}

export const HIT_THRESHOLD = 48

// ── Dimension helpers ──────────────────────────────────────────────────────────

export function nodeDims(typeKey: string, measuredW?: number, measuredH?: number) {
  const known = measuredSizeByType.get(typeKey) ?? FREE_CONTROL_SIZE[typeKey] ?? cardMinSize(typeKey)
  return {
    w: measuredW ?? known.w,
    h: measuredH ?? known.h,
  }
}

// nodeOrigin=[0,0]: position is the top-left corner
function nodeRect(pos: Pt, w: number, h: number) {
  return { left: pos.x, right: pos.x + w, top: pos.y, bottom: pos.y + h }
}

// PAD = MIN_NODE_GAP / 2 so clearance between any two rects ≥ MIN_NODE_GAP in both axes.
function rectsOverlap(a: ReturnType<typeof nodeRect>, b: ReturnType<typeof nodeRect>) {
  const PAD = MIN_NODE_GAP / 2
  return (
    a.left   < b.right  + PAD &&
    a.right  > b.left   - PAD &&
    a.top    < b.bottom + PAD &&
    a.bottom > b.top    - PAD
  )
}

// ── Placement helpers ──────────────────────────────────────────────────────────

export function resolveOverlap(
  pos: Pt,
  w: number,
  h: number,
  others: FlowNode[],
  skipId?: string,
): Pt {
  let cur = { ...pos }
  for (let i = 0; i < 60; i++) {
    const r = nodeRect(cur, w, h)
    const clash = others.find((n) => {
      if (n.id === skipId) return false
      const d = nodeDims(n.type ?? '', n.measured?.width, n.measured?.height)
      return rectsOverlap(r, nodeRect(n.position, d.w, d.h))
    })
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

function cardRect(n: FlowNode, dx = 0) {
  const d = nodeDims(n.type ?? '', n.measured?.width, n.measured?.height)
  return nodeRect({ x: n.position.x + dx, y: n.position.y }, d.w, d.h)
}

/**
 * New positions that give src's wires to tgtIds room: each target starts at least MIN_NODE_GAP
 * right of src. Targets that are closer move right together with the chain they feed, plus any
 * card they would land on. src and the cards feeding it never move — taking them along would
 * leave the gap as it was.
 */
function gapMoves(srcId: string, tgtIds: string[], nodes: FlowNode[], edges: SignalEdge[]): Map<string, Pt> {
  const moves   = new Map<string, Pt>()
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const src = nodeMap.get(srcId)
  if (!src) return moves
  const srcRight = cardRect(src).right
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
    const moved = [...moving].map((id) => cardRect(nodeMap.get(id)!, shift))
    next = nodes
      .filter((n) => !moving.has(n.id) && !fixed.has(n.id) && moved.some((r) => rectsOverlap(r, cardRect(n))))
      .map((n) => n.id)
  }

  for (const id of moving) {
    const n = nodeMap.get(id)!
    moves.set(id, { x: n.position.x + shift, y: n.position.y })
  }
  return moves
}

/**
 * Ensure a new src→tgt wire has room: tgt starts at least MIN_NODE_GAP right of src (see gapMoves).
 * `edges` are the wires before this one.
 */
export function enforceGap(
  srcId: string,
  tgtId: string,
  nodes: FlowNode[],
  edges: SignalEdge[],
  updatePos: (id: string, pos: Pt) => void,
) {
  for (const [id, pos] of gapMoves(srcId, [tgtId], nodes, edges)) updatePos(id, pos)
}

/**
 * New positions that make room for a card just dropped onto a wire (`nodes` hold it with its
 * real size, `edges` its new wires). The chain after it slides right (gapMoves); then, if a tall
 * card would cover cards below it or the wires running there, everything from the highest of
 * those cards down moves down as one block, so the rows underneath keep their shape and their
 * wires stay straight. The chain feeding the new card never moves.
 */
export function makeRoomForInsert(newId: string, nodes: FlowNode[], edges: SignalEdge[]): Map<string, Pt> {
  const targets = edges.filter((e) => e.source === newId).map((e) => e.target)
  const moves   = gapMoves(newId, targets, nodes, edges)
  const placed  = nodes.map((n) => {
    const pos = moves.get(n.id)
    return pos ? { ...n, position: pos } : n
  })
  const byId = new Map(placed.map((n) => [n.id, n]))
  const card = byId.get(newId)
  if (!card) return moves
  const r     = cardRect(card)
  const fixed = upstreamOf(newId, edges).nodeIds
  // Cards in its own row (top within its header) can't be moved out of its way downward
  const isBelow = (n: FlowNode) => !fixed.has(n.id) && n.position.y >= r.top + HEADER_H

  // A wire's first and last runs sit on its cards' port lines: one under the new card moves with its card
  const PAD = MIN_NODE_GAP / 2
  const runUnderCard = (a: Pt, b: Pt) =>
    a.y === b.y && a.y > r.top - PAD && a.y < r.bottom + PAD &&
    Math.max(a.x, b.x) > r.left && Math.min(a.x, b.x) < r.right

  const inTheWay = placed.filter((n) => isBelow(n) && rectsOverlap(r, cardRect(n)))
  for (const e of edges) {
    if (e.source === newId || e.target === newId) continue
    const src = byId.get(e.source)
    const tgt = byId.get(e.target)
    if (!src || !tgt) continue
    const route = orthogonalRoute([
      { x: cardRect(src).right, y: src.position.y + PORT_TOP },
      ...(e.waypoints ?? []),
      { x: tgt.position.x, y: tgt.position.y + PORT_TOP },
    ])
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
export function findEdgeAtPoint(
  point: Pt,
  edges: SignalEdge[],
  nodes: FlowNode[],
): SignalEdge | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  for (const edge of edges) {
    const src = nodeMap.get(edge.source)
    const tgt = nodeMap.get(edge.target)
    if (!src || !tgt) continue
    const srcDims = nodeDims(src.type ?? '', src.measured?.width, src.measured?.height)
    const tgtDims = nodeDims(tgt.type ?? '', tgt.measured?.width, tgt.measured?.height)
    const srcCX = src.position.x + srcDims.w / 2
    const tgtCX = tgt.position.x + tgtDims.w / 2
    if (point.x < srcCX || point.x > tgtCX) continue
    const minY = Math.min(src.position.y, tgt.position.y) + PORT_TOP - HIT_THRESHOLD
    const maxY = Math.max(src.position.y, tgt.position.y) + PORT_TOP + HIT_THRESHOLD
    if (point.y < minY || point.y > maxY) continue
    return edge
  }
  return null
}

/** True only for nodes that have both an input and an output port. */
export function canInsertMidChain(typeKey: string): boolean {
  const def = NODE_REGISTRY[typeKey]
  return !!def && def.inputs.length > 0 && def.outputs.length > 0
}
