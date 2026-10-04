import type { ReactNode } from 'react'
import { useReactFlow, useViewport } from '@xyflow/react'
import { useSignalStore } from '../store/signalStore'
import { useGraphSignal } from '../hooks/useGraphSignal'
import { useEdgeReshape } from '../hooks/useEdgeReshape'
import type { Reshaping } from '../hooks/useEdgeReshape'
import type { WireCursor } from '../hooks/useWireDrawing'
import type { Ghost } from '../hooks/useNodeDrag'
import { buildWirePath } from '../utils/wirePath'
import { SOUND_PORT } from '../data/nodeRegistry'

/**
 * What is drawn over the canvas, in flow coordinates: the drag handles on wires' corners, the
 * wire being drawn, and where dragged or dropped cards will land.
 */
export function CanvasOverlays({ cursor, ghosts }: { cursor: WireCursor | null; ghosts: Ghost[] }) {
  const complexityLevel = useSignalStore((s) => s.complexityLevel)
  return (
    <>
      {/* Reshaping wires: from Intermediate up */}
      {complexityLevel !== 'beginner' && <ReshapeHandles />}
      <WirePreview cursor={cursor} />
      {ghosts.length > 0 && <Ghosts ghosts={ghosts} />}
    </>
  )
}

/**
 * An SVG layer over the canvas that pans and zooms with it (a sibling of React Flow's own
 * viewport). It lets no pointer through by itself; `children` get the zoom, to keep strokes thin.
 */
function ViewportLayer({ zIndex, children }: { zIndex: number; children: (zoom: number) => ReactNode }) {
  const { x, y, zoom } = useViewport()
  return (
    <svg
      style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex,
        overflow: 'visible',
      }}
    >
      <g transform={`translate(${x}, ${y}) scale(${zoom})`}>{children(zoom)}</g>
    </svg>
  )
}

type ReshapeGrab = Pick<Reshaping, 'waypointIndex' | 'segmentIndex' | 'inserting'>

/**
 * Drag handles on wires with bends — in either mode: one on each corner (moves it) and one on
 * each segment's midpoint (adds a corner there).
 */
function ReshapeHandles() {
  const edges = useSignalStore((s) => s.edges)
  const { screenToFlowPosition } = useReactFlow()
  const { reshaping, setReshaping } = useEdgeReshape()

  /** Handlers of one handle: a left press starts the drag (and goes no further: not a wire corner, not a pan). */
  const grab = (edgeId: string, handle: ReshapeGrab) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      setReshaping({ edgeId, ...handle, livePos: screenToFlowPosition({ x: e.clientX, y: e.clientY }) })
    },
    // (No text selection while dragging, e.g. React Flow's attribution under the pointer)
    onMouseDown: (e: React.MouseEvent) => { if (e.button === 0) { e.stopPropagation(); e.preventDefault() } },
  })

  return (
    <ViewportLayer zIndex={95}>
      {(zoom) => edges.map((edge) => {
        const wps = edge.waypoints ?? []
        if (wps.length === 0) return null
        return (
          <g key={edge.id}>
            {/* Segment midpoint handles — for inserting new waypoints */}
            {wps.slice(0, -1).map((wp, i) => (
              <circle
                key={`mid-${i}`}
                className="lsc-reshape-handle lsc-overlay"
                {...grab(edge.id, { waypointIndex: -1, segmentIndex: i, inserting: true })}
                cx={(wp.x + wps[i + 1].x) / 2} cy={(wp.y + wps[i + 1].y) / 2}
                r={4 / zoom}
                fill="var(--lsc-accent)"
                opacity={0.35}
                style={{ pointerEvents: 'all', cursor: 'crosshair' }}
              />
            ))}
            {/* Waypoint handles — for moving existing waypoints */}
            {wps.map((wp, i) => {
              const isActive  = reshaping?.edgeId === edge.id && !reshaping.inserting && reshaping.waypointIndex === i
              const displayPt = isActive ? reshaping.livePos : wp
              return (
                <circle
                  key={`wp-${i}`}
                  className="lsc-reshape-handle lsc-overlay"
                  {...grab(edge.id, { waypointIndex: i, segmentIndex: -1, inserting: false })}
                  cx={displayPt.x} cy={displayPt.y}
                  r={5 / zoom}
                  fill="var(--lsc-accent)"
                  opacity={0.75}
                  style={{ pointerEvents: 'all', cursor: 'move' }}
                />
              )
            })}
          </g>
        )
      })}
    </ViewportLayer>
  )
}

/** The wire being drawn: dashed, to the cursor or the input it snaps to (orange when it would cross a card). */
function WirePreview({ cursor }: { cursor: WireCursor | null }) {
  const wire      = useSignalStore((s) => s.wire)
  const { wires } = useGraphSignal()
  if (!wire || !cursor) return null

  const path  = buildWirePath([wire.start, ...wire.waypoints, cursor.snap ?? cursor.pos])
  const color = cursor.warning ? 'var(--signal-hot)' : 'var(--lsc-accent)'
  // A wire drawn from a stereo output previews as a twin line, like the wire it will become;
  // a Guitar Amp's sound as dots
  const stereo = wires.get(`${wire.source.nodeId}:${wire.source.handleId}`)?.kind === 'stereo'
  const sound  = wire.source.handleId === SOUND_PORT

  return (
    <ViewportLayer zIndex={100}>
      {(zoom) => {
        const sw   = (sound ? 4 : 2.5) / zoom
        const dash = sound ? `0 ${8 / zoom}` : `${6 / zoom} ${4 / zoom}`
        return (
          <>
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={stereo ? sw * 2.2 : sw}
              strokeDasharray={dash}
              strokeLinecap="round"
            />
            {stereo && (
              <path
                d={path}
                fill="none"
                stroke="var(--lsc-canvas)"
                strokeWidth={sw * 0.8}
                strokeDasharray={dash}
                strokeLinecap="round"
              />
            )}
            {cursor.snap && (
              <circle
                cx={cursor.snap.x} cy={cursor.snap.y}
                r={11 / zoom}
                fill="none"
                stroke={color}
                strokeWidth={2 / zoom}
              />
            )}
            {wire.waypoints.map((wp, i) => (
              <circle key={i} cx={wp.x} cy={wp.y} r={4 / zoom} fill="var(--lsc-accent)" />
            ))}
          </>
        )
      }}
    </ViewportLayer>
  )
}

/** Where cards will land — a palette drop and a drag share the same look. */
function Ghosts({ ghosts }: { ghosts: Ghost[] }) {
  return (
    <ViewportLayer zIndex={99}>
      {(zoom) => ghosts.map((ghost, i) => (
        <rect
          key={i}
          x={ghost.pos.x}
          y={ghost.pos.y}
          width={ghost.w}
          height={ghost.h}
          rx={12}
          fill="var(--lsc-accent)"
          fillOpacity={0.12}
          stroke="var(--lsc-accent)"
          strokeWidth={1.5 / zoom}
          strokeDasharray={`${6 / zoom} ${3 / zoom}`}
        />
      ))}
    </ViewportLayer>
  )
}
