import { describe, expect, it } from 'bun:test'
import type { SignalEdge, SignalNode } from '../data/nodeRegistry'
import { card, line, wire } from '../../test/chains'
import { interfacePorts, isLinkChannel, partnerOf, withLinkChannels, withoutStrayInterfaceWires } from './interfaceLink'
import { nodeAcceptsWire, portAcceptsWire } from './connectionRules'
import { linkChannelCount } from './queries'
import { nodeName } from '../utils/nodeName'
import type { Translations } from '../i18n/translations'
import en from '../i18n/locales/en.json'

// A Digital Interface's cable (D40): one drawn wire, a hidden one per channel along it; the ports a
// interface shows; what it may be wired to.

const nodes: SignalNode[] = [
  line('a'), card('adcA', 'adc'),
  card('keys', 'keyboard'), card('adcK', 'adc'),
  card('pack', 'digital-interface', { protocol: 'aes50' }),
  card('unpack', 'digital-interface', { packs: false, clock: 'external' }),
  card('daw', 'daw'),
]
const edges: SignalEdge[] = [
  wire('a', 'adcA'), wire('keys', 'adcK'),
  wire('adcA', 'pack:in'), wire('adcK', 'pack:in3'),
  wire('pack:link', 'unpack:link'),
  wire('unpack:out', 'daw'),
]
const settled = withLinkChannels({ nodes, edges })
const view    = { nodes, edges: settled }

describe('the channels along a cable', () => {
  it('one hidden wire per channel wired into the packing end, on the same port line both sides', () => {
    const channels = settled.filter(isLinkChannel)
    expect(channels.map((e) => [e.source, e.sourceHandle, e.target, e.targetHandle])).toEqual([
      ['pack', 'ch1', 'unpack', 'ch1'],
      ['pack', 'ch3', 'unpack', 'ch3'],
    ])
  })

  it('settled again, nothing changes: the same array', () => {
    expect(withLinkChannels(view)).toBe(settled)
  })

  it('the cable unplugged takes its channels with it', () => {
    const left = withLinkChannels({ nodes, edges: settled.filter((e) => e.id !== 'pack:link → unpack:link') })
    expect(left.some(isLinkChannel)).toBe(false)
  })

  it('each end knows the other', () => {
    expect(partnerOf('pack', view)?.id).toBe('unpack')
    expect(partnerOf('unpack', view)?.id).toBe('pack')
  })

  it('counts a stereo wire as two channels', () => {
    expect(linkChannelCount('pack', view)).toBe(3)
    expect(linkChannelCount('unpack', view)).toBe(3)
  })
})

describe('the ports a Digital Interface shows', () => {
  it('packing: its wired inputs up to the last and an empty one — a gap between them is it (D29); its cable out', () => {
    const ports = interfacePorts(nodes[4], view)
    expect(ports.inputs.map((p) => p.id)).toEqual(['in', 'in2', 'in3'])
    expect(interfacePorts(nodes[4], { nodes, edges: [] }).inputs.map((p) => p.id)).toEqual(['in'])
    expect(ports.outputs.filter((p) => !p.hidden).map((p) => p.id)).toEqual(['link'])
  })

  it('unpacking: its cable in, one output per channel wire the cable brings', () => {
    const ports = interfacePorts(nodes[5], view)
    expect(ports.inputs.filter((p) => !p.hidden).map((p) => p.id)).toEqual(['link'])
    expect(ports.outputs.map((p) => p.id)).toEqual(['out', 'out2', 'out3'])
  })

  it('the same layout is the same arrays', () => {
    expect(interfacePorts(nodes[4], view).inputs).toBe(interfacePorts(nodes[4], { nodes, edges: [...settled] }).inputs)
  })

  it('switched from packing to unpacking, the wires on ports it no longer has go', () => {
    const switched = nodes.map((n) => (n.id === 'pack' ? { ...n, params: { ...n.params, packs: false } } : n))
    const left = withoutStrayInterfaceWires({ nodes: switched, edges: settled })
    expect(left.some((e) => e.target === 'pack' || e.source === 'pack')).toBe(false)
    expect(left.some((e) => e.id === 'unpack:out → daw')).toBe(true)
  })
})

describe('what a Digital Interface may be wired to', () => {
  const free = card('unpack2', 'digital-interface', { packs: false })
  const all  = [...nodes, free]

  it('its cable goes only into an interface set to PCM, and into one only', () => {
    const cable = { nodeId: 'pack', handleId: 'link' }
    expect(nodeAcceptsWire(nodes[6], cable, settled, all, 'advanced')).toBe(false)
    expect(portAcceptsWire(free, 'link', settled, cable, all)).toBe(false)
    const unwired = settled.filter((e) => e.sourceHandle !== 'link')
    expect(nodeAcceptsWire(free, cable, unwired, all, 'advanced')).toBe(true)
  })

  it('its cable goes only into one unpacking the same protocol', () => {
    const aesIn   = card('aesIn', 'digital-interface', { packs: false, protocol: 'aes3' })
    const unwired = settled.filter((e) => e.sourceHandle !== 'link')
    expect(nodeAcceptsWire(aesIn, { nodeId: 'pack', handleId: 'link' }, unwired, [...nodes, aesIn], 'advanced')).toBe(false)
  })

  it('one unpacking takes nothing but a cable', () => {
    expect(nodeAcceptsWire(free, { nodeId: 'adcA', handleId: 'out' }, settled, all, 'advanced')).toBe(false)
  })

  it('AES/EBU takes two channels: one stereo wire, then nothing more', () => {
    const aes   = card('aes', 'digital-interface', { protocol: 'aes3' })
    const with2 = [...nodes, aes]
    const one   = [...settled, wire('adcK', 'aes:in')]
    expect(nodeAcceptsWire(aes, { nodeId: 'adcK', handleId: 'out' }, settled, with2, 'advanced')).toBe(true)
    expect(nodeAcceptsWire(aes, { nodeId: 'adcA', handleId: 'out' }, one, with2, 'advanced')).toBe(false)
  })
})

describe('what a Digital Interface is called (D40)', () => {
  const t = en as unknown as Translations
  it('Digital Interface, packing or unpacking — its line says which way', () => {
    expect(nodeName(t, nodes[4])).toBe('Digital Interface')
    expect(nodeName(t, nodes[5])).toBe('Digital Interface')
  })
})
