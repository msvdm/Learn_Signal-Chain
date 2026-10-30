import { describe, expect, it } from 'bun:test'
import type { SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { NODE_REGISTRY } from '../data/nodeRegistry'
import { portAcceptsWire } from './connectionRules'
import { drawnPorts } from './queries'
import { MAX_SLOTS, drawnTarget, settleSlots, shownSlots, slotFree, slotOfHandle, wireInto, wiresIntoSlot } from './slots'

// An input that takes several wires (a bus's …) is drawn as one port per wire and an empty one for
// the next, up to 8: each port holds one wire (no list to pick from when unplugging).

const node = (id: string, typeKey: TypeKey): SignalNode =>
  ({ id, typeKey, position: { x: 0, y: 0 }, params: {}, bypassed: false })
const into = (source: string, target: string, slot?: number): SignalEdge =>
  ({ id: `${source}-${target}`, source, sourceHandle: 'out', target, targetHandle: 'in', ...(slot !== undefined ? { slot } : {}) })

const keys = Array.from({ length: 10 }, (_, i) => node(`k${i}`, 'keyboard'))
const bus  = node('bus', 'master-bus')
const eq   = node('eq', 'eq')
const nodes = [...keys, bus, eq, node('box', 'interface')]

describe('the ports of an input that takes several wires', () => {
  it('every bus input, the Mixer, Stage Box, Interface and DAW take several; other inputs one', () => {
    for (const t of ['master-bus', 'aux-bus', 'matrix-bus', 'pfl-bus', 'mixer', 'stage-box', 'interface', 'daw'] as TypeKey[]) {
      expect(NODE_REGISTRY[t].inputs[0].many).toBe(true)
    }
    expect(NODE_REGISTRY.eq.inputs[0].many).toBeUndefined()
  })

  it('shows the ports in use and one empty one — a gap left by an unplugged wire is the empty one — up to 8', () => {
    expect(shownSlots([])).toBe(1)
    expect(shownSlots([0])).toBe(2)
    expect(shownSlots([0, 1, 2])).toBe(4)
    expect(shownSlots([0, 2])).toBe(3)          // slot 1 is free: no new one under them
    expect(shownSlots([1])).toBe(2)             // slot 0 is free
    expect(shownSlots([0, 1, 2, 3, 4, 5, 6])).toBe(8)
    expect(shownSlots([0, 1, 2, 3, 4, 5, 6, 7])).toBe(MAX_SLOTS)
  })

  it('slot 0 is the input’s own port; slot k is drawn as in.k', () => {
    expect(slotOfHandle('in')).toEqual({ port: 'in', slot: 0 })
    expect(slotOfHandle('in.3')).toEqual({ port: 'in', slot: 3 })
    expect(slotOfHandle('in-a')).toEqual({ port: 'in-a', slot: 0 })
    expect(drawnTarget(into('k0', 'bus', 0))).toBe('in')
    expect(drawnTarget(into('k0', 'bus', 2))).toBe('in.2')
    expect(drawnTarget(into('k0', 'eq'))).toBe('in')
    expect(wireInto(bus, 'in.2')).toEqual({ targetHandle: 'in', slot: 2 })
    expect(wireInto(eq, 'in')).toEqual({ targetHandle: 'in' })
  })

  it('a bus draws its ports on the lines under each other, one more than its wires', () => {
    const edges = settleSlots({ nodes, edges: [into('k0', 'bus'), into('k1', 'bus')] })
    const ins   = drawnPorts(bus, 'intermediate', { nodes, edges }).inputs
    expect(ins.map((p) => [p.id, p.row])).toEqual([['in', 0], ['in.1', 1], ['in.2', 2]])
    // The same layout is the same array (the cards compare it)
    expect(drawnPorts(bus, 'intermediate', { nodes, edges }).inputs).toBe(ins)
    expect(drawnPorts(bus, 'intermediate', { nodes, edges: [] }).inputs).toEqual([{ id: 'in', many: true }])
  })

  it('an Audio Interface’s extra input ports leave its playback line free', () => {
    const edges = settleSlots({ nodes, edges: [into('k0', 'box'), into('k1', 'box')] })
    expect(drawnPorts(nodes.at(-1)!, 'intermediate', { nodes, edges }).inputs.map((p) => p.row)).toEqual([0, 2, 3])
  })
})

describe('settling the slots', () => {
  it('a wire with no slot takes the first free one; one on a free slot keeps it', () => {
    const edges = settleSlots({ nodes, edges: [into('k0', 'bus', 2), into('k1', 'bus'), into('k2', 'bus')] })
    expect(edges.map((e) => e.slot)).toEqual([2, 0, 1])
  })

  it('two wires on one slot: the second moves to a free one', () => {
    expect(settleSlots({ nodes, edges: [into('k0', 'bus', 0), into('k1', 'bus', 0)] }).map((e) => e.slot)).toEqual([0, 1])
  })

  it('a wire into an input that takes one loses its slot; nothing to change, the same array', () => {
    expect(settleSlots({ nodes, edges: [into('k0', 'eq', 3)] })[0].slot).toBeUndefined()
    const settled = [into('k0', 'bus', 0), into('k1', 'eq')]
    expect(settleSlots({ nodes, edges: settled })).toBe(settled)
  })

  it('each port holds one wire: a full one takes no other, unplugging finds only its own', () => {
    const edges = settleSlots({ nodes, edges: [into('k0', 'bus'), into('k1', 'bus')] })
    expect(slotFree({ nodes, edges }, bus, 'in')).toBe(false)
    expect(slotFree({ nodes, edges }, bus, 'in.2')).toBe(true)
    expect(wiresIntoSlot({ nodes, edges }, 'bus', 'in.1').map((e) => e.source)).toEqual(['k1'])
  })

  it('an input takes 8 wires at most', () => {
    const eight = settleSlots({ nodes, edges: keys.slice(0, 8).map((k) => into(k.id, 'bus')) })
    const source = { nodeId: 'k8', handleId: 'out' }
    expect(portAcceptsWire(bus, 'in', eight.slice(0, 7), source, nodes)).toBe(true)
    expect(portAcceptsWire(bus, 'in', eight, source, nodes)).toBe(false)
  })
})
