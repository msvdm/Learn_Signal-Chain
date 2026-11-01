import { describe, expect, it } from 'bun:test'
import { besideRoute, buildWirePath, orthogonalRoute, wireRuns } from './wirePath'
import { findEdgeAtPoint, PORT_TOP } from './layoutHelpers'
import type { SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { SOUND_PORT, portFacing } from '../data/nodeRegistry'
import type { Box } from './geometry'

// Wires are routed at right angles, out of the side of its card an output faces and into the side
// an input faces — right and left, unless a card is flipped (the user's call, 2026-10-11)

describe('a wire between two ordinary cards', () => {
  it('leaves right, turns half way, arrives from the left — as it always has', () => {
    expect(orthogonalRoute([{ x: 0, y: 0 }, { x: 200, y: 100 }])).toEqual([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 100 },
    ])
  })
})

// A stereo digital wire is two lines, one each side of its route (the user's call, 2026-10-31)
describe('a line beside a route', () => {
  const route = orthogonalRoute([{ x: 0, y: 0 }, { x: 200, y: 100 }])

  it('every run moved the same distance sideways, parallel to its own', () => {
    expect(besideRoute(route, 3)).toEqual([
      { x: 0, y: 3 }, { x: 97, y: 3 }, { x: 97, y: 103 }, { x: 200, y: 103 },
    ])
    expect(besideRoute(route, -3)).toEqual([
      { x: 0, y: -3 }, { x: 103, y: -3 }, { x: 103, y: 97 }, { x: 200, y: 97 },
    ])
  })

  it('a straight wire: two straight lines', () => {
    expect(buildWirePath([{ x: 0, y: 0 }, { x: 200, y: 0 }], {}, 0, 3)).toBe('M 0 3 L 100 3 L 200 3')
  })

  it('sharp corners (radius 0): right angles, no curves', () => {
    expect(buildWirePath([{ x: 0, y: 0 }, { x: 200, y: 100 }], {}, 0)).toBe('M 0 0 L 100 0 L 100 100 L 200 100')
  })

  it('rounded, both lines turn about the same point: the inside line tighter', () => {
    // Right then down: the side below (+) is the inside of the turn
    expect(buildWirePath([{ x: 0, y: 0 }, { x: 200, y: 100 }], {}, 8, 3).includes('L 92 3 Q 97 3 97 8')).toBe(true)
    expect(buildWirePath([{ x: 0, y: 0 }, { x: 200, y: 100 }], {}, 8, -3).includes('L 92 -3 Q 103 -3 103 8')).toBe(true)
  })
})

// An analog wire's shades travel along it as a gradient per straight run (the user's call, 2026-10-31)
describe('a wire as its straight runs', () => {
  const runs = wireRuns([{ x: 0, y: 0 }, { x: 200, y: 100 }])

  it('one per run, each starting where the last corner ended and rounding its own end corner', () => {
    expect(runs.map((r) => r.d)).toEqual([
      'M 0 0 L 92 0 Q 100 0 100 8',
      'M 100 8 L 100 92 Q 100 100 108 100',
      'M 108 100 L 200 100',
    ])
  })

  it('which way each goes, and how far along the route it starts — the shades carry on round a corner', () => {
    expect(runs.map((r) => [r.from, r.dir, r.at])).toEqual([
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, 0],
      [{ x: 100, y: 0 }, { x: 0, y: 1 }, 100],
      [{ x: 100, y: 100 }, { x: 1, y: 0 }, 200],
    ])
  })

  it('drawn beside the route as buildWirePath draws it', () => {
    const side = wireRuns([{ x: 0, y: 0 }, { x: 200, y: 100 }], {}, 8, 3)
    expect(side.map((r) => r.d).join(' ').replace(/ M \S+ \S+/g, '')).toBe(buildWirePath([{ x: 0, y: 0 }, { x: 200, y: 100 }], {}, 8, 3))
  })
})

describe('a wire to or from a flipped card', () => {
  it('into an input facing right, from the left: over its card', () => {
    const route = orthogonalRoute([{ x: 0, y: 200 }, { x: 600, y: 200 }], { to: 'right' })
    const over  = 200 - PORT_TOP - 40
    expect(route.some((p) => p.y === over)).toBe(true)
    expect(route[route.length - 2]).toEqual({ x: 640, y: 200 })
    expect(route[route.length - 1]).toEqual({ x: 600, y: 200 })
  })

  it('into an input on top: straight down into it', () => {
    const route = orthogonalRoute([{ x: 0, y: 0 }, { x: 300, y: 400 }], { to: 'top' })
    expect(route.slice(-2)).toEqual([{ x: 300, y: 360 }, { x: 300, y: 400 }])
  })

  it('out of an output at the bottom: straight down out of it', () => {
    const route = orthogonalRoute([{ x: 0, y: 0 }, { x: 300, y: 400 }], { from: 'bottom' })
    expect(route.slice(0, 2)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 40 }])
  })
})

