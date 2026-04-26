import type { EdgeProps } from '@xyflow/react'
import { getStraightPath, BaseEdge } from '@xyflow/react'

export function ChainEdge({
  id, sourceX, sourceY, targetX, targetY, style, markerEnd,
}: EdgeProps) {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY })
  return <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
}
