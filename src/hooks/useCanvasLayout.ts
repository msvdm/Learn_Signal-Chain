import { useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useSignalStore } from '../store/signalStore'
import type { SignalNode } from '../store/signalStore'
import { PORT_TOP, nodeDims, snapPoint } from '../utils/layoutHelpers'
import type { Box, Pt, Size } from '../utils/geometry'

/**
 * The cards as the layout helpers need them — where they are (the store's positions) and how big
 * (React Flow's measurement: cards size themselves to their content) — and snapping. Every
 * function reads the current state when called.
 */
export function useCanvasLayout() {
  const { getInternalNode } = useReactFlow()
  return useMemo(() => {
    /** An element's real size (its type's usual size until React Flow has drawn it). */
    const sizeOf = (n: Pick<SignalNode, 'id' | 'typeKey'>): Size => {
      const m = getInternalNode(n.id)?.measured
      return nodeDims(n.typeKey, m?.width, m?.height)
    }
    /** `p` on the grid when Snap to grid is on, else on whole pixels. */
    const snap = (p: Pt) => snapPoint(p, useSignalStore.getState().snapToGrid)
    return {
      sizeOf,
      snap,
      /** Top-left of a card dropped at `p`: the cursor sits on its port line. */
      dropOrigin: (p: Pt) => snap({ x: p.x, y: p.y - PORT_TOP }),
      /** Every element on the canvas (or `nodes`), with its real size. */
      layoutSnapshot: (nodes: SignalNode[] = useSignalStore.getState().nodes): Box[] =>
        nodes.map((n) => ({ id: n.id, position: n.position, size: sizeOf(n) })),
    }
  }, [getInternalNode])
}
