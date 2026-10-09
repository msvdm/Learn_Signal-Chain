import { expect, it } from 'bun:test'
import type { NodeParamValue, SignalEdge, SignalNode, TypeKey } from '../src/data/nodeRegistry'
import { initialParams } from '../src/data/nodeRegistry'
import type { WireKind } from '../src/graph/queries'
import type { GraphSignalResult, StageResult, StageRole, WireSignal } from '../src/signal/engine'
import { graphSignal, louderSide } from '../src/signal/engine'
import type { SideLevels, SignalDomain, SignalHealth } from '../src/signal/levels'
import { CLIP_DBU, louder, sumNoiseToDb } from '../src/signal/levels'
import type { StageCondition, Transfer } from '../src/signal/process'
import { LINE_NOISE_DBU, throughCurve } from '../src/signal/process'

// The number engine's tests build chains and check every card with these (src/signal/engine.*.test.ts).

// ── Building a chain ────────────────────────────────────────────────────────────

/** A card with its type's starting params (as dropped at Advanced), `params` on top. */
export function card(id: string, typeKey: TypeKey, params: Record<string, NodeParamValue> = {}, bypassed = false): SignalNode {
  return { id, typeKey, position: { x: 0, y: 0 }, params: { ...initialParams(typeKey, 'advanced'), ...params }, bypassed }
}

/**
 * A wire from `card:output` to `card:input` (`out` / `in` when left out). Written as the app holds
 * it once settled (graph/mainFader.ts): a Main Fader on its bus's `mix`, a Matrix send on `send`.
 */
export function wire(from: string, to: string): SignalEdge {
  const [source, sourceHandle = 'out'] = from.split(':')
  const [target, targetHandle = 'in'] = to.split(':')
  return { id: `${from} → ${to}`, source, sourceHandle, target, targetHandle }
}

export const signalOf = (nodes: SignalNode[], edges: SignalEdge[]) => graphSignal(nodes, edges)

// ── What a card should show ─────────────────────────────────────────────────────

/** One channel (l = r), or [left, right]. −Infinity: silence. */
export type Level = number | readonly [number, number]

export interface Expected {
  /** What leaves the card: one channel, or both sides of a stereo signal */
  out: Level
  health: SignalHealth
  /** What it works on (checked when given) */
  in?: Level
  /** Leaving: analog unless said */
  domain?: SignalDomain
  /** Arriving: analog unless said */
  inDomain?: SignalDomain
  condition?: StageCondition
  role?: StageRole
  /** How far a dynamics card turns the signal down */
  reduction?: number
  /** The hum leaving it */
  hum?: number
}

/** A side's average (rms): the level the tables lock. Its peaks and noise are checked further down. */
export const average = (w: WireSignal, side: 'l' | 'r'): number => w[side].rms

/** dB to two decimals; silence exactly. */
export function expectDb(actual: number | undefined, expected: number | undefined) {
  if (expected === undefined) expect(actual).toBeUndefined()
  else if (isFinite(expected)) expect(actual).toBeCloseTo(expected, 2)
  else expect(actual).toBe(expected)
}

export function expectSignal(actual: WireSignal, expected: Level) {
  const [l, r] = typeof expected === 'number' ? [expected, expected] : expected
  expect(actual.kind).toBe(typeof expected === 'number' ? 'mono' : 'stereo')
  expectDb(average(actual, 'l'), l)
  expectDb(average(actual, 'r'), r)
}

/** What output `key` (`card:port`) sends: its kind and both sides. */
export function expectWire(result: GraphSignalResult, key: string, kind: WireKind, l: number, r: number) {
  const w = result.wires.get(key)
  expect(w?.kind).toBe(kind)
  expectDb(w && average(w, 'l'), l)
  expectDb(w && average(w, 'r'), r)
}

/** One test per card, named after it, and one that every card is in the table. */
export function expectCards(result: GraphSignalResult, cards: Record<string, Expected>) {
  it('has every card in the table', () => {
    expect(Object.keys(result.stages).sort()).toEqual(Object.keys(cards).sort())
  })
  for (const [id, want] of Object.entries(cards)) {
    it(id, () => {
      const stage = result.stages[id]
      if (want.in !== undefined) expectSignal(stage.in, want.in)
      expectSignal(stage.out, want.out)
      expect(stage.health).toBe(want.health)
      expect(stage.domain).toBe(want.domain ?? 'analog')
      expect(stage.inDomain).toBe(want.inDomain ?? 'analog')
      expect(stage.condition).toBe(want.condition)
      expect(stage.role).toBe(want.role)
      expectDb(stage.gainReductionDb, want.reduction)
      expectDb(stage.hum, want.hum)
    })
  }
}

export const S = -Infinity

// ── Peaks, noise and the hum ────────────────────────────────────────────────────

/** What leaves a card: its peak, average and noise (the louder side). */
export const leaving = (result: GraphSignalResult, id: string): SideLevels =>
  louder(result.stages[id].out.l, result.stages[id].out.r)

/** Each card's [peak, average, noise] leaving it, one test per card. */
export function expectReadings(result: GraphSignalResult, cards: Record<string, readonly [peak: number, rms: number, noise: number]>) {
  for (const [id, [peak, rms, noise]] of Object.entries(cards)) {
    it(`${id}: peaks ${peak}, average ${rms}, noise ${noise}`, () => {
      const s = leaving(result, id)
      expectDb(s.peak, peak)
      expectDb(s.rms, rms)
      expectDb(s.noise, noise)
    })
  }
}

// ── The marks on a dynamics card's curve ────────────────────────────────────────

/** A side's [peak, average, noise]. */
export function expectSide(actual: SideLevels | undefined, [peak, rms, noise]: readonly [number, number, number]) {
  expectDb(actual?.peak, peak)
  expectDb(actual?.rms, rms)
  expectDb(actual?.noise, noise)
}

/** The marks on a dynamics card's curve: what goes in — the louder side arriving (the dynamics run linked). */
export const curveIn = (stage: StageResult): SideLevels => louderSide(stage.in)

/** … and where the card sends them: the louder side leaving. */
export const curveOut = (stage: StageResult): SideLevels => louderSide(stage.out)

/**
 * The readings through the card's curve on their own (peaks flattened at the clip level, as the
 * engine does), then its own noise after it (a dynamics card: a line stage's, D18).
 */
export function marksOf(stage: StageResult, curve: Transfer): SideLevels {
  const out = throughCurve(curve, curveIn(stage))
  return { ...out, peak: Math.min(out.peak, CLIP_DBU), noise: sumNoiseToDb([out.noise, LINE_NOISE_DBU]) }
}

/**
 * The marks leave where the card sends each reading: what leaves it, its louder side (`curveOut`);
 * the noise where the curve sends it — what you hear when the music stops, the gain settled on it.
 */
export function expectMarksLeave(result: GraphSignalResult, id: string, curve: Transfer) {
  const out = leaving(result, id)
  expectSide(curveOut(result.stages[id]), [out.peak, out.rms, out.noise])
  expectDb(curveOut(result.stages[id]).noise, marksOf(result.stages[id], curve).noise)
}
