import type { EdgeProps } from '@xyflow/react'
import { getSmoothStepPath, BaseEdge } from '@xyflow/react'

export function ChainEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style, markerEnd,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 0,
  })
  return <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
}
