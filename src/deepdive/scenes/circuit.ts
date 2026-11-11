import type { SignalHealth } from '../../signal/levels'
import { getHealth } from '../../signal/levels'

// The amplification subjects' circuit geometry (Deep dive, D46): wires the charges move along, a
// transistor's leads, a resistor's zigzag, a level's health as the canvas judges it. Drawn by
// circuitParts.tsx and the scenes.

export type Pt = readonly [number, number]

/** A wire's length, along its corners */
export const lengthOf = (wire: readonly Pt[]) =>
  wire.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - wire[i][0], p[1] - wire[i][1]), 0)

/** The point `s` along a wire */
export function pointAlong(wire: readonly Pt[], s: number): Pt {
  for (let i = 1; i < wire.length; i++) {
    const [x0, y0] = wire[i - 1], [x1, y1] = wire[i], seg = Math.hypot(x1 - x0, y1 - y0)
    if (s <= seg) return [x0 + ((x1 - x0) * s) / seg, y0 + ((y1 - y0) * s) / seg]
    s -= seg
  }
  return wire[wire.length - 1]
}

/** How far left of its column a transistor's base bar stands */
export const BASE_GAP = 26

/** The path of a transistor's two leads from the column above it (`from`) to the column below it (`to`), through its bar */
export function transistorLeads(x: number, y: number, from: number, to: number): string {
  const bar = x - BASE_GAP
  return `M${x} ${from} V${y - 28} L${bar} ${y - 8} M${bar} ${y + 8} L${x} ${y + 28} V${to}`
}

/** A resistor on a wire running down at `x`, from `y0` to `y1`: the wire's zigzag between them */
export function resistorPath(x: number, y0: number, y1: number, half = 10): string {
  const teeth = 6, pitch = (y1 - y0) / (teeth * 2)
  let d = `M${x} ${y0}`
  for (let i = 0; i < teeth * 2; i++) d += ` L${x + (i % 2 ? -half : half)} ${(y0 + pitch * (i + 0.5)).toFixed(1)}`
  return `${d} L${x} ${y1}`
}

/** A level's health as the canvas judges it, and the colour its word is written in */
export function healthOfLevels(rms: number, peak: number): { health: SignalHealth; colour: string } {
  const health = getHealth(rms, 'analog', peak)
  return { health, colour: `var(--signal-${health}-text)` }
}
