import { describe, expect, it } from 'bun:test'
import { LEVELS } from '../data/levels'
import { NODE_REGISTRY } from '../data/nodeRegistry'
import { nodeAcceptsWire, portAcceptsWire } from '../graph/connectionRules'
import { reconcileMainFaders } from '../graph/mainFader'
import { reachOf } from '../graph/reach'
import { withUsbReturns } from '../graph/usbLink'
import { stillPicture } from '../signal/engine'
import { parseChainFile } from './chainFile'
import { EXAMPLES, exampleChain } from './exampleChains'

// The tutorial's examples are shown to a class as how a chain works (D25): each must be wired as
// the app lets anyone wire it, and work — every end point gets its sound, nothing clips, no warning.

describe('example chains', () => {
  for (const level of LEVELS) {
    for (const key of EXAMPLES[level]) {
      it(`${key} (${level})`, () => {
        const chain = exampleChain(key, key)
        expect(chain.level).toBe(level)
        // Opens as a saved chain does, nothing left out
        const parsed = parseChainFile(JSON.parse(JSON.stringify(chain)))!
        expect(parsed.skipped).toBe(0)
        expect(parsed.chain.edges.length).toBe(chain.edges.length)

        const { nodes } = chain
        chain.edges.forEach((e, i) => {
          const before = chain.edges.slice(0, i)
          const target = nodes.find((n) => n.id === e.target)!
          const source = { nodeId: e.source, handleId: e.sourceHandle }
          expect(`${e.id}: ${nodeAcceptsWire(target, source, before, nodes, level)}`).toBe(`${e.id}: true`)
          expect(`${e.id}: ${portAcceptsWire(target, e.targetHandle, before, source, nodes)}`).toBe(`${e.id}: true`)
        })

        // As the store settles it (commitGraph): L / R takeovers, the USB wire's way back
        const edges = withUsbReturns({ nodes, edges: reconcileMainFaders({ nodes: [], edges: [] }, chain) })
        if (level === 'beginner') {
          const verdicts = [...reachOf({ nodes, edges }).verdicts]
          expect(verdicts.length).toBeGreaterThan(0)
          for (const [id, verdict] of verdicts) expect(`${id}: ${verdict}`).toBe(`${id}: sound`)
          return
        }
        const { stages } = stillPicture(nodes, edges).result
        for (const n of nodes) {
          const stage = stages[n.id]
          expect(`${n.id}: ${stage ? 'played' : 'left out'}`).toBe(`${n.id}: played`)
          expect(`${n.id}: ${stage.condition ?? 'fine'}`).toBe(`${n.id}: fine`)
          expect(`${n.id}: ${stage.health === 'clipping' ? 'clips' : 'fine'}`).toBe(`${n.id}: fine`)
          expect(`${n.id}: ${stage.hum === undefined ? 'no hum' : 'hum'}`).toBe(`${n.id}: no hum`)
          if (NODE_REGISTRY[n.typeKey].category === 'sink') expect(`${n.id}: ${stage.health}`).toBe(`${n.id}: good`)
        }
      })
    }
  }
})
