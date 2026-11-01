import { describe, expect, it } from 'bun:test'
import type { SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { FROM_PC_PORT, PLAYBACK_PORT, TO_PC_PORT } from '../data/nodeRegistry'
import { isUsbReturn, withUsbReturns } from './usbLink'

// The USB link (D22): one wire from an Audio Interface's To computer into a DAW carries both ways;
// the store keeps its way back — the DAW's playback into the Interface's From computer.

const node = (id: string, typeKey: TypeKey): SignalNode =>
  ({ id, typeKey, position: { x: 0, y: 0 }, params: {}, bypassed: false })
const wire = (id: string, source: string, sourceHandle: string, target: string, targetHandle = 'in'): SignalEdge =>
  ({ id, source, sourceHandle, target, targetHandle })

const nodes = [node('box', 'interface'), node('daw', 'daw'), node('keys', 'keyboard')]
const usb   = wire('u', 'box', TO_PC_PORT, 'daw')
const back  = (edges: SignalEdge[]) => edges.filter(isUsbReturn)

describe('the USB wire\'s way back', () => {
  it('one for every USB wire: from the DAW\'s playback into the Interface\'s From computer', () => {
    const edges = withUsbReturns({ nodes, edges: [wire('k', 'keys', 'out', 'box'), usb] })
    expect(back(edges)).toEqual([{ id: 'u:back', source: 'daw', sourceHandle: PLAYBACK_PORT, target: 'box', targetHandle: FROM_PC_PORT }])
  })

  it('settled wires come back as they are, the same array', () => {
    const settled = withUsbReturns({ nodes, edges: [usb] })
    expect(withUsbReturns({ nodes, edges: settled })).toBe(settled)
    const none = [wire('k', 'keys', 'out', 'box')]
    expect(withUsbReturns({ nodes, edges: none })).toBe(none)
  })

  it('gone with its USB wire; a second one, or one drawn by hand in an older chain, is dropped', () => {
    const settled = withUsbReturns({ nodes, edges: [usb] })
    expect(withUsbReturns({ nodes, edges: settled.filter((e) => e.id !== 'u') })).toEqual([])
    const twice = [...settled, { ...back(settled)[0], id: 'copy' }]
    expect(back(withUsbReturns({ nodes, edges: twice })).length).toBe(1)
    expect(withUsbReturns({ nodes, edges: [wire('old', 'daw', PLAYBACK_PORT, 'box', FROM_PC_PORT)] })).toEqual([])
  })
})

describe('a Mixer wired into a DAW (Beginner: a desk with USB)', () => {
  it('its way back comes into the Mixer\'s input', () => {
    const desk = [node('mix', 'mixer'), node('daw', 'daw')]
    const edges = withUsbReturns({ nodes: desk, edges: [wire('m', 'mix', 'main', 'daw')] })
    expect(back(edges)).toEqual([{ id: 'm:back', source: 'daw', sourceHandle: PLAYBACK_PORT, target: 'mix', targetHandle: 'in' }])
  })
})
