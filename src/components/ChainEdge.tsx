import type { EdgeProps } from '@xyflow/react'
import { BaseEdge } from '@xyflow/react'
import { buildWirePath } from '../utils/wirePath'

type Pt = { x: number; y: number }

export interface ChainEdgeData extends Record<string, unknown> {
  waypoints?: Pt[]
  routingWarning?: boolean
}

export function ChainEdge({
  id, sourceX, sourceY, targetX, targetY,
  style, markerEnd,
  data,
}: EdgeProps) {
  const d           = (data ?? {}) as ChainEdgeData
  const waypoints   = d.waypoints ?? []
  const routingWarn = d.routingWarning ?? false

  // Build the path using the same algorithm as the live wire preview.
  const points: Pt[] = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }]
  const edgePath = buildWirePath(points)

  const edgeStyle = routingWarn
    ? { ...style, stroke: 'var(--signal-hot)', strokeDasharray: '6 4' }
    : style

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={edgeStyle}
      markerEnd={markerEnd}
      className={routingWarn ? undefined : 'signal-line-animated'}
    />
  )
}
