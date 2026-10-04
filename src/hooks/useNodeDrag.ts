import { useState } from 'react'
import type { Node as FlowNode } from '@xyflow/react'
import { useSignalStore } from '../store/signalStore'
import type { TypeKey } from '../data/nodeRegistry'
import { resolveOverlap } from '../utils/layoutHelpers'
import type { Pt } from '../utils/geometry'
import { useCanvasLayout } from './useCanvasLayout'

/** Where a card will land, drawn as a dashed outline while it is dragged (or dropped from the palette). */
export interface Ghost { pos: Pt; w: number; h: number }

/**
 * Moving elements. Positions stay the store's: a drag shows where the elements will land and
 * commits on release — one element snapped and clear of the other cards, a selection moved
 * together (wires between them take their bends along).
 */
export function useNodeDrag() {
  const layout = useCanvasLayout()
  const [ghosts, setGhosts] = useState<Ghost[]>([])

  /** How far a dragged selection moves: the grabbed element snaps, the others keep their places around it. */
  function groupDelta(node: FlowNode): Pt {
    const from = useSignalStore.getState().nodes.find((n) => n.id === node.id)?.position ?? node.position
    const to   = layout.snap(node.position)
    return { x: to.x - from.x, y: to.y - from.y }
  }

  /** Where one dragged element lands: snapped, and clear of the other cards. */
  function landing(node: FlowNode): Ghost {
    const size = layout.sizeOf({ id: node.id, typeKey: node.type as TypeKey })
    return { pos: resolveOverlap(layout.snap(node.position), size, layout.layoutSnapshot(), node.id), ...size }
  }

  function onNodeDrag(_e: React.MouseEvent, node: FlowNode, dragged: FlowNode[]) {
    if (dragged.length <= 1) { setGhosts([landing(node)]); return }
    const d = groupDelta(node)
    setGhosts(useSignalStore.getState().nodes
      .filter((n) => dragged.some((x) => x.id === n.id))
      .map((n) => ({ pos: { x: n.position.x + d.x, y: n.position.y + d.y }, ...layout.sizeOf(n) })))
  }

  function onNodeDragStop(_e: React.MouseEvent, node: FlowNode, dragged: FlowNode[]) {
    setGhosts([])
    const { moveNodes, setPositions } = useSignalStore.getState()
    if (dragged.length > 1) moveNodes(dragged.map((n) => n.id), groupDelta(node))
    else setPositions(new Map([[node.id, landing(node).pos]]))
  }

  return { ghosts, onNodeDrag, onNodeDragStop }
}
