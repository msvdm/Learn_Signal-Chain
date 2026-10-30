import { describe, expect, it } from 'bun:test'
import { SOUND_PORT } from '../data/nodeRegistry'
import { parseChainFile } from './chainFile'

// A saved chain read back: what a Vocal does, in today's words and in words no version knows; and a
// file from version 1 — its Line Inputs are Keyboards now, and a Microphone that was the sound too
// gets the sound it picked up wired into it (D21).

type SavedNode = { id: string; typeKey: string; position?: { x: number; y: number }; params?: Record<string, unknown>; color?: string }

const file = (nodes: SavedNode[], edges: object[] = [], version = 2) => parseChainFile({
  app: 'learn-signal-chain', version, name: '', level: 'intermediate',
  nodes: nodes.map((n) => ({ position: { x: 0, y: 0 }, params: {}, ...n })), edges, sizes: {},
})!.chain

const characterOf = (character: unknown) => file([{ id: 'a', typeKey: 'vocal', params: { character } }]).nodes[0].params.character

describe('what a Vocal does, read from a file', () => {
  it('today’s words', () => {
    expect(characterOf('speech')).toBe('speech')
    expect(characterOf('singing')).toBe('singing')
  })

  it('a word it does not know: its default', () => {
    expect(characterOf('drums')).toBe('speech')
    expect(characterOf('trumpet')).toBe('speech')
    expect(characterOf('constructor')).toBe('speech')
  })
})

describe('a file from version 1', () => {
  const old = (nodes: SavedNode[], edges: object[] = []) => file(nodes, edges, 1)
  const amp = { id: 'amp', typeKey: 'guitar-amp' }
  const fromAmp = { id: 'e1', source: 'amp', sourceHandle: SOUND_PORT, target: 'm', targetHandle: 'in' }

  it('a Line Input is a Keyboard: its level kept, its Mono | Stereo and what it played left out', () => {
    const [keys] = old([{ id: 'k', typeKey: 'line-in', params: { levelDb: -20, stereo: false, character: 'drums' } }]).nodes
    expect(keys.typeKey).toBe('keyboard')
    expect(keys.params).toEqual({ levelDb: -20 })
  })

  it('a Microphone gets what it picked up to its left, wired into it', () => {
    const chain = old([{ id: 'm', typeKey: 'mic', position: { x: 500, y: 100 }, params: { sensitivityDb: -60, character: 'singing' } }])
    const [mic, voice] = chain.nodes
    expect(mic).toEqual({ id: 'm', typeKey: 'mic', position: { x: 500, y: 100 }, params: { micType: 'dynamic' }, bypassed: false })
    expect([voice.typeKey, voice.params.character, voice.position.y]).toEqual(['vocal', 'singing', 100])
    expect(voice.position.x).toBeLessThan(500)
    expect(chain.edges).toEqual([{ id: `${voice.id}-m`, source: voice.id, sourceHandle: SOUND_PORT, target: 'm', targetHandle: 'in' }])
  })

  it('Drums (or Percussive) are a Drum Kit; Speech, Melodic or nothing a Vocal speaking', () => {
    const soundFor = (character: unknown) => old([{ id: 'm', typeKey: 'mic', params: { character } }]).nodes[1]
    expect(soundFor('drums').typeKey).toBe('drum-kit')
    expect(soundFor('percussive').typeKey).toBe('drum-kit')
    for (const character of ['speech', 'melodic', undefined]) {
      expect([soundFor(character).typeKey, soundFor(character).params.character]).toEqual(['vocal', 'speech'])
    }
  })

  it('a Microphone in front of a Guitar Amp hears it already: nothing is added', () => {
    const chain = old([amp, { id: 'm', typeKey: 'mic', params: { character: 'drums' } }], [fromAmp])
    expect(chain.nodes.map((n) => n.typeKey)).toEqual(['guitar-amp', 'mic'])
    expect(chain.edges.length).toBe(1)
  })

  it('from version 2 a Microphone hearing nothing stays so', () => {
    expect(file([{ id: 'm', typeKey: 'mic' }]).nodes.length).toBe(1)
  })
})
