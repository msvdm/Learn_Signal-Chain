import { describe, expect, it } from 'bun:test'
import type { SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { getPorts } from './queries'
import { planChain } from '../signal/chain'
import { reconcileMainFaders } from './mainFader'

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
  const line = node('line', 'line-in')
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
    const g = settle([node('keys', 'line-in', { stereo: true }), lim, bus], [wire('keys', 'lim'), wire('lim', 'bus')])
    expect(g.wires).toEqual(['keys.out → lim', 'lim.out → bus'])
    expect(g.outputs('lim')).toEqual(['out'])
  })
})
