import { useState } from 'react'
import type { EdgeProps } from '@xyflow/react'
import { getSmoothStepPath, BaseEdge, EdgeLabelRenderer } from '@xyflow/react'
import { useSignalStore } from '../store/signalStore'

export function ChainEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style, markerEnd,
  data,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const removeEdge = useSignalStore((s) => s.removeEdge)

  // Stagger parallel edges that share the same target node by shifting their center X.
  // centerXOffset is computed in SignalChain.tsx and passed via edge data.
  const centerXOffset = ((data as Record<string, unknown>)?.centerXOffset as number) ?? 0
  const defaultCenterX = (sourceX + targetX) / 2

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 0,
    centerX: defaultCenterX + centerXOffset,
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {/* Wide invisible hit zone makes hovering easy for beginners */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 10,
            }}
            className="nodrag nopan"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <button
              onClick={() => removeEdge(id)}
              title="Delete connection"
              style={{
                width: 20, height: 20,
                borderRadius: '50%',
                border: '1px solid var(--lsc-border)',
                background: 'var(--lsc-node-bg)',
                color: 'var(--lsc-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
