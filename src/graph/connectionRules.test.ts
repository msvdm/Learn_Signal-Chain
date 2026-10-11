import { describe, expect, it } from 'bun:test'
import type { SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { FROM_PC_PORT, PLAYBACK_PORT, TO_PC_PORT } from '../data/nodeRegistry'
import { nodeAcceptsWire, portAcceptsWire, wireTakesCard } from './connectionRules'

// Record and play back (D22): an Audio Interface and a DAW never sit inside a chain. The Interface's
// To computer goes only into a DAW, the DAW plays back only into the Interface's From computer, and
// the Interface records line-level signals only.

const node = (id: string, typeKey: TypeKey): SignalNode =>
  ({ id, typeKey, position: { x: 0, y: 0 }, params: {}, bypassed: false })
const wire = (source: string, target: string, sourceHandle = 'out', targetHandle = 'in'): SignalEdge =>
  ({ id: `${source}-${target}-${targetHandle}`, source, sourceHandle, target, targetHandle })

const nodes = [
  node('box', 'interface'), node('box2', 'interface'), node('daw', 'daw'), node('keys', 'keyboard'),
  node('mic', 'mic'), node('p48', 'phantom'), node('pre', 'gain'), node('gtr', 'instrument'),
  node('eq', 'eq'), node('bus', 'master-bus'), node('mon', 'studio-monitor'), node('rec', 'recorder'),
]
const byId = (id: string) => nodes.find((n) => n.id === id)!
/** Could a wire from `from` (card:port) be drawn into `to` (card:port), with `edges` already there? */
const takes = (from: string, to: string, edges: SignalEdge[] = []) => {
  const [nodeId, handleId = 'out'] = from.split(':')
  const [target, port = 'in'] = to.split(':')
  const source = { nodeId, handleId }
  return nodeAcceptsWire(byId(target), source, edges, nodes) && portAcceptsWire(byId(target), port, edges, source)
}

describe('the USB link between an Audio Interface and a DAW', () => {
  it('To computer goes only into a DAW, and a DAW takes nothing else', () => {
    expect(takes(`box:${TO_PC_PORT}`, 'daw')).toBe(true)
    for (const to of ['eq', 'bus', 'mon', 'rec', 'box2', `box2:${FROM_PC_PORT}`]) expect(takes(`box:${TO_PC_PORT}`, to)).toBe(false)
    for (const from of ['keys', 'pre', 'bus:out-l', 'box:out-l']) expect(takes(from, 'daw')).toBe(false)
  })

  it('the DAW plays back only into an Interface\'s From computer, which takes nothing else', () => {
    expect(takes(`daw:${PLAYBACK_PORT}`, `box:${FROM_PC_PORT}`)).toBe(true)
    for (const to of ['box', 'eq', 'bus', 'mon', 'rec']) expect(takes(`daw:${PLAYBACK_PORT}`, to)).toBe(false)
    for (const from of ['keys', 'pre', 'bus:out-l']) expect(takes(from, `box:${FROM_PC_PORT}`)).toBe(false)
  })
})

describe('what an Audio Interface records: line-level signals, as many as you like', () => {
  it('a line, a Preamp\'s output, a mix\'s Left and Right, the other Interface\'s playback', () => {
    expect(takes('keys', 'box')).toBe(true)
    expect(takes('pre', 'box', [wire('mic', 'p48'), wire('p48', 'pre')])).toBe(true)
    expect(takes('bus:out-r', 'box', [wire('bus', 'box', 'out-l')])).toBe(true)
    expect(takes('box2:out-l', 'box')).toBe(true)
  })

  it('not a microphone before its Preamp (through the 48V too), not a guitar', () => {
    expect(takes('mic', 'box')).toBe(false)
    expect(takes('p48', 'box', [wire('mic', 'p48')])).toBe(false)
    expect(takes('gtr', 'box')).toBe(false)
  })

  it('never dropped into the middle of a wire', () => {
    const view = { nodes, edges: [wire('keys', 'mon')] }
    expect(wireTakesCard('interface', view.edges[0], view)).toBe(false)
    expect(wireTakesCard('daw', view.edges[0], view)).toBe(false)
    expect(wireTakesCard('eq', view.edges[0], view)).toBe(true)
  })
})
