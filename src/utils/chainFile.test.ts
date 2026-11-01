import { describe, expect, it } from 'bun:test'
import { parseChainFile } from './chainFile'

// A saved chain read back: what a Vocal does, in today's words and in words the app does not know;
// an element of a type it does not know.

type SavedNode = { id: string; typeKey: string; position?: { x: number; y: number }; params?: Record<string, unknown>; color?: string }

const file = (nodes: SavedNode[], edges: object[] = []) => parseChainFile({
  app: 'learn-signal-chain', version: 2, name: '', level: 'intermediate',
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

describe('an element this app does not know', () => {
  it('is left out, and counted', () => {
    const parsed = parseChainFile({
      app: 'learn-signal-chain', version: 2, name: '', level: 'intermediate',
      nodes: [{ id: 'a', typeKey: 'vocal', position: { x: 0, y: 0 } }, { id: 'b', typeKey: 'theremin', position: { x: 0, y: 0 } }],
      edges: [], sizes: {},
    })!
    expect(parsed.chain.nodes.map((n) => n.typeKey)).toEqual(['vocal'])
    expect(parsed.skipped).toBe(1)
  })
})
