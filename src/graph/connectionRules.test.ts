import { describe, expect, it } from 'bun:test'
import type { SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { FROM_PC_PORT, PLAYBACK_PORT, TO_PC_PORT } from '../data/nodeRegistry'
import type { ComplexityLevel } from '../data/levels'
import { nodeAcceptsWire, portAcceptsWire, wireTakesCard } from './connectionRules'

// Record and play back (D22): an Audio Interface and a DAW never sit inside a chain. The Interface's
// To computer goes only into a DAW — one USB wire, carrying both ways (its way back is the store's:
// usbLink.ts) —, the computer's sound comes out of the Interface's line output, and the Interface
// records line-level signals only.

const node = (id: string, typeKey: TypeKey): SignalNode =>
  ({ id, typeKey, position: { x: 0, y: 0 }, params: {}, bypassed: false })
const wire = (source: string, target: string, sourceHandle = 'out', targetHandle = 'in'): SignalEdge =>
  ({ id: `${source}-${target}-${targetHandle}`, source, sourceHandle, target, targetHandle })

const nodes = [
  node('box', 'interface'), node('box2', 'interface'), node('daw', 'daw'), node('daw2', 'daw'), node('keys', 'keyboard'),
  node('fad', 'fader'), node('pfl', 'pfl-bus'), node('mtx', 'matrix-bus'),
  node('mic', 'mic'), node('p48', 'phantom'), node('pre', 'gain'), node('gtr', 'instrument'),
  node('eq', 'eq'), node('bus', 'master-bus'), node('mon', 'studio-monitor'), node('rec', 'recorder'),
  node('pa', 'amp'), node('gen', 'generator'), node('gen2', 'generator'),
]
const byId = (id: string) => nodes.find((n) => n.id === id)!
/** Could a wire from `from` (card:port) be drawn into `to` (card:port), with `edges` already there? */
const takes = (from: string, to: string, edges: SignalEdge[] = [], level?: ComplexityLevel) => {
  const [nodeId, handleId = 'out'] = from.split(':')
  const [target, port = 'in'] = to.split(':')
  const source = { nodeId, handleId }
  return nodeAcceptsWire(byId(target), source, edges, nodes, level) && portAcceptsWire(byId(target), port, edges, source, nodes)
}

describe('the USB link between an Audio Interface and a DAW', () => {
  it('To computer goes only into a DAW, and a DAW takes nothing else', () => {
    expect(takes(`box:${TO_PC_PORT}`, 'daw')).toBe(true)
    for (const to of ['eq', 'bus', 'mon', 'rec', 'box2', `box2:${FROM_PC_PORT}`]) expect(takes(`box:${TO_PC_PORT}`, to)).toBe(false)
    for (const from of ['keys', 'pre', 'bus:out-l', 'box:out']) expect(takes(from, 'daw')).toBe(false)
  })

  it('at Advanced (no Interface) a DAW is a digital summing bus: it takes any wire, as many as you like', () => {
    expect(takes('keys', 'daw', [], 'advanced')).toBe(true)
    expect(takes('pre', 'daw', [wire('keys', 'daw')], 'advanced')).toBe(true)
    expect(takes('keys', 'daw', [], 'intermediate')).toBe(false)
  })

  it('one computer per Interface: To computer takes one wire', () => {
    expect(takes(`box:${TO_PC_PORT}`, 'daw2', [wire('box', 'daw', TO_PC_PORT)])).toBe(false)
  })

  it('no wire is drawn along the way back: From computer and the DAW\'s playback are hidden', () => {
    for (const from of [`daw:${PLAYBACK_PORT}`, 'keys', 'pre', 'bus:out-l']) expect(takes(from, `box:${FROM_PC_PORT}`)).toBe(false)
  })

  it('the computer\'s sound comes out of the line output: into a Gain or a Fader, a bus, a monitor', () => {
    for (const to of ['pre', 'fad', 'bus', 'mon']) expect(takes('box:out', to)).toBe(true)
  })
})

describe('what an Audio Interface records: line-level signals, as many as you like', () => {
  it('a line, a Preamp\'s output, a mix\'s Left and Right, the other Interface\'s playback', () => {
    expect(takes('keys', 'box')).toBe(true)
    expect(takes('pre', 'box', [wire('mic', 'p48'), wire('p48', 'pre')])).toBe(true)
    expect(takes('bus:out-r', 'box', [wire('bus', 'box', 'out-l')])).toBe(true)
    expect(takes('box2:out', 'box')).toBe(true)
  })

  it('not a microphone before its Preamp (through the 48V too), not a guitar', () => {
    expect(takes('mic', 'box')).toBe(false)
    expect(takes('p48', 'box', [wire('mic', 'p48')])).toBe(false)
    expect(takes('gtr', 'box')).toBe(false)
    expect(takes('mic', 'box', [], 'intermediate')).toBe(false)
  })

  it('at Beginner (no levels there) a microphone and a guitar too, as into the Mixer', () => {
    expect(takes('mic', 'box', [], 'beginner')).toBe(true)
    expect(takes('gtr', 'box', [], 'beginner')).toBe(true)
  })

  it('never dropped into the middle of a wire', () => {
    const view = { nodes, edges: [wire('keys', 'mon')] }
    expect(wireTakesCard('interface', view.edges[0], view, 'intermediate')).toBe(false)
    expect(wireTakesCard('daw', view.edges[0], view, 'intermediate')).toBe(false)
    expect(wireTakesCard('eq', view.edges[0], view, 'intermediate')).toBe(true)
  })
})

// An Amplifier (D27): one wire per input — but one stereo wire goes into both, so it takes both
describe('the Amplifier: two inputs, one stereo wire into both', () => {
  const amp = [wire('keys', 'pa', 'out', 'in')]
  const gen = [wire('gen', 'pa', 'out', 'in')]

  it('empty, either input takes a mono or a stereo wire', () => {
    for (const port of ['in', 'in-b']) {
      expect(takes('keys', `pa:${port}`)).toBe(true)
      expect(takes('gen', `pa:${port}`)).toBe(true)
    }
  })

  it('a stereo wire in one: the other takes nothing (it holds the wire too)', () => {
    expect(takes('gen', 'pa:in-b', amp)).toBe(false)
    expect(takes('gen2', 'pa:in-b', amp)).toBe(false)
  })

  it('a mono wire in one: the other takes a mono wire, not a stereo one (it would go into both)', () => {
    expect(takes('gen2', 'pa:in-b', gen)).toBe(true)
    expect(takes('keys', 'pa:in-b', gen)).toBe(false)
    // Wired from a bus's L or R, the wire takes the whole mix (D43)
    expect(takes('bus:out-l', 'pa:in-b', gen)).toBe(false)
  })
})

describe('the PFL Bus: for listening only', () => {
  it('takes any number of channels, and never feeds a Matrix Bus', () => {
    expect(takes('keys', 'pfl', [wire('pre', 'pfl')])).toBe(true)
    expect(takes('pfl', 'mtx')).toBe(false)
    expect(takes('pfl', 'fad')).toBe(true)
  })
})

describe('Beginner\'s devices (D20)', () => {
  const desk = [...nodes, node('mix', 'mixer'), node('stage', 'stage-box'), node('amp', 'amp'), node('spk', 'speaker')]
  const at = (id: string) => desk.find((n) => n.id === id)!
  const into = (from: string, to: string) => {
    const [nodeId, handleId = 'out'] = from.split(':')
    const source = { nodeId, handleId }
    return nodeAcceptsWire(at(to), source, [], desk) && portAcceptsWire(at(to), 'in', [], source)
  }

  it('a Stage Box\'s snake goes only into a Mixer; it takes microphones and lines', () => {
    expect(into('stage', 'mix')).toBe(true)
    for (const to of ['mon', 'rec', 'amp', 'box', 'bus']) expect(into('stage', to)).toBe(false)
    for (const from of ['mic', 'keys', 'gtr']) expect(into(from, 'stage')).toBe(true)
  })

  it('a Mixer\'s Main or Monitor goes anywhere — into a DAW too (a USB wire); an Amplifier only into a passive speaker', () => {
    for (const port of ['main', 'monitor']) {
      for (const to of ['daw', 'box', 'rec', 'mon', 'amp']) expect(into(`mix:${port}`, to)).toBe(true)
    }
    expect(into('amp', 'spk')).toBe(true)
    expect(into('amp', 'mix')).toBe(false)
  })
})

describe('the digital picture (D23, D41): the Codec, Stream / Broadcast, the DAW', () => {
  const studio = [
    ...nodes, { ...node('dec', 'codec'), params: { encodes: false } }, node('cod', 'codec'), node('air', 'broadcast'), node('adc', 'adc'),
    { ...node('aac', 'codec'), params: { encodes: false, codec: 'aac' } },
    node('phones', 'headphones'), node('spk', 'active-speaker'),
  ]
  const at = (id: string) => studio.find((n) => n.id === id)!
  const into = (from: string, to: string, level: 'intermediate' | 'advanced' = 'advanced') => {
    const [nodeId, handleId = 'out'] = from.split(':')
    const source = { nodeId, handleId }
    return nodeAcceptsWire(at(to), source, [], studio, level) && portAcceptsWire(at(to), 'in', [], source)
  }

  it('a Codec squeezing sends only into Stream / Broadcast', () => {
    expect(into('cod', 'air')).toBe(true)
    for (const to of ['eq', 'fad', 'bus', 'rec', 'spk']) expect(into('cod', to)).toBe(false)
  })

  it('at Advanced Stream / Broadcast takes only a Codec squeezing; below, any mix', () => {
    for (const from of ['bus:out-l', 'keys', 'dec', 'adc', 'eq']) {
      expect(into(from, 'air')).toBe(false)
      expect(into(from, 'air', 'intermediate')).toBe(true)
    }
  })

  it('a Codec squeezing takes analog and digital wires alike (fed analog, it says so: the engine)', () => {
    for (const from of ['keys', 'adc', 'dec', 'bus:out-l']) expect(into(from, 'cod')).toBe(true)
  })

  // D37: the round trip — what the listeners receive is unpacked by a Codec
  it('Stream / Broadcast\'s output goes only into a Codec unpacking, which takes nothing else', () => {
    expect(into('air', 'dec')).toBe(true)
    for (const to of ['eq', 'fad', 'spk', 'cod']) expect(into('air', to)).toBe(false)
    for (const from of ['keys', 'adc', 'cod', 'bus:out-l']) expect(into(from, 'dec')).toBe(false)
  })

  // D35 (the Recorder Track gone): the DAW records the tracks wired into it and its mix goes on
  it('the DAW\'s mix at Advanced goes into any input', () => {
    for (const to of ['eq', 'fad', 'bus', 'spk', 'cod']) expect(into('daw', to)).toBe(true)
  })

  it('a Recorder is an end point: dropped onto a wire, it never goes into it', () => {
    const view = { nodes: studio, edges: [wire('keys', 'fad')] }
    expect(wireTakesCard('recorder', view.edges[0], view, 'intermediate')).toBe(false)
  })

  it('a Codec unpacking takes only a stream of its own codec', () => {
    const streaming = [wire('cod', 'air')]
    const source = { nodeId: 'air', handleId: 'out' }
    expect(nodeAcceptsWire(at('dec'), source, streaming, studio, 'advanced')).toBe(true)
    expect(nodeAcceptsWire(at('aac'), source, streaming, studio, 'advanced')).toBe(false)
  })

  it('a Codec dropped onto a wire into Stream / Broadcast goes in; nothing else does at Advanced', () => {
    const view = { nodes: studio, edges: [wire('cod', 'air')] }
    const mix  = { nodes: studio, edges: [wire('bus', 'air', 'out-l')] }
    expect(wireTakesCard('codec', mix.edges[0], mix, 'advanced')).toBe(true)
    expect(wireTakesCard('eq', view.edges[0], view, 'advanced')).toBe(false)
  })
})
