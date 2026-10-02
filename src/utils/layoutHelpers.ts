import type { Node as FlowNode } from '@xyflow/react'
import type { SignalEdge } from '../store/signalStore'
import { NODE_REGISTRY } from '../data/nodeRegistry'
import { upstreamOf } from './chainColors'

export type Pt = { x: number; y: number }

export const GRID = 36

// Minimum clearance between any two nodes, in all directions.
export const MIN_NODE_GAP = 100

// ── Card geometry ──────────────────────────────────────────────────────────────
// Every node card shares the same header height and port line, so wires between
// cards stay straight no matter how tall each card is.
export const HEADER_H = 56
export const PORT_TOP = 28   // first port centre, measured from the card top
export const PORT_GAP = 24   // spacing between stacked ports on the same side

/**
 * Size of a node that React Flow has not measured yet (a node about to be dropped).
 * Nodes size themselves to their content, so there is no per-type table: once any
 * node of a type has been measured its real size is remembered and used instead.
 */
const FALLBACK_SIZE = { w: 160, h: 120 }
const measuredSizeByType = new Map<string, { w: number; h: number }>()

export function recordMeasuredSize(typeKey: string, w: number, h: number) {
  if (w > 0 && h > 0) measuredSizeByType.set(typeKey, { w, h })
}

export const HIT_THRESHOLD = 48

// ── Dimension helpers ──────────────────────────────────────────────────────────

export function nodeDims(typeKey: string, measuredW?: number, measuredH?: number) {
  const known = measuredSizeByType.get(typeKey) ?? FALLBACK_SIZE
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

/** Push every node at or after fromX rightward by amount (grid-snapped). */
export function pushDownstream(
  fromX: number,
  amount: number,
  nodes: FlowNode[],
  nodeMap: Map<string, FlowNode>,
  updatePos: (id: string, pos: Pt) => void,
) {
  const snapped = Math.ceil(amount / GRID) * GRID
  for (const n of nodes) {
    if (n.position.x >= fromX - GRID / 2) {
      const newPos = { x: n.position.x + snapped, y: n.position.y }
      nodeMap.set(n.id, { ...n, position: newPos })
      updatePos(n.id, newPos)
    }
  }
}

/**
 * Ensure a new src→tgt wire has room: tgt starts at least MIN_NODE_GAP right of src.
 * If not, tgt and the chain it feeds move right together, plus any card they would land on.
 * src and the cards feeding it never move — taking them along would leave the gap as it was.
 * `edges` are the wires before this one.
 */
export function enforceGap(
  srcId: string,
  tgtId: string,
  nodes: FlowNode[],
  edges: SignalEdge[],
  updatePos: (id: string, pos: Pt) => void,
) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const src = nodeMap.get(srcId)
  const tgt = nodeMap.get(tgtId)
  if (!src || !tgt) return
  const srcDims = nodeDims(src.type ?? '', src.measured?.width, src.measured?.height)
  const gap = tgt.position.x - (src.position.x + srcDims.w)
  if (gap >= MIN_NODE_GAP) return

  const fixed = upstreamOf(srcId, edges).nodeIds
  // The wire loops back into its own chain — there is no left-to-right order to restore
  if (fixed.has(tgtId)) return
  const shift = Math.ceil((MIN_NODE_GAP - gap) / GRID) * GRID

  function rectOf(n: FlowNode, dx = 0) {
    const d = nodeDims(n.type ?? '', n.measured?.width, n.measured?.height)
    return nodeRect({ x: n.position.x + dx, y: n.position.y }, d.w, d.h)
  }

  const moving = new Set<string>()
  let next = [tgtId]
  while (next.length > 0) {
    // These cards move, and so does everything they feed
    while (next.length > 0) {
      const id = next.pop()!
      if (moving.has(id) || fixed.has(id) || !nodeMap.has(id)) continue
      moving.add(id)
      for (const e of edges) if (e.source === id) next.push(e.target)
    }
    // Then any card a moved card would now land on
    const moved = [...moving].map((id) => rectOf(nodeMap.get(id)!, shift))
    next = nodes
      .filter((n) => !moving.has(n.id) && !fixed.has(n.id) && moved.some((r) => rectsOverlap(r, rectOf(n))))
      .map((n) => n.id)
  }

  for (const id of moving) {
    const n = nodeMap.get(id)!
    updatePos(id, { x: n.position.x + shift, y: n.position.y })
  }
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
