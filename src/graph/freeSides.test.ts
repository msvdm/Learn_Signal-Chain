import { describe, expect, it } from 'bun:test'
import type { SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { openSideOf, sidePoints, sidesAlong } from './freeSides'
import { withNodeOnWire } from './edits'
import { findEdgeAtPoint } from '../utils/layoutHelpers'
import type { Box } from '../utils/geometry'

// An On Off Switch has no input or output side (the user's call, 2026-11-05): a point on each of
// its four sides while nothing is wired, each taking a wire in or sending one out; once a wire is in
// and a wire is out, only those two points are left. Dropped on a wire, the wire's way says where.

const node = (id: string, typeKey: TypeKey, params: SignalNode['params'] = {}): SignalNode =>
  ({ id, typeKey, position: { x: 0, y: 0 }, params, bypassed: false })
const wire = (source: string, target: string, extra: Partial<SignalEdge> = {}): SignalEdge =>
  ({ id: `${source}-${target}`, source, sourceHandle: 'out', target, targetHandle: 'in', ...extra })
/** Its points as side → what they are: `in` / `out`, or open `any` / `open-in` / `open-out` */
const shown = (sw: SignalNode, edges: SignalEdge[]) => Object.fromEntries(
  sidePoints(sw, { nodes: [sw, node('a', 'gain'), node('b', 'gain')], edges })
    .map((p) => [p.side, p.open ? (p.open === 'any' ? 'any' : `open-${p.open}`) : p.id]),
)

describe('an On Off Switch’s points', () => {
  it('nothing wired: one on each side, each taking a wire either way', () => {
    expect(shown(node('sw', 'switch'), [])).toEqual({ left: 'any', top: 'any', right: 'any', bottom: 'any' })
  })

  it('a wire in by its bottom: its input there, the three other sides open for the wire out', () => {
    const sw = node('sw', 'switch', { inSide: 'bottom' })
    expect(shown(sw, [wire('a', 'sw')])).toEqual({ bottom: 'in', left: 'open-out', top: 'open-out', right: 'open-out' })
  })

  it('a wire out by its left: its output there, the three other sides open for the wire in', () => {
    const sw = node('sw', 'switch', { outSide: 'left' })
    expect(shown(sw, [wire('sw', 'b')])).toEqual({ left: 'out', top: 'open-in', right: 'open-in', bottom: 'open-in' })
  })

  it('a wire in and a wire out: only those two points — at a right angle too', () => {
    const sw = node('sw', 'switch', { inSide: 'top', outSide: 'right' })
    expect(shown(sw, [wire('a', 'sw'), wire('sw', 'b')])).toEqual({ top: 'in', right: 'out' })
  })

  it('a switch from a file saved before: its wires where its flips put them', () => {
    expect(shown(node('sw', 'switch', { flipV: true }), [wire('a', 'sw'), wire('sw', 'b')])).toEqual({ top: 'in', bottom: 'out' })
    expect(shown(node('sw', 'switch'), [wire('a', 'sw'), wire('sw', 'b')])).toEqual({ left: 'in', right: 'out' })
  })

  it('an open point names its side', () => {
    expect([openSideOf('open-top'), openSideOf('in'), openSideOf('open-up')]).toEqual(['top', null, null])
  })
})

describe('an On Off Switch dropped on a wire', () => {
  it('in from behind, out ahead, whichever way the wire runs there', () => {
    expect(sidesAlong({ x: 1, y: 0 })).toEqual({ inSide: 'left', outSide: 'right' })
    expect(sidesAlong({ x: -1, y: 0 })).toEqual({ inSide: 'right', outSide: 'left' })
    expect(sidesAlong({ x: 0, y: 1 })).toEqual({ inSide: 'top', outSide: 'bottom' })
    expect(sidesAlong({ x: 0, y: -1 })).toEqual({ inSide: 'bottom', outSide: 'top' })
  })

  // A Gain at (0, 0) to a Gain far below and left, by two bends: out right, down, left, down
  const a = node('a', 'gain'), b = { ...node('b', 'gain'), position: { x: -400, y: 900 } }
  const cards: Box[] = [
    { id: 'a', position: a.position, size: { w: 300, h: 360 } },
    { id: 'b', position: b.position, size: { w: 300, h: 360 } },
  ]
  const bends = [{ x: 600, y: 400 }, { x: 100, y: 700 }]
  const long  = wire('a', 'b', { waypoints: bends })
  const view  = { nodes: [a, b], edges: [long] }

  it('the run it lands on, which way it goes, and how many bends come before it', () => {
    // The run down from the first bend (it turns there: the second bend is back to the left)
    const hit = findEdgeAtPoint({ x: 600, y: 550 }, [long], cards, view, 'intermediate')
    expect(hit?.edge.id).toBe(long.id)
    expect(Math.sign(hit!.run.to.y - hit!.run.from.y)).toBe(1)
    expect(hit?.bendsBefore).toBe(1)
  })

  it('the wire’s bends stay where they were, before it on the way in, after it on the way out', () => {
    const sw = node('sw', 'switch', { inSide: 'top', outSide: 'bottom' })
    const after = withNodeOnWire(view, sw, long.id, 1)
    expect(after.edges.find((e) => e.target === 'sw')?.waypoints).toEqual([bends[0]])
    expect(after.edges.find((e) => e.source === 'sw')?.waypoints).toEqual([bends[1]])
  })

  it('any other card dropped on a wire: neither wire keeps a bend, as before', () => {
    const after = withNodeOnWire(view, node('eq', 'eq'), long.id)
    expect(after.edges.filter((e) => e.waypoints !== undefined)).toEqual([])
  })
})
