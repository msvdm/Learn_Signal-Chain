// The two amps' panels (GuitarAmpNode, AmpNode — D27): what their drawings share, beside AmpKnob.

/** The words printed on an amp's panel (px) */
export const PANEL_TEXT = 11

/** A knob's sweep: from 7:30 (0) to 4:30 (1), 270° */
const SWEEP_FROM = -135
const SWEEP = 270

/** The point `r` from a knob's centre at `value` (0 … 1) of its sweep: a tick's end, a number's place. */
export function dialPoint(cx: number, cy: number, r: number, value: number): { x: number; y: number } {
  const a = ((SWEEP_FROM + SWEEP * Math.max(0, Math.min(1, value))) * Math.PI) / 180
  return { x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r }
}
