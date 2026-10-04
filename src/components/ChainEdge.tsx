import type { EdgeProps } from '@xyflow/react'
import { BaseEdge } from '@xyflow/react'
import { buildWirePath } from '../utils/wirePath'

type Pt = { x: number; y: number }

export interface ChainEdgeData extends Record<string, unknown> {
  waypoints?: Pt[]
  routingWarning?: boolean
  /** Carries Left and Right together — drawn as a twin line. */
  stereo?: boolean
  /** Zoomed out: drawn thicker, with longer dashes */
  overview?: boolean
}

export function ChainEdge({
  id, sourceX, sourceY, targetX, targetY,
  style, markerEnd,
  data,
}: EdgeProps) {
  const d           = (data ?? {}) as ChainEdgeData
  const waypoints   = d.waypoints ?? []
  const routingWarn = d.routingWarning ?? false
  const twin        = (d.stereo ?? false) && !routingWarn

  // Build the path using the same algorithm as the live wire preview.
  const points: Pt[] = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }]
  const edgePath = buildWirePath(points)

  // Thicker in overview (zoomed out): the twin line and the dashes grow with it.
  // The dash period stays a divisor of the 24px flow animation, so it loops smoothly.
  const width = Number(style?.strokeWidth ?? 3)
  const thick = d.overview ?? false
  const dash  = thick ? { strokeDasharray: '16 8' } : {}

  const edgeStyle = routingWarn
    ? { ...style, stroke: 'var(--signal-hot)', strokeDasharray: thick ? '16 8' : '6 4' }
    : twin ? { ...style, ...dash, strokeWidth: width * 2 } : { ...style, ...dash }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        markerEnd={markerEnd}
        className={routingWarn ? undefined : 'signal-line-animated'}
      />
      {/* Stereo: a canvas-coloured line down the middle splits the wire into two.
          Same dash animation, so both move together. */}
      {twin && (
        <path
          d={edgePath}
          fill="none"
          className="signal-line-animated"
          style={{ stroke: 'var(--lsc-canvas)', strokeWidth: (width * 2) / 3, ...dash, opacity: style?.opacity, transition: style?.transition, pointerEvents: 'none' }}
        />
      )}
    </>
  )
}
