import type { EdgeProps } from '@xyflow/react'
import { BaseEdge, EdgeLabelRenderer } from '@xyflow/react'
import { buildWirePath, wireBadgeAnchor } from '../utils/wirePath'

type Pt = { x: number; y: number }

export interface ChainEdgeData extends Record<string, unknown> {
  waypoints?: Pt[]
  routingWarning?: boolean
  /** Signal level carried by this wire, e.g. "−18". Omitted → no badge. */
  dbLabel?: string
  /** Border colour of the badge (health of the signal). */
  badgeBorder?: string
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
  const mid      = wireBadgeAnchor(points)

  const edgeStyle = routingWarn
    ? { ...style, stroke: 'var(--signal-hot)', strokeDasharray: '6 4' }
    : style

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        markerEnd={markerEnd}
        className={routingWarn ? undefined : 'signal-line-animated'}
      />
      {d.dbLabel && (
        <EdgeLabelRenderer>
          <span
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, 0) translate(${mid.x}px, ${mid.y - 28}px)`,
              padding: '2px 6px', borderRadius: 9999,
              background: 'var(--lsc-header)',
              border: `1px solid ${d.badgeBorder ?? 'var(--lsc-border)'}`,
              color: 'var(--lsc-fg)',
              fontFamily: 'var(--lsc-font-mono)', fontSize: 11, fontWeight: 600, lineHeight: 1.3,
              whiteSpace: 'nowrap', pointerEvents: 'none',
            }}
          >
            {d.dbLabel}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
