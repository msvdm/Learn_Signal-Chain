import type { SignalNode, SignalEdge } from '../data/nodeRegistry'
import { NODE_REGISTRY, matrixSendParam } from '../data/nodeRegistry'
import { nodeAcceptsWire, portAcceptsWire } from '../graph/connectionRules'
import { newEdge } from '../graph/edits'
import { GRID, MIN_NODE_GAP } from './layoutHelpers'
import type { Box, Pt, Size } from './geometry'
import { rectOf, rectsOverlap } from './geometry'

export type Direction = 'left' | 'right' | 'up' | 'down'

/** A copied piece of the graph (Copy / Cut / Duplicate): a snapshot, so later edits don't change it. */
export interface NodeGroup {
  nodes: SignalNode[]
  /** Wires between the group's elements */
  edges: SignalEdge[]
  /** Wires from the group to an element outside it — kept where that input takes another wire (a bus) */
  outEdges: SignalEdge[]
  /** Each element's size when it was copied, for placing the copy */
  sizes: Record<string, Size>
}

export function takeGroup(
  ids: string[],
  nodes: SignalNode[],
  edges: SignalEdge[],
  sizeOf: (n: SignalNode) => Size,
): NodeGroup {
  const inGroup = new Set(ids)
  const picked  = nodes.filter((n) => inGroup.has(n.id))
  return structuredClone({
    nodes:    picked,
    edges:    edges.filter((e) => inGroup.has(e.source) && inGroup.has(e.target)),
    outEdges: edges.filter((e) => inGroup.has(e.source) && !inGroup.has(e.target)),
    sizes:    Object.fromEntries(picked.map((n) => [n.id, sizeOf(n)])),
  })
}

/** The rectangle around every element of the group. */
export function groupBox(group: NodeGroup) {
  const rects = group.nodes.map((n) => ({ ...n.position, ...group.sizes[n.id] }))
  return {
    left:   Math.min(...rects.map((r) => r.x)),
    top:    Math.min(...rects.map((r) => r.y)),
    right:  Math.max(...rects.map((r) => r.x + r.w)),
    bottom: Math.max(...rects.map((r) => r.y + r.h)),
  }
}

// Whole grid steps, so a copy of grid-snapped elements is snapped too
const toGrid = (v: number) => Math.ceil(v / GRID) * GRID

const STEP: Record<Direction, Pt> = {
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
}

/**
 * Moves `start` on in `dir`, one grid step at a time, until the group moved by it keeps
 * MIN_NODE_GAP from every element in `others`.
 */
function clearOffset(group: NodeGroup, start: Pt, dir: Direction, others: Box[]): Pt {
  const rects   = others.map((o) => rectOf(o.position, o.size))
  const clashes = (off: Pt) => group.nodes.some((n) => {
    const a = rectOf({ x: n.position.x + off.x, y: n.position.y + off.y }, group.sizes[n.id])
    return rects.some((r) => rectsOverlap(a, r, MIN_NODE_GAP / 2))
  })
  let off = start
  for (let i = 0; i < 200 && clashes(off); i++) {
    off = { x: off.x + STEP[dir].x * GRID, y: off.y + STEP[dir].y * GRID }
  }
  return off
}

/** How far the copy of a group moves to sit beside it in `dir`, clear of every element. */
export function duplicateOffset(group: NodeGroup, dir: Direction, others: Box[]): Pt {
  const box  = groupBox(group)
  const dx   = toGrid(box.right - box.left + MIN_NODE_GAP)
  const dy   = toGrid(box.bottom - box.top + MIN_NODE_GAP)
  const step = STEP[dir]
  return clearOffset(group, { x: step.x * dx, y: step.y * dy }, dir, others)
}

/**
 * How far a group from somewhere else (an opened file) moves to sit beside everything on the
 * canvas in `dir`: lined up with the canvas's top (left / right) or left edge (up / down),
 * MIN_NODE_GAP away, clear of every element.
 */
