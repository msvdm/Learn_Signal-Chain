import { useState, useRef, useEffect } from 'react'
import type { MutableRefObject } from 'react'
import type { SignalEdge } from '../store/signalStore'
import type { Pt } from '../utils/layoutHelpers'

export type Reshaping = {
  edgeId: string
  waypointIndex: number  // -1 when inserting a new waypoint
  segmentIndex: number   // which segment (between waypoints[i] and [i+1])
  inserting: boolean
  livePos: Pt
}

export function useEdgeReshape(
  screenToFlowPosition: (p: Pt) => Pt,
  edgesRef: MutableRefObject<SignalEdge[]>,
  updateEdgeWaypoints: (id: string, waypoints: Pt[]) => void,
) {
  const [reshaping, setReshaping] = useState<Reshaping | null>(null)
  const reshapingRef = useRef(reshaping)
  reshapingRef.current = reshaping

  useEffect(() => {
    function onReshapeMove(e: MouseEvent) {
      const r = reshapingRef.current
      if (!r) return
      const fp = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setReshaping((prev) => prev ? { ...prev, livePos: fp } : prev)
    }

    function onReshapeUp(e: MouseEvent) {
      const r = reshapingRef.current
      if (!r) return
      e.stopPropagation()
      const fp = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const edge = edgesRef.current.find((ed) => ed.id === r.edgeId)
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
  }, [screenToFlowPosition, updateEdgeWaypoints])

  return { reshaping, setReshaping }
}
