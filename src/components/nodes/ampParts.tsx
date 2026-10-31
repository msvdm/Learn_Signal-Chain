import type { PointerEvent as ReactPointerEvent } from 'react'
import { useSignalStore } from '../../store/signalStore'
import { dialPoint } from './ampDial'
import { KnobFace } from '../controls/KnobFace'

// What the two amps' faces share (GuitarAmpNode, AmpNode — D27): drawn 1:1 in an SVG of their own.

/**
 * A knob printed on an amp's panel: its cap, a pointer at `value` (0 … 1) and `ticks` marks around it.
 * Turned by a drag from `onPointerDown`; without it, part of the picture (Beginner).
 */
/**
 * Selected, an amp shows it on its own outline, not in a box around it (D27): its edge (a rounded
 * rect `w` × `h` from 0, 0 with `rx` corners, `edge` thick) drawn in the accent colour, the soft glow
 * outside it — as thick as a free control's selection ring and glow, and thicker zoomed out, the same
 * on screen however many times its drawing is scaled up (`scale`). Draw it last in the amp's SVG
 * (`overflow: visible`, for the glow); it redraws on its own when the selection changes.
 */
export function SelectedEdge({ nodeId, w, h, rx, edge, scale = 1 }: {
  nodeId: string
  w: number
  h: number
  rx: number
  edge: number
  scale?: number
}) {
  const selected = useSignalStore((s) => s.selectedNodeIds.includes(nodeId))
  const overview = useSignalStore((s) => s.overview)
  if (!selected) return null
  // FreeControl's ring and glow (px on the canvas), in the drawing's units
  const ring = Math.max(edge, (overview ? 12 : 4) / scale)
  const glow = (overview ? 36 : 12) / scale
  return (
    <g aria-hidden pointerEvents="none">
      <rect
        x={-glow / 2} y={-glow / 2} width={w + glow} height={h + glow} rx={rx + glow / 2}
        stroke="var(--lsc-select-halo)" strokeWidth={glow} fill="none"
      />
      <rect
        x={ring / 2} y={ring / 2} width={w - ring} height={h - ring} rx={Math.max(0, rx - ring / 2)}
        stroke="var(--lsc-accent)" strokeWidth={ring} fill="none"
      />
    </g>
  )
}

export function AmpKnob({ cx, cy, r, value, ticks, label, onPointerDown }: {
  cx: number
  cy: number
  r: number
  value: number
  ticks: number
  label: string
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
}) {
  const live = onPointerDown !== undefined
  return (
    <g stroke="var(--lsc-fg)">
      {Array.from({ length: ticks }, (_, i) => {
        const a = dialPoint(cx, cy, r + 4, i / (ticks - 1))
        const b = dialPoint(cx, cy, r + 8, i / (ticks - 1))
        return <path key={i} d={`M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`} strokeWidth="1.6" />
      })}
      <g
        className={live ? 'nodrag nopan' : undefined}
        role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={1} aria-valuenow={value}
        onPointerDown={onPointerDown}
        style={{ cursor: live ? 'ns-resize' : undefined, touchAction: 'none' }}
      >
        <circle cx={cx} cy={cy} r={r + 8} fill="transparent" stroke="none" />
        <KnobFace cx={cx} cy={cy} r={r} value={value} color="var(--lsc-knob-gray)" />
      </g>
    </g>
  )
}
