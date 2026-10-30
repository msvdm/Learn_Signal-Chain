import type { PointerEvent as ReactPointerEvent } from 'react'
import { dialPoint } from './ampDial'

// What the two amps' faces share (GuitarAmpNode, AmpNode — D27): drawn 1:1 in an SVG of their own.

/**
 * A knob printed on an amp's panel: its cap, a pointer at `value` (0 … 1) and `ticks` marks around it.
 * Turned by a drag from `onPointerDown`; without it, part of the picture (Beginner).
 */
export function AmpKnob({ cx, cy, r, value, ticks, label, onPointerDown }: {
  cx: number
  cy: number
  r: number
  value: number
  ticks: number
  label: string
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void
}) {
  const tip  = dialPoint(cx, cy, r - 4, value)
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
        <circle cx={cx} cy={cy} r={r} strokeWidth="2.5" fill="var(--lsc-node-bg-2)" />
        <path d={`M${cx} ${cy}L${tip.x.toFixed(1)} ${tip.y.toFixed(1)}`} strokeWidth="3" />
      </g>
    </g>
  )
}
