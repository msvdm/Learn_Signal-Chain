import type { WireKind } from '../graph/queries'

// A signal as a wire carries it — what it is (mono, stereo, one side of a mix) and its left and
// right — whatever is known of each side: its readings (signal/chain.ts WireSignal), how it moved
// over a loop (audio/measure.ts). One channel: l = r. Pure.

/** A signal's kind and its two sides (one channel: r is l; one side of a mix: the other silent). */
export interface Sided<T> {
  kind: WireKind
  l: T
  r: T
}

/** Which side of a stereo signal a card works on (null: its only channel). */
export type Side = 'l' | 'r' | null

/** What `onPort` needs to know of a side: its silence, and the louder of two (reading by reading). */
export interface SideOps<T> {
  silent: T
  louder: (a: T, b: T) => T
}

/** What an output that carries `kind` sends of a card's signal: one side of it, both, or — one channel — the louder of the two. */
export function onPort<T>(kind: WireKind, out: Sided<T>, { silent, louder }: SideOps<T>): Sided<T> {
  switch (kind) {
    case 'left':   return { kind, l: out.l, r: silent }
    case 'right':  return { kind, l: silent, r: out.r }
    case 'stereo': return { kind, l: out.l, r: out.r }
    default: {
      const one = louder(out.l, out.r)
      return { kind, l: one, r: one }
    }
  }
}

/** A wire's signal as a card takes it: one channel (of one side of a mix: that side), or both sides. */
export function asKind<T>(w: Sided<T>, kind: WireKind): Sided<T> {
  if (kind !== 'mono') return { kind, l: w.l, r: w.r }
  const side = w.kind === 'right' ? w.r : w.l
  return { kind, l: side, r: side }
}
