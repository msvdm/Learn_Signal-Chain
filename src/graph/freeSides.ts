import { FACINGS, FREE_SIDES, portFacing } from '../data/nodeRegistry'
import type { Facing, ParamTypes, SignalNode } from '../data/nodeRegistry'
import type { GraphView } from './graph'
import { graphOf } from './graph'

// An On Off Switch has no input or output side (FREE_SIDES, the user's call, 2026-11-05): a point on
// each of its four sides, each taking a wire in or sending one out. Inside it is still one input and
// one output (`in`, `out`: the number engine and the render are unchanged) — what moves is where
// they are drawn, `inSide` / `outSide`, set by the first wire into it and the first out of it.

/** The switch's input and output, as every card's */
export const IN = 'in'
export const OUT = 'out'

/**
 * A point drawn on a switch: its input or output where its wires are, or an open point — `any`
 * (nothing wired yet: a wire in or a wire out), `in` (its output is wired: a wire in), `out` (its
 * input is: a wire out). An open point's id is `open-<side>`: no wire is ever on it.
 */
export interface SidePoint {
  side: Facing
  id: string
  type: 'source' | 'target'
  open?: 'any' | 'in' | 'out'
}

const openId = (side: Facing) => `open-${side}`

/** The open point a handle id names (null: not an open point) */
export function openSideOf(handleId: string): Facing | null {
  const side = handleId.startsWith('open-') ? handleId.slice(5) : null
  return FACINGS.includes(side as Facing) ? (side as Facing) : null
}

/**
 * The points a switch shows: four open ones while nothing is wired; its input (or output) and three
 * open ones for the other end once one wire is on it; only its input and output once both are.
 */
export function sidePoints(node: Pick<SignalNode, 'id' | 'typeKey' | 'params'>, view: GraphView): SidePoint[] {
  const graph    = graphOf(view)
  const inWired  = graph.into(node.id).some((e) => e.targetHandle === IN)
  const outWired = graph.from(node.id).some((e) => e.sourceHandle === OUT)
  const inSide   = portFacing(node, 'target')
  const outSide  = portFacing(node, 'source')
  if (inWired && outWired) return [{ side: inSide, id: IN, type: 'target' }, { side: outSide, id: OUT, type: 'source' }]
  if (inWired) {
    return [{ side: inSide, id: IN, type: 'target' },
      ...FACINGS.filter((s) => s !== inSide).map((side): SidePoint => ({ side, id: openId(side), type: 'source', open: 'out' }))]
  }
  if (outWired) {
    return [{ side: outSide, id: OUT, type: 'source' },
      ...FACINGS.filter((s) => s !== outSide).map((side): SidePoint => ({ side, id: openId(side), type: 'target', open: 'in' }))]
  }
  return FACINGS.map((side) => ({ side, id: openId(side), type: 'target', open: 'any' }))
}

/** Does this card show its points this way (an On Off Switch)? */
export const hasFreeSides = (typeKey: SignalNode['typeKey']) => FREE_SIDES.has(typeKey)

/**
 * A switch's sides for a wire running `dir` (a unit step) where it is dropped: in from behind, out
 * ahead — on a run going down, in on top and out at the bottom.
 */
export function sidesAlong(dir: { x: number; y: number }): Pick<ParamTypes, 'inSide' | 'outSide'> {
  if (dir.x > 0) return { inSide: 'left', outSide: 'right' }
  if (dir.x < 0) return { inSide: 'right', outSide: 'left' }
  if (dir.y > 0) return { inSide: 'top', outSide: 'bottom' }
  return { inSide: 'bottom', outSide: 'top' }
}
