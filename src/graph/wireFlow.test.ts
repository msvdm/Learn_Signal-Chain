import { describe, expect, it } from 'bun:test'
import type { SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { TO_PC_PORT } from '../data/nodeRegistry'
import { withUsbReturns } from './usbLink'
import { wireFlows } from './wireFlow'

// Wire colours by where the sound goes (D24): the bus (or recording) a wire's sound ends up in;
// shared wires stay main; a wire ending at a speaker takes the colour of the bus it comes from.

const node = (id: string, typeKey: TypeKey): SignalNode =>
  ({ id, typeKey, position: { x: 0, y: 0 }, params: {}, bypassed: false })

/** `from` / `to` as `card:port` (out / in by default); the wire's id is `from>to` as written. */
const wire = (from: string, to: string): SignalEdge => {
  const [source, sourceHandle = 'out'] = from.split(':')
  const [target, targetHandle = 'in'] = to.split(':')
  return { id: `${from}>${to}`, source, sourceHandle, target, targetHandle }
}

/** Each wire's flow, by its `from>to` id, the wires as the store keeps them */
function flowsOf(nodes: [string, TypeKey][], wires: [string, string][]) {
  const graph = { nodes: nodes.map(([id, type]) => node(id, type)), edges: wires.map(([a, b]) => wire(a, b)) }
  return Object.fromEntries(wireFlows({ ...graph, edges: withUsbReturns(graph) }))
}

describe('wire colours by where the sound goes', () => {
  it('a channel into the Master Bus and out to the speakers: the main flow', () => {
    expect(flowsOf(
      [['keys', 'keyboard'], ['gain', 'gain'], ['fader', 'fader'], ['bus', 'master-bus'], ['spk', 'active-speaker']],
      [['keys', 'gain'], ['gain', 'fader'], ['fader', 'bus'], ['bus:out-l', 'spk']],
    )).toEqual({ 'keys>gain': 'main', 'gain>fader': 'main', 'fader>bus': 'main', 'bus:out-l>spk': 'main' })
  })

  it('an Aux send is blue up to its bus and after it; the wire feeding both stays main', () => {
    expect(flowsOf(
      [['keys', 'keyboard'], ['gain', 'gain'], ['bus', 'master-bus'], ['aux', 'aux-bus'], ['send', 'fader'], ['wedge', 'active-speaker']],
      [['keys', 'gain'], ['gain', 'bus'], ['gain', 'send'], ['send', 'aux'], ['aux', 'wedge']],
    )).toEqual({ 'keys>gain': 'main', 'gain>bus': 'main', 'gain>send': 'aux', 'send>aux': 'aux', 'aux>wedge': 'aux' })
  })

  it('into and out of a Matrix Bus: magenta; the PFL Bus: yellow', () => {
    expect(flowsOf(
      [['keys', 'keyboard'], ['bus', 'master-bus'], ['mtx', 'matrix-bus'], ['spk', 'active-speaker'],
        ['sw', 'switch'], ['pfl', 'pfl-bus'], ['knob', 'gain'], ['phones', 'headphones']],
      [['keys', 'bus'], ['bus:out-l', 'mtx'], ['mtx:out-l', 'spk'], ['keys', 'sw'], ['sw', 'pfl'], ['pfl', 'knob'], ['knob', 'phones']],
    )).toEqual({
      'keys>bus': 'main', 'bus:out-l>mtx': 'matrix', 'mtx:out-l>spk': 'matrix',
      'keys>sw': 'pfl', 'sw>pfl': 'pfl', 'pfl>knob': 'pfl', 'knob>phones': 'pfl',
    })
  })

  it('what is recorded or sent out — into an Interface, along the USB wire, to Stream / Broadcast: record', () => {
    const flows = flowsOf(
      [['keys', 'keyboard'], ['bus', 'master-bus'], ['box', 'interface'], ['daw', 'daw'], ['air', 'broadcast'],
        ['fader', 'fader'], ['mon', 'studio-monitor'], ['rec', 'recorder']],
      [['keys', 'bus'], ['bus:out-l', 'box'], ['bus:out-r', 'air'], [`box:${TO_PC_PORT}`, 'daw'],
        ['box', 'fader'], ['fader', 'bus'], ['box', 'mon'], ['bus:out-r', 'rec']],
    )
    expect(flows['bus:out-l>box']).toBe('record')
    expect(flows['bus:out-r>air']).toBe('record')
    expect(flows[`box:${TO_PC_PORT}>daw`]).toBe('record')
    // The computer's sound back into the desk joins the main flow; straight to a monitor, main too
    expect(flows['box>fader']).toBe('main')
    expect(flows['box>mon']).toBe('main')
    // The Recorder is not on the list: it takes the Master Bus's colour
    expect(flows['bus:out-r>rec']).toBe('main')
  })

  it('a mix going both to the speakers and into a Matrix Bus stays main', () => {
    const flows = flowsOf(
      [['keys', 'keyboard'], ['bus', 'master-bus'], ['eq', 'graphic-eq'], ['mtx', 'matrix-bus'], ['spk', 'active-speaker']],
      [['keys', 'bus'], ['bus:out-l', 'eq'], ['eq', 'spk'], ['eq', 'mtx']],
    )
    expect(flows['bus:out-l>eq']).toBe('main')
    expect(flows['eq>mtx']).toBe('matrix')
  })
})
