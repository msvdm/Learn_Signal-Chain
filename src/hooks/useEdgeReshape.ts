import { useState, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useSignalStore } from '../store/signalStore'
import type { Pt } from '../utils/geometry'
import { useLatestRef } from './useLatestRef'
import { snapBend } from '../utils/layoutHelpers'

export type Reshaping = {
  edgeId: string
  waypointIndex: number  // -1 when inserting a new waypoint
  segmentIndex: number   // which segment (between waypoints[i] and [i+1])
  inserting: boolean
  livePos: Pt
}

/** Dragging a wire's corner (or a segment's midpoint, which adds a corner): committed on release, on the grid when Snap to grid is on. */
export function useEdgeReshape() {
  const { screenToFlowPosition } = useReactFlow()
  const [reshaping, setReshaping] = useState<Reshaping | null>(null)
  const reshapingRef = useLatestRef(reshaping)

  useEffect(() => {
    function onReshapeMove(e: MouseEvent) {
      const r = reshapingRef.current
      if (!r) return
      const fp = snapBend(screenToFlowPosition({ x: e.clientX, y: e.clientY }), useSignalStore.getState().snapToGrid)
      setReshaping((prev) => prev ? { ...prev, livePos: fp } : prev)
    }

    function onReshapeUp(e: MouseEvent) {
      const r = reshapingRef.current
      if (!r) return
      e.stopPropagation()
      const fp = snapBend(screenToFlowPosition({ x: e.clientX, y: e.clientY }), useSignalStore.getState().snapToGrid)
      const { edges, updateEdgeWaypoints } = useSignalStore.getState()
      const edge = edges.find((ed) => ed.id === r.edgeId)
      if (edge) {
        const wps = [...(edge.waypoints ?? [])]
        if (r.inserting) {
          wps.splice(r.segmentIndex + 1, 0, fp)
        } else {
          wps[r.waypointIndex] = fp
        }
        updateEdgeWaypoints(r.edgeId, wps)
      }
      setReshaping(null)
    }

    document.addEventListener('mousemove', onReshapeMove)
    document.addEventListener('mouseup', onReshapeUp, true)
    return () => {
      document.removeEventListener('mousemove', onReshapeMove)
      document.removeEventListener('mouseup', onReshapeUp, true)
    }
  }, [screenToFlowPosition, reshapingRef])

  return { reshaping, setReshaping }
}
