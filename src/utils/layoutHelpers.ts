import type { Node as FlowNode } from '@xyflow/react'
import type { SignalEdge } from '../store/signalStore'
import { NODE_REGISTRY } from '../data/nodeRegistry'
import { CENTER_LEFT_BOUND, CENTER_RIGHT_BOUND, MIN_NODE_GAP, getZone } from '../data/zoneConstants'

export type Pt = { x: number; y: number }

export const GRID = 36

export const INLINE_TYPE_KEYS = new Set([
  'mic', 'line-in', 'instrument', 'fader', 'switch', 'potentiometer', 'speaker',
  'gain', 'adc', 'dac',
])

/**
 * Default rendered widths per node type.
 * Used as fallback when React Flow has not yet measured a node (always the case
 * for a node about to be dropped). For existing nodes, measured.width takes precedence.
 * EQ uses 600 (advanced 4-band layout) as the conservative upper bound.
 */
export const NODE_DEFAULT_W: Record<string, number> = {
  'mic': 100, 'line-in': 100, 'instrument': 100,
  'fader': 100, 'switch': 100, 'potentiometer': 100, 'speaker': 100,
  'gain': 100, 'adc': 100, 'dac': 100,
  'relay': 130, 'pan': 130,
  'hpf': 140,
  'eq': 600,
  'graphic-eq': 340,
  'di-box': 208, 'noise-gate': 220, 'limiter': 208, 'deesser': 208,
  'amp': 208, 'comp': 220, 'master-bus': 208,
  'mono-bus': 208, 'stereo-bus': 208, 'stereo-fader': 208, 'balance': 208,
  'audio-interface': 208, 'active-speaker': 208,
}

export const BUS_TYPES = new Set(['mono-bus', 'stereo-bus', 'master-bus'])

export const HIT_THRESHOLD = 48

// ── Dimension helpers ──────────────────────────────────────────────────────────

export function nodeDims(typeKey: string, measuredW?: number, measuredH?: number) {
  const inline = INLINE_TYPE_KEYS.has(typeKey)
  return {
    w: measuredW ?? NODE_DEFAULT_W[typeKey] ?? (inline ? 100 : 208),
    h: measuredH ?? (inline ? 72 : 120),
  }
}

