import { describe, expect, it } from 'bun:test'
import type { SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { getPorts, isMatrixSource } from './queries'
import { planChain } from '../signal/chain'
import { stillPicture } from '../signal/engine'
import { reconcileMainFaders } from './mainFader'
import { nodeAcceptsWire } from './connectionRules'

// A Limiter wired to a stereo bus's L or R takes the whole mix, as a Main Fader does: one stereo
// wire in, L and R out — and a Fader after it is the Main Fader. A stereo channel through a Limiter
// stays one wire: only a bus's mix is split.

const node = (id: string, typeKey: TypeKey, params: SignalNode['params'] = {}): SignalNode =>
  ({ id, typeKey, position: { x: 0, y: 0 }, params, bypassed: false })
const wire = (source: string, target: string, sourceHandle = 'out'): SignalEdge =>
  ({ id: `${source}-${target}`, source, sourceHandle, target, targetHandle: 'in' })

/** The graph as the store settles it (commitGraph): `[source.handle → target]` per wire. */
function settle(nodes: SignalNode[], edges: SignalEdge[]) {
  const settled = reconcileMainFaders({ nodes: [], edges: [] }, { nodes, edges })
  const outputs = (id: string) => getPorts(nodes.find((n) => n.id === id)!, { nodes, edges: settled }).outputs.map((p) => p.id)
  const role    = (id: string) => planChain(nodes, settled).find((p) => p.node.id === id)?.role
  return { wires: settled.map((e) => `${e.source}.${e.sourceHandle} → ${e.target}`), outputs, role }
}

describe('a Limiter after a stereo bus', () => {
  const line = node('line', 'keyboard')
  const bus  = node('bus', 'master-bus')
  const lim  = node('lim', 'limiter')

  it("wired to the bus's L: it takes the whole mix and sends L and R out", () => {
    const g = settle([line, bus, lim], [wire('line', 'bus'), wire('bus', 'lim', 'out-l')])
    expect(g.wires).toEqual(['line.out → bus', 'bus.mix → lim'])
    expect(g.outputs('lim')).toEqual(['out-l', 'out-r'])
  })

  it('a Fader on its L is the Main Fader', () => {
    const g = settle([line, bus, lim, node('main', 'fader')], [
      wire('line', 'bus'), wire('bus', 'lim', 'mix'), wire('lim', 'main', 'out-l'),
    ])
    expect(g.wires).toEqual(['line.out → bus', 'bus.mix → lim', 'lim.mix → main'])
    expect(g.outputs('main')).toEqual(['out-l', 'out-r'])
    expect(g.role('main')).toBe('main-fader')
  })

  it('dropped onto the wire to the left speaker: both speakers move onto it', () => {
    const g = settle([line, bus, lim, node('spkL', 'active-speaker'), node('spkR', 'active-speaker')], [
      wire('line', 'bus'), wire('bus', 'lim', 'out-l'), wire('lim', 'spkL'), wire('bus', 'spkR', 'out-r'),
    ])
    expect(g.wires).toEqual(['line.out → bus', 'bus.mix → lim', 'lim.out-l → spkL', 'lim.out-r → spkR'])
  })

  it("between the bus and its Main Fader, as an older save has it: settled the same way", () => {
    const g = settle([line, bus, lim, node('main', 'fader')], [
      wire('line', 'bus'), wire('bus', 'lim', 'mix'), wire('lim', 'main'),
    ])
    expect(g.wires).toEqual(['line.out → bus', 'bus.mix → lim', 'lim.mix → main'])
    expect(g.role('main')).toBe('main-fader')
  })

  it('on a stereo channel it stays one wire: only a mix is split', () => {
    const g = settle([node('keys', 'keyboard'), lim, bus], [wire('keys', 'lim'), wire('lim', 'bus')])
    expect(g.wires).toEqual(['keys.out → lim', 'lim.out → bus'])
    expect(g.outputs('lim')).toEqual(['out'])
  })
})

// An Amplifier (D27) on a bus's L takes the whole mix — one stereo wire, split into both its inputs —
// and both speakers move onto its L and R; its outputs are always L and R
describe('an Amplifier after a stereo bus', () => {
  const line = node('line', 'keyboard')
  const bus  = node('bus', 'master-bus')
  const amp  = node('amp', 'amp')

  it("wired to the bus's L: the whole mix in, both speakers on its L and R", () => {
    const g = settle([line, bus, amp, node('spkL', 'speaker'), node('spkR', 'speaker')], [
      wire('line', 'bus'), wire('bus', 'spkL', 'out-l'), wire('bus', 'spkR', 'out-r'), wire('bus', 'amp', 'out-l'),
    ])
    expect(g.wires).toEqual(['line.out → bus', 'amp.out-l → spkL', 'amp.out-r → spkR', 'bus.mix → amp'])
    expect(g.outputs('amp')).toEqual(['out-l', 'out-r'])
  })

  it('fed one channel, its outputs are still L and R; in an older file its one output is its L', () => {
    const g = settle([node('gen', 'generator'), amp, node('spk', 'speaker')], [wire('gen', 'amp'), wire('amp', 'spk')])
    expect(g.wires).toEqual(['gen.out → amp', 'amp.out-l → spk'])
    expect(g.outputs('amp')).toEqual(['out-l', 'out-r'])
  })
})

// What goes out to listeners is the whole mix: a bus's L or R into Stream / Broadcast or a Codec
// is its send — one stereo wire, after the fader — as into a Matrix Bus (the user's call, 2026-10-11)
describe('Stream / Broadcast and a Codec take the whole mix', () => {
  const line = node('line', 'keyboard')
  const bus  = node('bus', 'master-bus')

  it("wired to a bus's L or R: the send, with both sides, while its L / R stay on the speakers", () => {
    const g = settle([line, bus, node('air', 'broadcast'), node('spk', 'active-speaker'), node('cod', 'codec')], [
      wire('line', 'bus'), wire('bus', 'spk', 'out-l'), wire('bus', 'air', 'out-l'), wire('bus', 'cod', 'out-r'),
    ])
    expect(g.wires).toEqual(['line.out → bus', 'bus.out-l → spk', 'bus.send → air', 'bus.send → cod'])
    expect(g.outputs('bus')).toEqual(['out-l', 'out-r', 'send'])
  })

  it('Stream / Broadcast gets both sides of the mix', () => {
    const nodes = [line, bus, node('air', 'broadcast')]
    const edges = reconcileMainFaders({ nodes: [], edges: [] }, { nodes, edges: [wire('line', 'bus'), wire('bus', 'air', 'out-l')] })
    const air   = stillPicture(nodes, edges).result.stages.air
    expect(air.in?.kind).toBe('stereo')
    expect(air.in?.l.rms).toBe(air.in?.r.rms)
    expect(air.in?.r.rms).toBeGreaterThan(-20)
  })

  it('a Main Fader takes the send over: what goes out follows the fader', () => {
    const g = settle([line, bus, node('air', 'broadcast'), node('main', 'fader')], [
      wire('line', 'bus'), wire('bus', 'air', 'out-l'), wire('bus', 'main', 'out-r'),
    ])
    expect(g.wires).toEqual(['line.out → bus', 'main.send → air', 'bus.mix → main'])
  })
})

// A Matrix Bus takes a bus's whole mix, after its fader or before it (D42 — the user's call,
// 2026-11-03): the Main Fader's output, or the bus's own Mix output and the effects between them.
// A Main Fader whose L / R went on to an Amplifier has only its Mix output left: wired from it, the
// Matrix Bus gets its send (none could be wired before, 2026-11-03). Each bus feeds it once.
describe('a Matrix Bus fed a bus before or after its Main Fader (D42)', () => {
  const line  = node('line', 'keyboard')
  const bus   = node('bus', 'master-bus')
  const eq    = node('eq', 'eq')
  const main  = node('main', 'fader', { faderDb: -20 })
  const amp   = node('amp', 'amp')
  const mtx   = node('mtx', 'matrix-bus')
  const nodes = [line, bus, eq, main, amp, mtx]
  // The bus → an EQ → its Main Fader (at −20 dB) → an Amplifier, which took the L / R over
  const chain = [wire('line', 'bus'), wire('bus', 'eq', 'mix'), wire('eq', 'main'), wire('main', 'amp', 'out-l')]
  const view  = { nodes, edges: reconcileMainFaders({ nodes: [], edges: [] }, { nodes, edges: chain }) }
  const into  = (from: string, handleId: string, edges = view.edges) =>
    nodeAcceptsWire(mtx, { nodeId: from, handleId }, edges, nodes, 'advanced')

  it('takes the whole mix anywhere along it: before the Main Fader and after it', () => {
    expect(view.edges.map((e) => `${e.source}.${e.sourceHandle} → ${e.target}`))
      .toEqual(['line.out → bus', 'bus.mix → eq', 'eq.out → main', 'main.mix → amp'])
    expect([into('bus', 'mix'), into('eq', 'out'), into('main', 'mix')]).toEqual([true, true, true])
    // Not the Amplifier's (speaker level), nor a single source
    expect([into('amp', 'out-l'), into('line', 'out')]).toEqual([false, false])
  })

  it("the Main Fader's Mix output is its send: after the fader", () => {
    const g = settle(nodes, [...view.edges, wire('main', 'mtx', 'mix')])
    expect(g.wires).toEqual(['line.out → bus', 'bus.mix → eq', 'eq.out → main', 'main.mix → amp', 'main.send → mtx'])
    expect(g.outputs('main')).toEqual(['mix', 'send'])
    const edges = reconcileMainFaders({ nodes: [], edges: [] }, { nodes, edges: [...view.edges, wire('main', 'mtx', 'mix')] })
    const { stages } = stillPicture(nodes, edges).result
    expect(stages.mtx.in?.kind).toBe('stereo')
    expect(Math.round(stages.mtx.in!.l.rms - stages.bus.out!.l.rms)).toBe(-20)
  })

  it("the bus's Mix output is the bus's send: before the fader, which does not change it", () => {
    const g = settle(nodes, [...view.edges, wire('bus', 'mtx', 'mix')])
    expect(g.wires).toEqual(['line.out → bus', 'bus.mix → eq', 'eq.out → main', 'main.mix → amp', 'bus.send → mtx'])
    expect(g.outputs('bus')).toEqual(['mix', 'send'])
    const edges = reconcileMainFaders({ nodes: [], edges: [] }, { nodes, edges: [...view.edges, wire('bus', 'mtx', 'mix')] })
    const { stages } = stillPicture(nodes, edges).result
    expect(stages.mtx.in?.kind).toBe('stereo')
    expect(Math.round(stages.mtx.in!.l.rms - stages.bus.out!.l.rms)).toBe(0)
  })

  it('each bus once: before its fader or after it, not both', () => {
    const fed = [...view.edges, wire('bus', 'mtx', 'send')]
    expect([into('main', 'mix', fed), into('eq', 'out', fed)]).toEqual([false, false])
  })

  it('one side of the mix is not the mix', () => {
    const lone = [line, bus, main, eq, mtx]
    const edges = reconcileMainFaders({ nodes: [], edges: [] }, { nodes: lone, edges: [wire('line', 'bus'), wire('bus', 'main', 'out-l'), wire('main', 'eq', 'out-l')] })
    expect(isMatrixSource('main', 'out-l', { nodes: lone, edges })).toBe(true)
    expect(isMatrixSource('eq', 'out', { nodes: lone, edges })).toBe(false)
  })

  it("a bus with no Main Fader, its L / R on an Amplifier: the bus's Mix output, its send", () => {
    const nodes = [line, bus, amp, mtx]
    const edges = [wire('line', 'bus'), wire('bus', 'amp', 'out-l')]
    const view  = { nodes, edges: reconcileMainFaders({ nodes: [], edges: [] }, { nodes, edges }) }
    expect(isMatrixSource('bus', 'mix', view)).toBe(true)
    expect(settle(nodes, [...view.edges, wire('bus', 'mtx', 'mix')]).wires).toEqual(['line.out → bus', 'bus.mix → amp', 'bus.send → mtx'])
  })
})
