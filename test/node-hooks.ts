// `npm run test:node`: runs the `bun:test` files with Node instead of Bun (CI runs `bun test`).
// Node (22.18 and up) strips the types by itself; this teaches it the two things Bun does and Node
// does not:
// - `bun:test` is test/bun-test.ts, a stand-in built on node:test
// - an import without an extension (`'./levels'`) is the .ts file

import { registerHooks } from 'node:module'

const BUN_TEST = new URL('./bun-test.ts', import.meta.url).href

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'bun:test') return { url: BUN_TEST, shortCircuit: true }
    const relative = specifier.startsWith('./') || specifier.startsWith('../')
    if (relative && !/\.\w+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context)
    return nextResolve(specifier, context)
  },
})
