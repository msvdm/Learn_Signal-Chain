import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { KnobFace } from '../../components/controls/KnobFace'
import { takePress, usePointerDrag } from '../../hooks/usePointerDrag'

// A knob on a Deep dive picture (D46): dragged up and down (`drag` px for its whole range), or
// ↑ ↓ a step; its cap the canvas's knobs' (KnobFace).

/** A knob turned by dragging it up or down (`drag` px for its whole range) or with ↑ ↓ (← → are the steps') */
export function SceneKnob({ cx, cy, r, color, value, min, max, round, onChange, label, valueText, drag = 150 }: {
  cx: number; cy: number; r: number; color: string
  value: number; min: number; max: number; round: (v: number) => number; onChange: (v: number) => void
  label: string; valueText: string; drag?: number
}) {
  const dragging = usePointerDrag<{ y: number; value: number }>((e, from) => {
    onChange(round(from.value + ((from.y - e.clientY) / drag) * (max - min)))
  })
  const onDown = (e: ReactPointerEvent) => {
    if (takePress(e)) dragging.start({ y: e.clientY, value })
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    onChange(round(value + (e.key === 'ArrowUp' ? 1 : -1)))
  }
  return (
    <g
      role="slider" tabIndex={0} aria-label={label}
      aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText}
      onPointerDown={onDown} onKeyDown={onKey}
      style={{ cursor: 'ns-resize', touchAction: 'none', outline: 'none' }}
    >
      <KnobFace cx={cx} cy={cy} r={r} value={(value - min) / (max - min)} color={color} />
    </g>
  )
}
