import { describe, expect, it } from 'bun:test'
import type { SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { MIX_PORT, SOUND_PORT } from '../data/nodeRegistry'
import { faderBusOf, phantomPowered, unwiredSource } from './queries'

// No connection, no signal (decision D11): a source with nothing plugged into its output, or a
// Microphone hearing nothing (D21), shows no level and no readings, and its meters stand still,
// until it is wired.

const node = (id: string, typeKey: TypeKey, params: SignalNode['params'] = {}): SignalNode =>
  ({ id, typeKey, position: { x: 0, y: 0 }, params, bypassed: false })
const wire = (source: string, target: string, sourceHandle = 'out', targetHandle = 'in'): SignalEdge =>
  ({ id: `${source}-${target}`, source, sourceHandle, target, targetHandle })

describe('a source not connected yet', () => {
  it('every kind of source, alone on the canvas', () => {
    for (const type of ['vocal', 'drum-kit', 'acoustic', 'mic', 'keyboard', 'pc', 'instrument', 'generator'] as const) {
      expect(unwiredSource('s', { nodes: [node('s', type)], edges: [] })).toBe(true)
    }
  })

  it('wired to something: connected, whatever is at the other end', () => {
    const nodes = [node('voice', 'vocal'), node('gain', 'gain'), node('line', 'keyboard'), node('comp', 'comp')]
    const view  = { nodes, edges: [wire('voice', 'gain', SOUND_PORT), wire('line', 'comp')] }
    expect(unwiredSource('voice', view)).toBe(false)
    expect(unwiredSource('line', view)).toBe(false)
  })

  it('a Microphone: not connected while it hears nothing, whatever its output', () => {
    const nodes = [node('gtr', 'instrument'), node('amp', 'guitar-amp'), node('mic', 'mic'), node('mic2', 'mic'), node('pre', 'gain')]
    const view  = { nodes, edges: [wire('gtr', 'amp'), wire('amp', 'mic', SOUND_PORT), wire('mic2', 'pre')] }
    expect(unwiredSource('mic', view)).toBe(false)
    expect(unwiredSource('mic2', view)).toBe(true)
    expect(unwiredSource('gtr', view)).toBe(false)
  })

  it('anything else is never "not connected": a card with nothing plugged in is silent, not unwired', () => {
    const nodes = [node('comp', 'comp'), node('amp', 'guitar-amp'), node('spk', 'active-speaker')]
    for (const id of ['comp', 'amp', 'spk']) expect(unwiredSource(id, { nodes, edges: [] })).toBe(false)
    expect(unwiredSource('gone', { nodes, edges: [] })).toBe(false)
  })
})

// A Fader's cap says what it sets: an Aux Bus's level blue, a Matrix Bus's magenta, a Main Fader
// red, a channel's plain (FaderNode)

describe('the bus a Fader sets the level of', () => {
  it("an Aux Bus's, mono or stereo, through effects", () => {
    const nodes = [node('aux', 'aux-bus'), node('comp', 'comp'), node('f', 'fader'), node('saux', 'aux-bus'), node('sf', 'fader')]
    const view  = { nodes, edges: [wire('aux', 'comp'), wire('comp', 'f'), wire('saux', 'sf', MIX_PORT)] }
    expect(faderBusOf('f', view)?.id).toBe('aux')
    expect(faderBusOf('sf', view)?.id).toBe('saux')
  })

  it("a Master or Matrix Bus's: its Main Fader", () => {
    const nodes = [node('bus', 'master-bus'), node('f', 'fader'), node('mx', 'matrix-bus'), node('mf', 'fader')]
    const view  = { nodes, edges: [wire('bus', 'f', MIX_PORT), wire('mx', 'mf', MIX_PORT)] }
    expect(faderBusOf('f', view)?.typeKey).toBe('master-bus')
    expect(faderBusOf('mf', view)?.typeKey).toBe('matrix-bus')
  })

  it("a channel's fader, or one after the bus's own fader: none", () => {
    const nodes = [node('mic', 'mic'), node('pre', 'gain'), node('f', 'fader'), node('aux', 'aux-bus'), node('af', 'fader'), node('f2', 'fader')]
    const view  = { nodes, edges: [wire('mic', 'pre'), wire('pre', 'f'), wire('aux', 'af'), wire('af', 'f2')] }
    expect(faderBusOf('f', view)).toBe(null)
    expect(faderBusOf('f2', view)).toBe(null)
    expect(faderBusOf('af', view)?.id).toBe('aux')
  })
})

// A condenser microphone gets its power from the desk input it plugs into (D21): a 48V switched on
// after it and before its Preamp

describe('48V phantom power reaching a microphone', () => {
  const nodes = [
    node('mic', 'mic', { micType: 'condenser' }), node('pad', 'pad'), node('p48', 'phantom'),
    node('off', 'phantom', { on: false }), node('pre', 'gain'), node('pre2', 'gain'), node('later', 'phantom'),
  ]
  const powered = (...edges: SignalEdge[]) => phantomPowered('mic', { nodes, edges })

  it('a 48V switched on before the Preamp, straight after the mic or through a Pad', () => {
    expect(powered(wire('mic', 'p48'), wire('p48', 'pre'))).toBe(true)
    expect(powered(wire('mic', 'pad'), wire('pad', 'p48'), wire('p48', 'pre'))).toBe(true)
    // With no Preamp after it too: the 48V is what counts
    expect(powered(wire('mic', 'p48'))).toBe(true)
  })

  it('none: no 48V, one switched off, or one after the Preamp', () => {
    expect(powered()).toBe(false)
    expect(powered(wire('mic', 'pre'))).toBe(false)
    expect(powered(wire('mic', 'off'), wire('off', 'pre'))).toBe(false)
    expect(powered(wire('mic', 'pre'), wire('pre', 'later'))).toBe(false)
  })

  it('a mic split to two desks: one 48V powers it', () => {
    expect(powered(wire('mic', 'pre'), wire('mic', 'p48'), wire('p48', 'pre2'))).toBe(true)
  })
})
