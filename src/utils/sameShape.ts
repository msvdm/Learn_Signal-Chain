// "Did it change?" for plain data. Lets the engine and the canvas hand back the object they gave
// last time when nothing in it changed, so a card or wire that reads it is not redrawn.

/** Plain data (numbers, strings, arrays, plain objects) equal all the way down. */
export function sameShape(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    const other = b as unknown[]
    return a.length === other.length && a.every((item, i) => sameShape(item, other[i]))
  }
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) => sameShape((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

/**
 * The same items, but each one that equals the one with its id last time is that old object.
 * `last` is updated to this call's items.
 */
export function keepSame<T extends { id: string }>(last: Map<string, T>, items: T[]): T[] {
  const kept = items.map((item) => {
    const before = last.get(item.id)
    return before && sameShape(before, item) ? before : item
  })
  last.clear()
  for (const item of kept) last.set(item.id, item)
  return kept
}
