import type { Facing, NodePort, SignalEdge, TypeKey } from '../data/nodeRegistry'
import { NODE_REGISTRY, SOUND_PORT, isBareAt, isTypeKey, portFacing, portRows } from '../data/nodeRegistry'
import type { ComplexityLevel } from '../data/levels'
import { graphOf, upstreamOf } from '../graph/graph'
import type { GraphView } from '../graph/graph'
import { drawnPorts } from '../graph/queries'
import { orthogonalRoute } from './wirePath'
import { HEADER_H, PORT_GAP, PORT_TOP } from './cardGeometry'
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

// Room left between cards: a card dropped onto a wire pushes the chain after it this far right of
// itself, and a copy sits this far beside its original.
export const MIN_NODE_GAP = 100

/** Cards closer than this to each other (in any direction) count as overlapping. */
const CLEARANCE = MIN_NODE_GAP / 2

// ── Card geometry ──────────────────────────────────────────────────────────────
// (HEADER_H, PORT_TOP, PORT_GAP: cardGeometry.ts — wires are routed by them too)
export { HEADER_H, PORT_TOP, PORT_GAP } from './cardGeometry'
// How far from a port's centre the mouse finds it (the cursor turns into a cross): twice the
// ring's radius, so a port is easy to hit zoomed out — the ring itself stays 28px. Ports stacked
// closer than twice this share the room between them half and half (NodePort).
export const PORT_REACH = 28

/**
 * The centre of a port ring: on the edge it faces (`facing`: inputs left, outputs right — a flipped
 * card's the other way, portFacing), on port line `row` (portRows) — halfway down it when `middle`
 * (a Sound output); on its top or bottom edge, in the middle.
 */
export function portPoint(
  card: Box, type: 'source' | 'target', row: number, facing: Facing = type === 'source' ? 'right' : 'left', middle = false,
): Pt {
  const { x, y } = card.position
  const across   = middle ? y + card.size.h / 2 : y + PORT_TOP + row * PORT_GAP
  switch (facing) {
    case 'left':   return { x, y: across }
    case 'right':  return { x: x + card.size.w, y: across }
    case 'top':    return { x: x + card.size.w / 2, y }
    case 'bottom': return { x: x + card.size.w / 2, y: y + card.size.h }
  }
}

/**
 * A wire's route as it is drawn — from its output's ring, through its corners, to its input's,
 * out of and into the sides they face — or null when a card of it is missing from `cards`.
 */
export function wireRoute(edge: SignalEdge, cards: Box[], view: GraphView, level: ComplexityLevel): Pt[] | null {
  const graph   = graphOf(view)
  const src     = cards.find((c) => c.id === edge.source)
  const tgt     = cards.find((c) => c.id === edge.target)
  const srcNode = graph.node(edge.source)
  const tgtNode = graph.node(edge.target)
  if (!src || !tgt || !srcNode || !tgtNode) return null
  const outs = drawnPorts(srcNode, level, view).outputs
  const ins  = drawnPorts(tgtNode, level, view).inputs
  // Each port on its own line (a port's row, else its place)
  const outAt = outs.findIndex((p) => p.id === edge.sourceHandle)
  const out  = portRows(outs)[outAt] ?? 0
  const inp  = portRows(ins)[ins.findIndex((p) => p.id === edge.targetHandle)] ?? 0
  const from = portFacing(srcNode, 'source')
  const to   = portFacing(tgtNode, 'target')
  const start = portPoint(src, 'source', out, from, outs[outAt]?.middle)
  const end   = portPoint(tgt, 'target', inp, to)
  // Sound in the air goes straight to the microphone (components/SoundWaves.tsx)
  if (edge.sourceHandle === SOUND_PORT) return [start, end]
  return orthogonalRoute([start, ...(edge.waypoints ?? []), end], { from, to })
}

// A card's size when its type has no `minSize` in the registry (most cards have one: the same at
// every level).
export const CARD_MIN_W = 280
export const CARD_MIN_H = 210

/** The smallest a card of this type can be (it grows with its content). */
export function cardMinSize(typeKey: TypeKey): Size {
  return NODE_REGISTRY[typeKey].minSize ?? { w: CARD_MIN_W, h: CARD_MIN_H }
}

