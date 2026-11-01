// A knob's cap, drawn as the logo's knob (docs/brand, D32 — the user's call, 2026-10-31: "full with a
// notch that shows the position instead of an outer line"): a disc in the knob's colour, a thin dark
// outline round it, and a white notch from its centre toward the edge pointing at the value — white
// on every knob, bright ones too (the user's call, 2026-10-31).

import { knobOutline } from './knobShape'

/** A knob's sweep: from 7:30 (0) to 4:30 (1), 270° */
const SWEEP_FROM = -135
const SWEEP = 270

/** The logo's proportions, as shares of the cap's radius (the outline's: knobShape.ts) */
const NOTCH_LEN = 0.69
const NOTCH_W = 0.28

/** The point `r` from the centre at `value` (0 … 1) of the sweep */
function sweepPoint(cx: number, cy: number, r: number, value: number) {
  const a = ((SWEEP_FROM + SWEEP * Math.max(0, Math.min(1, value))) * Math.PI) / 180
  return { x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r }
}

/**
 * A knob's cap at `cx`, `cy`: `r` its radius without the outline, `value` (0 … 1) where its notch
 * points, `color` its fill (any CSS colour or variable).
 */
export function KnobFace({ cx, cy, r, value, color }: { cx: number; cy: number; r: number; value: number; color: string }) {
  const tip = sweepPoint(cx, cy, r * NOTCH_LEN, value)
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} stroke="var(--lsc-knob-outline)" strokeWidth={knobOutline(r) * 2} paintOrder="stroke" />
      <path
        d={`M${cx} ${cy}L${tip.x.toFixed(2)} ${tip.y.toFixed(2)}`}
        stroke="var(--lsc-knob-notch)"
        strokeWidth={Math.max(2.5, r * NOTCH_W)} strokeLinecap="round"
      />
    </g>
  )
}
