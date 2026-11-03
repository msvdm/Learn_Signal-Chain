import { describe, expect, it } from 'bun:test'
import type { SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { getPorts, isMatrixSource } from './queries'
import { planChain } from '../signal/chain'
import { stillPicture } from '../signal/engine'
import { settle } from './settle'
import { outputKey } from './graph'
import { withNodeOnWire, withStereo } from './edits'
import { nodeAcceptsWire } from './connectionRules'

// L and R only toward speakers (D43 — the user's call, 2026-11-03): one wire carries a whole stereo
// signal everywhere; a stereo output wired to a speaker turns into L and R, the first speaker on L
// (alone, it plays the left side), the next on R. Headphones take a stereo wire whole.

const node = (id: string, typeKey: TypeKey, params: SignalNode['params'] = {}): SignalNode =>
  ({ id, typeKey, position: { x: 0, y: 0 }, params, bypassed: false })
const wire = (source: string, target: string, sourceHandle = 'out'): SignalEdge =>
  ({ id: `${source}-${target}`, source, sourceHandle, target, targetHandle: 'in' })

/** The graph as the store settles it (commitGraph): `[source.handle → target]` per wire. */
function settled(nodes: SignalNode[], edges: SignalEdge[]) {
  const done    = settle({ nodes, edges })
  const outputs = (id: string) => getPorts(nodes.find((n) => n.id === id)!, { nodes, edges: done }).outputs.map((p) => p.id)
  const role    = (id: string) => planChain(nodes, done).find((p) => p.node.id === id)?.role
  const result  = stillPicture(nodes, done).result
  const stage   = (id: string) => result.stages[id]
  /** What the wire leaving `id` on `port` carries */
  const carries = (id: string, port: string) => result.wires.get(outputKey(id, port))?.kind
  return { edges: done, wires: done.map((e) => `${e.source}.${e.sourceHandle} → ${e.target}`), outputs, role, stage, carries }
}

describe('one stereo wire everywhere, L and R only into speakers (D43)', () => {
  const line = node('line', 'keyboard')
  const bus  = node('bus', 'master-bus')
  const eq   = node('eq', 'eq')

  it("an EQ wired to the Master Bus gets its whole mix, as one wired to a Keyboard", () => {
    const g = settled([line, bus, eq], [wire('line', 'bus'), wire('bus', 'eq')])
    expect(g.wires).toEqual(['line.out → bus', 'bus.out → eq'])
    expect(g.stage('eq').in?.kind).toBe('stereo')
    expect(g.outputs('bus')).toEqual(['out'])
  })

  it("wired from one side of an output, a wire into anything but a speaker takes the whole output", () => {
    const g = settled([line, bus, eq, node('air', 'broadcast')], [wire('line', 'bus'), wire('bus', 'eq', 'out-l'), wire('bus', 'air', 'out-r')])
    expect(g.wires).toEqual(['line.out → bus', 'bus.out → eq', 'bus.out → air'])
    expect(g.stage('air').in?.kind).toBe('stereo')
  })

  it('two speakers: the first on L, the next on R', () => {
    const g = settled([line, bus, node('a', 'active-speaker'), node('b', 'active-speaker')], [
      wire('line', 'bus'), wire('bus', 'a'), wire('bus', 'b'),
    ])
    expect(g.wires).toEqual(['line.out → bus', 'bus.out-l → a', 'bus.out-r → b'])
    expect(g.outputs('bus')).toEqual(['out-l', 'out-r'])
    expect([g.carries('bus', 'out-l'), g.carries('bus', 'out-r')]).toEqual(['left', 'right'])
  })

  it('one speaker alone plays the left side (the user\'s call)', () => {
    const g = settled([line, node('spk', 'studio-monitor')], [wire('line', 'spk')])
    expect(g.wires).toEqual(['line.out-l → spk'])
    expect(g.outputs('line')).toEqual(['out-l', 'out-r'])
    expect(g.carries('line', 'out-l')).toBe('left')
  })

  it('a speaker put on R stays there; a wire on to anything else leaves under L and R, its whole output', () => {
    const g = settled([line, bus, eq, node('b', 'active-speaker')], [wire('line', 'bus'), wire('bus', 'b', 'out-r'), wire('bus', 'eq')])
    expect(g.wires).toEqual(['line.out → bus', 'bus.out-r → b', 'bus.out → eq'])
    expect(g.outputs('bus')).toEqual(['out-l', 'out-r', 'out'])
  })

  it('a mono output stays one wire into its speakers; switched to stereo, they go on L and R', () => {
    const gen   = node('gen', 'generator')
    const nodes = [gen, node('a', 'active-speaker'), node('b', 'active-speaker')]
    const mono  = settled(nodes, [wire('gen', 'a'), wire('gen', 'b')])
    expect(mono.wires).toEqual(['gen.out → a', 'gen.out → b'])
    const on = withStereo({ nodes, edges: mono.edges }, 'gen', true)!
    const st = settled(on.nodes, on.edges)
    expect(st.wires).toEqual(['gen.out-l → a', 'gen.out-r → b'])
    const off = withStereo({ nodes: on.nodes, edges: st.edges }, 'gen', false)!
    expect(settled(off.nodes, off.edges).wires).toEqual(['gen.out → a', 'gen.out → b'])
  })

  it('headphones take a stereo wire whole: left ear L, right ear R', () => {
    const g = settled([line, bus, node('pre', 'gain'), node('hp', 'headphones')], [
      wire('line', 'bus'), wire('bus', 'pre'), wire('pre', 'hp', 'out-l'),
    ])
    expect(g.wires).toEqual(['line.out → bus', 'bus.out → pre', 'pre.out → hp'])
    expect(g.stage('hp').in?.kind).toBe('stereo')
    expect(g.stage('hp').out?.kind).toBe('stereo')
  })

  it("the first Fader after a stereo bus is its Main Fader, through effects; one after it is not", () => {
    const g = settled([line, bus, eq, node('main', 'fader'), node('f2', 'fader'), node('a', 'active-speaker'), node('b', 'active-speaker')], [
      wire('line', 'bus'), wire('bus', 'eq'), wire('eq', 'main'), wire('main', 'f2'), wire('f2', 'a'), wire('f2', 'b'),
    ])
    expect([g.role('main'), g.role('f2')]).toEqual(['main-fader', undefined])
    expect(g.wires.slice(-2)).toEqual(['f2.out-l → a', 'f2.out-r → b'])
  })

  it("an Amplifier takes the stereo wire into both its channels; its outputs are always L and R (an older file's one output its L)", () => {
    const g = settled([line, bus, node('amp', 'amp'), node('a', 'speaker'), node('b', 'speaker')], [
      wire('line', 'bus'), wire('bus', 'amp'), wire('amp', 'a'), wire('amp', 'b', 'out-r'),
    ])
    expect(g.wires).toEqual(['line.out → bus', 'bus.out → amp', 'amp.out-l → a', 'amp.out-r → b'])
    expect(g.outputs('amp')).toEqual(['out-l', 'out-r'])
    expect([g.carries('amp', 'out-l'), g.carries('amp', 'out-r')]).toEqual(['left', 'right'])
  })

  it("dropped onto a speaker's wire, a card takes the whole output and both speakers move after it", () => {
    const nodes = [line, bus, node('a', 'active-speaker'), node('b', 'active-speaker')]
    const before = settled(nodes, [wire('line', 'bus'), wire('bus', 'a'), wire('bus', 'b')])
    const onWire = withNodeOnWire({ nodes, edges: before.edges }, eq, 'bus-a')
    const g = settled(onWire.nodes, onWire.edges)
    expect(g.wires.sort()).toEqual(['bus.out → eq', 'eq.out-l → a', 'eq.out-r → b', 'line.out → bus'])
    expect(g.stage('eq').in?.kind).toBe('stereo')
  })
})

// An older file (1.0) held a stereo bus's mix on L and R outputs, taken over by its Main Fader (a
// Mix output into it, a Matrix send): opened, each wire takes what its card now sends
describe('an older file (1.0)', () => {
  it("its Mix outputs and Matrix sends are the whole output; one side into an effect is the whole mix", () => {
    const nodes = [
      node('line', 'keyboard'), node('bus', 'master-bus'), node('main', 'fader'), node('a', 'active-speaker'), node('b', 'active-speaker'),
      node('mtx', 'matrix-bus'), node('aux', 'aux-bus', { stereo: true }), node('eq', 'eq'),
    ]
    const g = settled(nodes, [
      wire('line', 'bus'), wire('bus', 'main', 'mix'), wire('main', 'a', 'out-l'), wire('main', 'b', 'out-r'),
      wire('main', 'mtx', 'send'), wire('line', 'aux'), wire('aux', 'eq', 'out-l'),
    ])
    expect(g.wires).toEqual([
      'line.out → bus', 'bus.out → main', 'main.out-l → a', 'main.out-r → b',
      'main.out → mtx', 'line.out → aux', 'aux.out → eq',
    ])
    expect(g.role('main')).toBe('main-fader')
    expect(g.stage('eq').in?.kind).toBe('stereo')
  })
})

// A Matrix Bus takes a bus's whole mix, after its fader or before it (D42 — the user's call,
// 2026-11-03): the Main Fader's output, or the bus's own and the effects between them. Each bus once.
describe('a Matrix Bus fed a bus before or after its Main Fader (D42)', () => {
  const line  = node('line', 'keyboard')
  const bus   = node('bus', 'master-bus')
  const eq    = node('eq', 'eq')
  const main  = node('main', 'fader', { faderDb: -20 })
  const amp   = node('amp', 'amp')
  const mtx   = node('mtx', 'matrix-bus')
  const nodes = [line, bus, eq, main, amp, mtx]
  // The bus → an EQ → its Main Fader (at −20 dB) → an Amplifier
  const chain = settled(nodes, [wire('line', 'bus'), wire('bus', 'eq'), wire('eq', 'main'), wire('main', 'amp')]).edges
  const into  = (from: string, handleId: string, edges = chain) =>
    nodeAcceptsWire(mtx, { nodeId: from, handleId }, edges, nodes, 'advanced')

  it('takes the whole mix anywhere along it: before the Main Fader and after it', () => {
    expect([into('bus', 'out'), into('eq', 'out'), into('main', 'out')]).toEqual([true, true, true])
    // Not the Amplifier's (speaker level), nor a single source
    expect([into('amp', 'out-l'), into('line', 'out')]).toEqual([false, false])
    expect(isMatrixSource('line', { nodes, edges: chain })).toBe(false)
  })

  it("from the Main Fader: after the fader", () => {
    const g = settled(nodes, [...chain, wire('main', 'mtx')])
    expect(g.stage('mtx').in?.kind).toBe('stereo')
    expect(Math.round(g.stage('mtx').in!.l.rms - g.stage('bus').out!.l.rms)).toBe(-20)
  })

  it("from the bus: before the fader, which does not change it", () => {
    const g = settled(nodes, [...chain, wire('bus', 'mtx')])
    expect(g.stage('mtx').in?.kind).toBe('stereo')
    expect(Math.round(g.stage('mtx').in!.l.rms - g.stage('bus').out!.l.rms)).toBe(0)
  })

  it('each bus once: before its fader or after it, not both', () => {
    const fed = [...chain, wire('bus', 'mtx')]
    expect([into('main', 'out', fed), into('eq', 'out', fed)]).toEqual([false, false])
  })

  it("its own mix leaves on one stereo wire, on L and R into speakers", () => {
    const g = settled([...nodes, node('a', 'active-speaker'), node('b', 'active-speaker')], [...chain, wire('main', 'mtx'), wire('mtx', 'a'), wire('mtx', 'b')])
    expect(g.outputs('mtx')).toEqual(['out-l', 'out-r'])
  })
})