export function besideOffset(group: NodeGroup, dir: Direction, others: Box[]): Pt {
  if (others.length === 0) return { x: 0, y: 0 }
  const box = groupBox(group)
  const all = {
    left:   Math.min(...others.map((o) => o.position.x)),
    top:    Math.min(...others.map((o) => o.position.y)),
    right:  Math.max(...others.map((o) => o.position.x + o.size.w)),
    bottom: Math.max(...others.map((o) => o.position.y + o.size.h)),
  }
  const x = { left: all.left - MIN_NODE_GAP - box.right, right: all.right + MIN_NODE_GAP - box.left }
  const y = { up: all.top - MIN_NODE_GAP - box.bottom, down: all.bottom + MIN_NODE_GAP - box.top }
  // Whole grid steps away from the canvas, so grid-snapped elements stay snapped
  const away  = (v: number, sign: number) => sign * toGrid(sign * v)
  const start = dir === 'left' || dir === 'right'
    ? { x: away(x[dir], STEP[dir].x), y: Math.round((all.top - box.top) / GRID) * GRID }
    : { x: Math.round((all.left - box.left) / GRID) * GRID, y: away(y[dir], STEP[dir].y) }
  return clearOffset(group, start, dir, others)
}

/** How far a pasted group moves so its top-left corner lands at `at`, clear of every element. */
export function pasteOffset(group: NodeGroup, at: Pt, others: Box[]): Pt {
  const box = groupBox(group)
  return clearOffset(group, { x: at.x - box.left, y: at.y - box.top }, 'down', others)
}

/**
 * A fresh copy of the group, moved by `offset`: new ids, the wires between its elements, and its
 * wires into a bus that still takes them (a copied channel joins the same mix). Wires into an
 * input that holds only one wire are left out.
 */
export function cloneGroup(
  group: NodeGroup,
  offset: Pt,
  graph: { nodes: SignalNode[]; edges: SignalEdge[] },
): { nodes: SignalNode[]; edges: SignalEdge[] } {
  const stamp = Date.now()
  const ids   = new Map(group.nodes.map((n, i) => [n.id, `${n.typeKey}-${stamp}-${i}`]))
  const move  = (p: Pt) => ({ x: p.x + offset.x, y: p.y + offset.y })

  const nodes: SignalNode[] = group.nodes.map((n) => ({
    ...structuredClone(n),
    id:       ids.get(n.id)!,
    position: move(n.position),
    // A Matrix Bus copied with its buses keeps their send knobs
    params:   Object.fromEntries(Object.entries(structuredClone(n.params)).map(([k, v]) => {
      const bus = [...ids].find(([oldId]) => k === matrixSendParam(oldId))
      return [bus ? matrixSendParam(bus[1]) : k, v]
    })),
    // A copied source starts a chain of its own: it gets its own colour when added
    color:    NODE_REGISTRY[n.typeKey].category === 'source' ? undefined : n.color,
  }))

  const edges: SignalEdge[] = group.edges.map((e) => newEdge({
    ...e,
    source:    ids.get(e.source)!,
    target:    ids.get(e.target)!,
    waypoints: e.waypoints?.map(move),
  }))

  const allNodes = [...graph.nodes, ...nodes]
  for (const e of group.outEdges) {
    const target = graph.nodes.find((n) => n.id === e.target)
    const source = { nodeId: ids.get(e.source)!, handleId: e.sourceHandle }
    const all    = [...graph.edges, ...edges]
    if (!target || !nodeAcceptsWire(target, source, all, allNodes) ||
        !portAcceptsWire(target, e.targetHandle, all, source)) continue
    edges.push(newEdge({
      source: source.nodeId, sourceHandle: e.sourceHandle,
      target: e.target, targetHandle: e.targetHandle,
    }))
  }

  return { nodes, edges }
}
