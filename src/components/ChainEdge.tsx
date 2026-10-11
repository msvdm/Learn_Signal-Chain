import type { EdgeProps } from '@xyflow/react'
import { BaseEdge } from '@xyflow/react'
import { buildWirePath, orthogonalRoute } from '../utils/wirePath'
import type { RouteEnds } from '../utils/wirePath'
import type { Facing } from '../data/nodeRegistry'
import type { Pt } from '../utils/geometry'

export interface ChainEdgeData extends Record<string, unknown> {
  waypoints?: Pt[]
  routingWarning?: boolean
  /** Carries Left and Right together — drawn as a twin line. */
  stereo?: boolean
  /** Zoomed out: drawn thicker, with longer dashes */
  overview?: boolean
  /** A Guitar Amp's sound into a microphone (through the air, not a cable): drawn as dots */
  sound?: boolean
  /** Carries a DI Box ground-loop hum, this strong (0 … 1, humStrength): a red glow under it, wider as it grows */
  hum?: number
  /** The USB wire between an Audio Interface and a DAW: the sound goes both ways — no flow, a ⇄ halfway */
  twoWay?: boolean
  /** No flow: at Beginner its sound reaches no end point that plays it (D20) — a plain line */
  still?: boolean
}

/** The point halfway along a route of straight runs. */
function halfway(route: Pt[]): Pt {
  const runs = route.slice(1).map((p, i) => Math.hypot(p.x - route[i].x, p.y - route[i].y))
  let left = runs.reduce((a, b) => a + b, 0) / 2
  for (let i = 0; i < runs.length; i++) {
    if (left <= runs[i]) {
      const t = runs[i] > 0 ? left / runs[i] : 0
      return { x: route[i].x + (route[i + 1].x - route[i].x) * t, y: route[i].y + (route[i + 1].y - route[i].y) * t }
    }
    left -= runs[i]
  }
  return route[route.length - 1]
}

export function ChainEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  style, markerEnd,
  data,
}: EdgeProps) {
  const d           = (data ?? {}) as ChainEdgeData
  const waypoints   = d.waypoints ?? []
  const routingWarn = d.routingWarning ?? false
  const twin        = (d.stereo ?? false) && !routingWarn

  // Build the path using the same algorithm as the live wire preview: out of its output's side and
  // into its input's (a flipped card's ports face another way — portFacing)
  const points: Pt[] = [{ x: sourceX, y: sourceY }, ...waypoints, { x: targetX, y: targetY }]
  const ends: RouteEnds = { from: sourcePosition as Facing, to: targetPosition as Facing }
  const edgePath = buildWirePath(points, ends)

  // Thicker in overview (zoomed out): the twin line and the dashes grow with it.
  // The dash period stays a divisor of the 24px flow animation, so it loops smoothly.
  const width = Number(style?.strokeWidth ?? 3)
  const thick = d.overview ?? false
  // The flow shows which way the sound goes: none on a two-way wire, nor on a still one (solid)
  const flow  = routingWarn || d.twoWay || d.still ? undefined : 'signal-line-animated'
  const dash  = thick && !d.still ? { strokeDasharray: '16 8' } : {}
  // Round dots, 8px apart (12px zoomed out): periods that divide the 24px flow animation
  const dots  = { strokeDasharray: thick ? '0 12' : '0 8', strokeLinecap: 'round' as const, strokeWidth: width * 1.6 }
  const mid  = d.twoWay ? halfway(orthogonalRoute(points, ends)) : null

  const edgeStyle = routingWarn
    ? { ...style, stroke: 'var(--signal-clipping)', strokeDasharray: thick ? '16 8' : '6 4' }
    : d.sound ? { ...style, ...dots }
    : twin ? { ...style, ...dash, strokeWidth: width * 2 } : { ...style, ...dash }

  return (
    <>
      {d.hum !== undefined && (
        <path
          d={edgePath}
          fill="none"
          style={{
            stroke: 'var(--signal-clipping)', strokeWidth: width * (2.5 + 4 * d.hum), strokeLinecap: 'round',
            opacity: 0.35 * Number(style?.opacity ?? 1), transition: style?.transition, pointerEvents: 'none',
          }}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        markerEnd={markerEnd}
        className={flow}
      />
      {/* Stereo: a canvas-coloured line down the middle splits the wire into two.
          Same dash animation, so both move together. */}
      {twin && (
        <path
          d={edgePath}
          fill="none"
          className={flow}
          style={{ stroke: 'var(--lsc-canvas)', strokeWidth: (width * 2) / 3, ...dash, opacity: style?.opacity, transition: style?.transition, pointerEvents: 'none' }}
        />
      )}
      {/* Both ways: two arrows in a ring halfway along */}
      {mid && (
        <g transform={`translate(${mid.x} ${mid.y}) scale(${thick ? 2 : 1})`} style={{ opacity: style?.opacity, pointerEvents: 'none' }}>
          <circle r="11" fill="var(--lsc-canvas)" stroke={style?.stroke} strokeWidth="2" />
          <path d="M-5.5 -2.5H5.5M3 -5L5.5 -2.5L3 0M5.5 2.5H-5.5M-3 0L-5.5 2.5L-3 5" fill="none" stroke={style?.stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </>
  )
}