describe('which way a port faces', () => {
  const node = (typeKey: TypeKey, params: SignalNode['params'] = {}) => ({ typeKey, params })
  it('flips move the ports of the cards that flip, and only those', () => {
    expect([portFacing(node('gain'), 'target'), portFacing(node('gain'), 'source')]).toEqual(['left', 'right'])
    expect([portFacing(node('gain', { flipH: true }), 'target'), portFacing(node('gain', { flipH: true }), 'source')]).toEqual(['right', 'left'])
    expect([portFacing(node('switch', { flipV: true }), 'target'), portFacing(node('switch', { flipV: true }), 'source')]).toEqual(['top', 'bottom'])
    expect([portFacing(node('switch', { flipV: true, flipH: true }), 'target'), portFacing(node('switch', { flipV: true, flipH: true }), 'source')]).toEqual(['bottom', 'top'])
    expect(portFacing(node('active-speaker', { flipH: true }), 'target')).toBe('right')
    expect(portFacing(node('fader', { flipH: true }), 'target')).toBe('left')
  })
})

// A card dropped onto a wire goes into it: the wire is found along its route as it is drawn — the
// first run on its source's port line, or a run turning down to a PFL Bus below
describe('the wire under a drop', () => {
  const card = (id: string, typeKey: TypeKey, x: number, y: number): SignalNode =>
    ({ id, typeKey, position: { x, y }, params: {}, bypassed: false })
  const nodes = [card('gain', 'gain', 0, 0), card('fader', 'fader', 600, 0), card('pfl', 'pfl-bus', 300, 500)]
  const box   = (n: SignalNode): Box => ({ id: n.id, position: n.position, size: { w: 200, h: 200 } })
  const edges: SignalEdge[] = [
    { id: 'main', source: 'gain', sourceHandle: 'out', target: 'fader', targetHandle: 'in' },
    { id: 'pfl', source: 'gain', sourceHandle: 'out', target: 'pfl', targetHandle: 'in' },
  ]
  const find = (x: number, y: number) =>
    findEdgeAtPoint({ x, y }, edges, nodes.map(box), { nodes, edges }, 'intermediate')

  it('on the run down to the PFL Bus: that wire, not on its first run', () => {
    // The PFL wire: right out of the Gain (200, 80), down at x = 250, into the bus at (300, 580)
    const hit = find(250, 400)
    expect(hit?.edge.id).toBe('pfl')
    expect(hit?.firstRun).toBe(false)
  })

  it('on the straight wire between Gain and Fader: that wire, its first run', () => {
    const hit = find(450, PORT_TOP)
    expect(hit?.edge.id).toBe('main')
    expect(hit?.firstRun).toBe(true)
  })

  it('far from every wire: none', () => {
    expect(find(450, 350)).toBeNull()
  })
})

// Sound in the air goes straight to the microphone (components/SoundWaves.tsx), from halfway down
// its source's card (the user's call, 2026-10-29): no corners
describe('sound in the air under a drop', () => {
  const card = (id: string, typeKey: TypeKey, x: number, y: number): SignalNode =>
    ({ id, typeKey, position: { x, y }, params: {}, bypassed: false })
  // The Vocal's Sound out halfway down its right side, at (200, 500); the microphone's input at (400, PORT_TOP)
  const nodes = [card('voice', 'vocal', 0, 400), card('mic', 'mic', 400, 0)]
  const edges: SignalEdge[] = [{
    id: 'air', source: 'voice', sourceHandle: SOUND_PORT, target: 'mic', targetHandle: 'in',
    waypoints: [{ x: 300, y: 900 }],   // a corner saved before 2026-10-29: not drawn
  }]
  const cards = nodes.map((n): Box => ({ id: n.id, position: n.position, size: { w: 200, h: 200 } }))
  const find  = (x: number, y: number) => findEdgeAtPoint({ x, y }, edges, cards, { nodes, edges }, 'intermediate')

  it('found along the straight line, not along a corner', () => {
    // A quarter of the way along the line, from (200, 500) to (400, 80)
    expect(find(250, 500 - (500 - PORT_TOP) / 4)?.edge.id).toBe('air')
    expect(find(300, 900)).toBeNull()
  })
})
