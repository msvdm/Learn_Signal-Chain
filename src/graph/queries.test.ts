import { describe, expect, it } from 'bun:test'
import type { SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { SOUND_PORT } from '../data/nodeRegistry'
import { unwiredSource } from './queries'

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