/** A card's height at least: its type's, or tall enough for its lowest port. */
export function cardHeight(typeKey: TypeKey, ports: { inputs: NodePort[]; outputs: NodePort[] }): number {
  const lastRow = Math.max(0, ...portRows(ports.inputs), ...portRows(ports.outputs))
  return Math.max(cardMinSize(typeKey).h, PORT_TOP + lastRow * PORT_GAP + 24)
}

/**
 * Size of a node that React Flow has not measured yet (a node about to be dropped): its minimum
 * size. Nodes size themselves to their content, so once any node of a type has been measured its
 * real size is remembered and used instead — per shape: the Compressor, the Equalizer and the HPF
 * are bare controls below Advanced, cards above (isBareAt); Beginner has faces of its own (D20).
 */
const measuredSizeByType = new Map<string, Size>()

const shapeKey = (typeKey: string, level?: ComplexityLevel, overview?: boolean) =>
  // Beginner draws its own faces (D20): sizes of their own
  (level === 'beginner' ? `${typeKey}:beginner`
    : level && isTypeKey(typeKey) && isBareAt(typeKey, level, overview) ? `${typeKey}:bare` : typeKey)

export function recordMeasuredSize(typeKey: string, w: number, h: number, level?: ComplexityLevel, overview?: boolean) {
  if (w > 0 && h > 0) measuredSizeByType.set(shapeKey(typeKey, level, overview), { w, h })
}

export const HIT_THRESHOLD = 48

// ── Dimension helpers ──────────────────────────────────────────────────────────

/** A type never measured: a free-standing control's usual size (a card's below Advanced: bareSize), else a card's minimum. */
function unmeasuredSize(typeKey: string, level?: ComplexityLevel, overview?: boolean): Size {
  if (!isTypeKey(typeKey)) return { w: CARD_MIN_W, h: CARD_MIN_H }
  const def  = NODE_REGISTRY[typeKey]
  const bare = level && isBareAt(typeKey, level, overview) ? def.bareSize : undefined
  return bare ?? def.freeSize ?? cardMinSize(typeKey)
}

/**
 * The size of an element not drawn yet (a drop preview, a card about to be placed) at this level
 * and zoom: the last measured size of its type, else its type's usual size. `typeKey` may be React
 * Flow's node type (a string).
 */
export function usualSize(typeKey: string, level?: ComplexityLevel, overview?: boolean): Size {
  return measuredSizeByType.get(shapeKey(typeKey, level, overview)) ?? unmeasuredSize(typeKey, level, overview)
}

/** An element's size: React Flow's measurement, else its usual size (usualSize). */
export function nodeDims(typeKey: string, measuredW?: number, measuredH?: number, level?: ComplexityLevel, overview?: boolean): Size {
  const known = usualSize(typeKey, level, overview)
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
    // (Sound in the air goes straight, over any card: nothing to make room for)
    if (!src || !tgt || e.sourceHandle === SOUND_PORT) continue
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

/** How far a point is from the segment a–b */
function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/**
 * The wire under a drop point (flow coordinates): the nearest one within HIT_THRESHOLD of the point,
 * along its route as it is drawn (wireRoute) — a wire turning down to a PFL Bus as well as a
 * straight one. `firstRun`: the point is on its first run, along its output's port line (a card
 * dropped there sits right of its source, and both wires stay straight).
 */
export function findEdgeAtPoint(
  point: Pt, edges: SignalEdge[], cards: Box[], view: GraphView, level: ComplexityLevel,
): { edge: SignalEdge; firstRun: boolean } | null {
  let best: { edge: SignalEdge; firstRun: boolean; distance: number } | null = null
  for (const edge of edges) {
    const route = wireRoute(edge, cards, view, level)
    if (!route || route.length < 2) continue
    // The runs from its output, rightward along its port line, before it first turns
    let onLine = 0
    while (route[1].x > route[0].x && onLine < route.length - 1 && route[onLine + 1].y === route[0].y) onLine++
    for (let i = 0; i < route.length - 1; i++) {
      const distance = distanceToSegment(point, route[i], route[i + 1])
      if (distance > HIT_THRESHOLD || (best && distance >= best.distance)) continue
      best = { edge, distance, firstRun: i < onLine }
    }
  }
  return best && { edge: best.edge, firstRun: best.firstRun }
}