// nodeOrigin=[0,0.5]: position is the left edge, vertical center
function nodeRect(pos: Pt, w: number, h: number) {
  return { left: pos.x, right: pos.x + w, top: pos.y - h / 2, bottom: pos.y + h / 2 }
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

/** Snap a non-bus node out of the center zone to the nearest zone boundary. */
export function snapOutOfCenter(pos: Pt, w: number, isAdvancedOrIntermediate: boolean): Pt {
  if (!isAdvancedOrIntermediate) return pos
  if (getZone(pos.x) !== 'center') return pos
  const nodeMidX  = pos.x + w / 2
  const centerMidX = (CENTER_LEFT_BOUND + CENTER_RIGHT_BOUND) / 2
  if (nodeMidX <= centerMidX) {
    return { ...pos, x: Math.floor((CENTER_LEFT_BOUND - w) / GRID) * GRID }
  } else {
    return { ...pos, x: Math.ceil(CENTER_RIGHT_BOUND / GRID) * GRID }
  }
}

// ── Zone push helpers ──────────────────────────────────────────────────────────

/** Push every non-bus node at or after fromX rightward by amount (grid-snapped). */
export function pushDownstream(
  fromX: number,
  amount: number,
  nodes: FlowNode[],
  nodeMap: Map<string, FlowNode>,
  updatePos: (id: string, pos: Pt) => void,
) {
  const snapped = Math.ceil(amount / GRID) * GRID
  for (const n of nodes) {
    if (BUS_TYPES.has(n.type ?? '')) continue
    if (n.position.x >= fromX - GRID / 2) {
      const newPos = { x: n.position.x + snapped, y: n.position.y }
      nodeMap.set(n.id, { ...n, position: newPos })
      updatePos(n.id, newPos)
    }
  }
}

/** Push every non-bus node ending at or before fromX leftward by amount (grid-snapped). */
export function pushUpstream(
  fromX: number,
  amount: number,
  nodes: FlowNode[],
  nodeMap: Map<string, FlowNode>,
  updatePos: (id: string, pos: Pt) => void,
  skipId?: string,
) {
  const snapped = Math.ceil(amount / GRID) * GRID
  for (const n of nodes) {
    if (n.id === skipId) continue
    if (BUS_TYPES.has(n.type ?? '')) continue
    const dims = nodeDims(n.type ?? '', n.measured?.width, n.measured?.height)
    if (n.position.x + dims.w <= fromX + GRID / 2) {
      const newPos = { x: n.position.x - snapped, y: n.position.y }
      nodeMap.set(n.id, { ...n, position: newPos })
      updatePos(n.id, newPos)
    }
  }
}

/** Push nodes leftward to clear space for a new node landing at newNodeX.
 *  Only considers nodes that start to the LEFT of newNodeX — nodes to the right are unaffected. */
export function shiftNodesLeft(
  newNodeX: number,
  nodes: FlowNode[],
  updatePos: (id: string, pos: Pt) => void,
) {
  const targets = [...nodes]
    .filter(n => !BUS_TYPES.has(n.type ?? '') && n.position.x < newNodeX)
    .sort((a, b) => b.position.x - a.position.x)
  let clearBefore = newNodeX - MIN_NODE_GAP
  for (const n of targets) {
    const nd = nodeDims(n.type ?? '', n.measured?.width, n.measured?.height)
    if (n.position.x + nd.w > clearBefore) {
      const newX = Math.floor((clearBefore - nd.w) / GRID) * GRID
      updatePos(n.id, { x: newX, y: n.position.y })
      clearBefore = newX - MIN_NODE_GAP
    }
  }
}

/** Push nodes rightward to clear space for a new node at newNodeX with width newNodeW.
 *  Only considers nodes that start to the RIGHT of newNodeX — nodes to the left are unaffected. */
export function shiftNodesRight(
  newNodeX: number,
  newNodeW: number,
  nodes: FlowNode[],
  updatePos: (id: string, pos: Pt) => void,
) {
  const targets = [...nodes]
    .filter(n => !BUS_TYPES.has(n.type ?? '') && n.position.x > newNodeX)
    .sort((a, b) => a.position.x - b.position.x)
  let clearAfter = newNodeX + newNodeW + MIN_NODE_GAP
  for (const n of targets) {
    if (n.position.x < clearAfter) {
      const nd = nodeDims(n.type ?? '', n.measured?.width, n.measured?.height)
      const newX = Math.ceil(clearAfter / GRID) * GRID
      updatePos(n.id, { x: newX, y: n.position.y })
      clearAfter = newX + nd.w + MIN_NODE_GAP
    }
  }
}

/** Ensure src→tgt pair has at least MIN_NODE_GAP, pushing tgt (and everything downstream) right. */
export function enforceGap(
  srcId: string,
  tgtId: string,
  nodes: FlowNode[],
  updatePos: (id: string, pos: Pt) => void,
) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const src = nodeMap.get(srcId)
  const tgt = nodeMap.get(tgtId)
  if (!src || !tgt) return
  const srcDims = nodeDims(src.type ?? '', src.measured?.width, src.measured?.height)
  const gap = tgt.position.x - (src.position.x + srcDims.w)
  if (gap < MIN_NODE_GAP) {
    pushDownstream(tgt.position.x, MIN_NODE_GAP - gap, nodes, nodeMap, updatePos)
  }
}

// ── Edge insertion helpers ─────────────────────────────────────────────────────

/**
 * Returns the edge that "owns" the given flow-coordinate drop point.
 * Each edge owns the horizontal band between the centre of its source and target.
 * Vertical tolerance is ±HIT_THRESHOLD around both node centres.
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
    const minY = Math.min(src.position.y, tgt.position.y) - HIT_THRESHOLD
    const maxY = Math.max(src.position.y, tgt.position.y) + HIT_THRESHOLD
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
