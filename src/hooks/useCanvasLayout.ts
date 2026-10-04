import { useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { Node as FlowNode } from '@xyflow/react'
import { useSignalStore } from '../store/signalStore'
import type { SignalNode } from '../store/signalStore'
import { PORT_TOP, nodeDims, snapPoint } from '../utils/layoutHelpers'
import type { Pt } from '../utils/layoutHelpers'

/**
 * The cards as the layout helpers need them — with React Flow's measured sizes (cards size
 * themselves to their content) — and snapping. Every function reads the current state when called.
 */
export function useCanvasLayout() {
  const { getNodes, getInternalNode } = useReactFlow()
  return useMemo(() => {
    const measuredOf = (id: string) => getInternalNode(id)?.measured
    /** `p` on the grid when Snap to grid is on, else on whole pixels. */
    const snap = (p: Pt) => snapPoint(p, useSignalStore.getState().snapToGrid)
    return {
      snap,
      /** Top-left of a card dropped at `p`: the cursor sits on its port line. */
      dropOrigin: (p: Pt) => snap({ x: p.x, y: p.y - PORT_TOP }),
      /** React Flow's nodes with their real rendered size. */
      measuredNodes: (): FlowNode[] =>
        getNodes().map((n) => ({ ...n, measured: measuredOf(n.id) ?? n.measured })),
      /** The store's nodes (always current) with React Flow's measured sizes. */
      layoutNodes: (nodes: SignalNode[] = useSignalStore.getState().nodes): FlowNode[] =>
        nodes.map((n) => ({ id: n.id, type: n.typeKey, position: n.position, data: {}, measured: measuredOf(n.id) })),
      /** An element's real size. */
      sizeOf: (n: { id: string; typeKey: string }) => {
        const m = measuredOf(n.id)
        return nodeDims(n.typeKey, m?.width, m?.height)
      },
    }
  }, [getNodes, getInternalNode])
}
