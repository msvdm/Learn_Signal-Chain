// A stand-in for `bun:test` when the tests run under Node (`npm run test:node`, which sends
// `bun:test` here — test/node-hooks.ts). Only what the tests use, meaning what it means in Bun; CI
// runs the real one. A test that needs another matcher adds it here first.

import { AssertionError } from 'node:assert'
import { describe, it, test } from 'node:test'
import { inspect } from 'node:util'

export { describe, it, test }

/** Plain data equal all the way down; a property set to undefined counts as missing (Bun's toEqual). */
function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    const other = b as unknown[]
    return a.length === other.length && a.every((item, i) => equal(item, other[i]))
  }
  const ra  = a as Record<string, unknown>
  const rb  = b as Record<string, unknown>
  const set = (r: Record<string, unknown>) => Object.keys(r).filter((k) => r[k] !== undefined)
  const ka  = set(ra)
  const kb  = set(rb)
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(rb, k) && equal(ra[k], rb[k]))
}

export interface Matchers {
  toBe(expected: unknown): void
  toEqual(expected: unknown): void
  /** |received − expected| < 10^−numDigits / 2 */
  toBeCloseTo(expected: number, numDigits?: number): void
  toBeUndefined(): void
  toBeGreaterThan(expected: number): void
  toBeLessThan(expected: number): void
}

function matchers(actual: unknown, negate: boolean): Matchers {
  // `expected` is left out for the matchers that take none
  const check = (pass: boolean, name: string, ...expected: unknown[]) => {
    if (pass !== negate) return
    const shown = expected.length > 0 ? ` ${inspect(expected[0])}` : ''
    throw new AssertionError({
      message: `expected ${inspect(actual)} ${negate ? 'not ' : ''}${name}${shown}`,
      actual, expected: expected[0], operator: name,
    })
  }
  const num = actual as number
  return {
    toBe:            (expected) => check(Object.is(actual, expected), 'toBe', expected),
    toEqual:         (expected) => check(equal(actual, expected), 'toEqual', expected),
    toBeCloseTo:     (expected, numDigits = 2) =>
      check(Object.is(num, expected) || Math.abs(num - expected) < 10 ** -numDigits / 2, 'toBeCloseTo', expected),
    toBeUndefined:   () => check(actual === undefined, 'toBeUndefined'),
    toBeGreaterThan: (expected) => check(num > expected, 'toBeGreaterThan', expected),
    toBeLessThan:    (expected) => check(num < expected, 'toBeLessThan', expected),
  }
}

export function expect(actual: unknown): Matchers & { not: Matchers } {
  return { ...matchers(actual, false), not: matchers(actual, true) }
}
