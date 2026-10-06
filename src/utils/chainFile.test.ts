import { describe, expect, it } from 'bun:test'
import { parseChainFile } from './chainFile'

// A saved chain read back: what a Microphone or Line Input picks up, in a file from before the
// Speech / Singing / Drums choices (step 10c) and in one with a word no version knows.

const fileWith = (typeKey: string, params: Record<string, unknown>) => ({
  app: 'learn-signal-chain', version: 1, name: '', level: 'intermediate',
  nodes: [{ id: 'a', typeKey, position: { x: 0, y: 0 }, params }], edges: [], sizes: {},
})

const characterOf = (typeKey: string, character: unknown) =>
  parseChainFile(fileWith(typeKey, { character }))?.chain.nodes[0].params.character

describe('what a source picks up, read from a file', () => {
  it('today’s words', () => {
    expect(characterOf('mic', 'singing')).toBe('singing')
    expect(characterOf('mic', 'drums')).toBe('drums')
    expect(characterOf('line-in', 'drums')).toBe('drums')
  })

  it('an older file: Melodic is a Microphone’s Speech and a Line Input’s Music, Percussive is Drums', () => {
    expect(characterOf('mic', 'melodic')).toBe('speech')
    expect(characterOf('line-in', 'melodic')).toBe('music')
    expect(characterOf('mic', 'percussive')).toBe('drums')
    expect(characterOf('line-in', 'percussive')).toBe('drums')
  })

  it('a word the type does not know: its default', () => {
    expect(characterOf('mic', 'music')).toBe('speech')
    expect(characterOf('line-in', 'singing')).toBe('music')
    expect(characterOf('mic', 'trumpet')).toBe('speech')
    expect(characterOf('mic', 'constructor')).toBe('speech')
  })
})
