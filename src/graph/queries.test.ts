import { describe, expect, it } from 'bun:test'
import type { SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { MIX_PORT, SOUND_PORT } from '../data/nodeRegistry'
import { faderBusOf, unwiredSource } from './queries'

// No connection, no signal (decision D11): a source with nothing plugged into its output shows no
// level and no readings, and its meters stand still, until it is wired to something.

const node = (id: string, typeKey: TypeKey): SignalNode => ({ id, typeKey, position: { x: 0, y: 0 }, params: {}, bypassed: false })
const wire = (source: string, target: string, sourceHandle = 'out', targetHandle = 'in'): SignalEdge =>
  ({ id: `${source}-${target}`, source, sourceHandle, target, targetHandle })

describe('a source not connected yet', () => {
  it('every kind of source, alone on the canvas', () => {
    for (const type of ['mic', 'line-in', 'instrument', 'generator'] as const) {
      expect(unwiredSource('s', { nodes: [node('s', type)], edges: [] })).toBe(true)
    }
  })

  it('wired to something: connected, whatever is at the other end', () => {
    const nodes = [node('mic', 'mic'), node('gain', 'gain'), node('line', 'line-in'), node('comp', 'comp')]
    const view  = { nodes, edges: [wire('mic', 'gain'), wire('line', 'comp')] }
    expect(unwiredSource('mic', view)).toBe(false)
    expect(unwiredSource('line', view)).toBe(false)
  })

  it('a Microphone hearing a Guitar Amp, with nothing on its own output: not connected', () => {
    const nodes = [node('gtr', 'instrument'), node('amp', 'guitar-amp'), node('mic', 'mic')]
    const view  = { nodes, edges: [wire('gtr', 'amp'), wire('amp', 'mic', SOUND_PORT)] }
    expect(unwiredSource('mic', view)).toBe(true)
    expect(unwiredSource('gtr', view)).toBe(false)
  })

  it('anything else is never "not connected": a card with nothing plugged in is silent, not unwired', () => {
    const nodes = [node('comp', 'comp'), node('amp', 'guitar-amp'), node('spk', 'active-speaker')]
    for (const id of ['comp', 'amp', 'spk']) expect(unwiredSource(id, { nodes, edges: [] })).toBe(false)
    expect(unwiredSource('gone', { nodes, edges: [] })).toBe(false)
  })
})

// A Fader's cap says what it sets: an Aux Bus's level blue, a Main Fader red, a channel's plain
// (FaderNode)

describe('the bus a Fader sets the level of', () => {
  it("an Aux Bus's, mono or stereo, through effects", () => {
    const nodes = [node('aux', 'aux-bus'), node('comp', 'comp'), node('f', 'fader'), node('saux', 'aux-bus'), node('sf', 'fader')]
    const view  = { nodes, edges: [wire('aux', 'comp'), wire('comp', 'f'), wire('saux', 'sf', MIX_PORT)] }
    expect(faderBusOf('f', view)?.id).toBe('aux')
    expect(faderBusOf('sf', view)?.id).toBe('saux')
  })

  it("a Master Bus's: its Main Fader", () => {
    const view = { nodes: [node('bus', 'master-bus'), node('f', 'fader')], edges: [wire('bus', 'f', MIX_PORT)] }
    expect(faderBusOf('f', view)?.typeKey).toBe('master-bus')
  })

  it("a channel's fader, or one after the bus's own fader: none", () => {
    const nodes = [node('mic', 'mic'), node('pre', 'gain'), node('f', 'fader'), node('aux', 'aux-bus'), node('af', 'fader'), node('f2', 'fader')]
    const view  = { nodes, edges: [wire('mic', 'pre'), wire('pre', 'f'), wire('aux', 'af'), wire('af', 'f2')] }
    expect(faderBusOf('f', view)).toBe(null)
    expect(faderBusOf('f2', view)).toBe(null)
    expect(faderBusOf('af', view)?.id).toBe('aux')
  })
})
