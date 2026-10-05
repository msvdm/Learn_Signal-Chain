import type { SignalEdge, SignalNode } from '../data/nodeRegistry'
import { NODE_REGISTRY, param } from '../data/nodeRegistry'
import type { CardPlan, ChainLevels, DynamicsGain, GivenLevels, Moment, WireSignal } from './chain'
import { planChain, runChain } from './chain'
import type { WireKind } from '../graph/queries'
import type { SideLevels, SignalDomain } from './levels'
import { CLIP_DBU, sumNoiseToDb } from './levels'
import { compressor, deesser } from './process'
import { LOOP_MS, loopOf, soundKindOf } from './sounds'

// The time engine (Step B): the chain of the still picture (signal/engine.ts — the same plan, the
// same maths for every card) run one millisecond at a time. Every source plays its sound
// (signal/sounds.ts), and the dynamics react over time instead of at once: a compressor's Attack
// and Release, a gate's Attack, Hold and Release. Over a loop, what leaves each card has the
// still picture's peaks, average and noise (time.test.ts). Pure: no drawing, no clock of its own —
// whoever runs it decides when the next millisecond comes.

/** One step: a millisecond. */
export const TICK_MS = 1

/** A limiter catches a peak at once and lets go over this long (it has no time knobs). */
export const LIMITER_RELEASE_MS = 50
/** The De-esser has no time knobs either: it acts and lets go like a quick compressor. */
export const DEESSER_ATTACK_MS = 1
export const DEESSER_RELEASE_MS = 50

/** What a dynamics card is doing, carried from one millisecond to the next. */
export interface DynamicsState {
  /** How far it turns the signal down right now (dB, 0 or more) */
  reductionDb: number
  /** A noise gate: open right now — its threshold reached, or still holding */
  open: boolean
  /** A noise gate: how much longer it holds open (ms) */
  holdLeftMs: number
}

/** The share of the way to its target a setting moves in one millisecond, taking about `ms` (0: at once). */
const shareOf = (ms: number) => (ms <= 0 ? 1 : 1 - Math.exp(-TICK_MS / ms))

/** The level a compressor or de-esser hears: its louder side, the music and the noise together (as powers). */
const heard = (sides: SideLevels[]) => Math.max(...sides.map((s) => sumNoiseToDb([s.rms, s.noise])))

/** The peaks a gate or limiter watches: its louder side's (the noise's when the music is silent). */
const peaksOf = (sides: SideLevels[]) => Math.max(...sides.map((s) => Math.max(s.peak, s.noise)))

/** Moves the reduction toward `targetDb`: turning down further takes `downMs`, letting go `upMs`. */
function follow(state: DynamicsState, targetDb: number, downMs: number, upMs: number) {
  const ms = targetDb > state.reductionDb ? downMs : upMs
  state.reductionDb += (targetDb - state.reductionDb) * shareOf(ms)
}

/** A dynamics card's starting state: turning nothing down — a gate closed. */
function startOf(node: SignalNode): DynamicsState {
  const gate = node.typeKey === 'noise-gate'
  return { reductionDb: gate ? -param(node, 'rangeDb') : 0, open: false, holdLeftMs: 0 }
}

/**
 * One millisecond of a dynamics card: what its level curve (signal/process.ts) asks for at what it
 * hears now, reached over its Attack / Release; one gain for the whole signal (both sides, its
 * peaks, average and noise alike). Fed a steady level it settles on the still picture's curve.
 */
function react(node: SignalNode, sides: SideLevels[], state: DynamicsState): DynamicsGain {
  switch (node.typeKey) {
    case 'noise-gate': {
      // Open while its peaks reach the threshold (the start of a note opens it at once), and for
      // Hold after; opening takes Attack, closing Release
      const above = peaksOf(sides) >= param(node, 'thresholdDb')
      if (above) state.holdLeftMs = param(node, 'holdMs')
      state.open = above || state.holdLeftMs > 0
      if (!above) state.holdLeftMs = Math.max(0, state.holdLeftMs - TICK_MS)
      follow(state, state.open ? 0 : -param(node, 'rangeDb'), param(node, 'releaseMs'), param(node, 'attackMs'))
      return { gainDb: -state.reductionDb, gainReductionDb: state.reductionDb }
    }
    case 'limiter': {
      // Watches the peaks: none gets past the ceiling, not even for a millisecond
      const target = Math.max(0, peaksOf(sides) - param(node, 'thresholdDb'))
      follow(state, target, 0, LIMITER_RELEASE_MS)
      return { gainDb: param(node, 'makeupGainDb') - state.reductionDb, gainReductionDb: state.reductionDb }
    }
    case 'deesser': {
      follow(state, deesser(param(node, 'thresholdDb'))(heard(sides)).gainReductionDb, DEESSER_ATTACK_MS, DEESSER_RELEASE_MS)
      return { gainDb: -state.reductionDb, gainReductionDb: state.reductionDb }
    }
    default: {
      const curve = compressor(param(node, 'thresholdDb'), param(node, 'ratio'), 0)
      follow(state, curve(heard(sides)).gainReductionDb, param(node, 'attackMs'), param(node, 'releaseMs'))
      return { gainDb: param(node, 'makeupGainDb') - state.reductionDb, gainReductionDb: state.reductionDb }
    }
  }
}

export interface TimeOptions {
  /** false: the music is silent and only the noise plays — what you hear when the music stops */
  music?: boolean
  /** Where in their loop the sources start (ms; default 0, the first beat) */
  startMs?: number
  /** Cards left out of the run: what they send at each millisecond since it started */
  given?: (t: number) => GivenLevels
}

/** A chain playing, one millisecond at a time. */
export interface TimeRun {
  /** Milliseconds since it started */
  readonly t: number
  /** One millisecond on: every source plays on, every card does its job. The levels of that millisecond. */
  tick(): ChainLevels
  /** What a dynamics card is doing right now (none before its first millisecond) */
  dynamicsOf(id: string): Readonly<DynamicsState> | undefined
  /** The chain changed (a knob, a wire, a card): the sound and what the dynamics are doing carry on. */
  update(nodes: SignalNode[], edges: SignalEdge[]): void
}

/** The chain starts playing: every source at the start of its loop (or `startMs` into it), the dynamics at rest. */
export function startTime(nodes: SignalNode[], edges: SignalEdge[], options: TimeOptions = {}): TimeRun {
  return playing(planChain(nodes, edges), options)
}

/** Planned cards playing. */
function playing(firstPlans: CardPlan[], options: TimeOptions): TimeRun {
  const music  = options.music ?? true
  const startMs = options.startMs ?? 0
  const states = new Map<string, DynamicsState>()
  let plans = firstPlans
  let t = 0

  const moment: Moment = {
    play: (node, levels) => {
      if (!music) return { peak: -Infinity, rms: -Infinity, noise: levels.noise, hum: levels.hum }
      const loop = loopOf(soundKindOf(node))
      const i    = (startMs + t) % LOOP_MS
      // Nothing leaves a source above the clip level, not even for a moment
      return {
        peak:  Math.min(levels.rms + loop.peak[i], CLIP_DBU),
        rms:   Math.min(levels.rms + loop.rms[i], CLIP_DBU),
        noise: levels.noise,
        hum:   levels.hum,
      }
    },
    dynamics: (card, sides) => {
      let state = states.get(card.node.id)
      if (!state) states.set(card.node.id, state = startOf(card.node))
      return react(card.node, sides, state)
    },
  }

  return {
    get t() { return t },
    tick() {
      const levels = runChain(plans, moment, options.given?.(t))
      t += TICK_MS
      return levels
    },
    dynamicsOf: (id) => states.get(id),
    update(newNodes, newEdges) {
      plans = planChain(newNodes, newEdges)
      const ids = new Set(newNodes.map((n) => n.id))
      for (const id of states.keys()) if (!ids.has(id)) states.delete(id)
    },
  }
}

// ── Measured over a loop ─────────────────────────────────────────────────────

/** How long a dynamics card takes to forget where it started (ms): seven times its slowest time, and a gate's Hold. */
function settleOf(node: SignalNode): number {
  switch (node.typeKey) {
    case 'comp':       return 7 * Math.max(param(node, 'attackMs'), param(node, 'releaseMs'))
    case 'noise-gate': return param(node, 'holdMs') + 7 * Math.max(param(node, 'attackMs'), param(node, 'releaseMs'))
    case 'limiter':    return 7 * LIMITER_RELEASE_MS
    case 'deesser':    return 7 * Math.max(DEESSER_ATTACK_MS, DEESSER_RELEASE_MS)
    default:           return 0
  }
}

/**
 * Played before a loop is measured, so every dynamics card has settled into it (ms): the dynamics
 * one after another along a chain add up, side by side they do not; at most three loops.
 */
export function settleMsOf(plans: CardPlan[]): number {
  const settled = new Map<string, number>()
  let longest = 0
  for (const card of plans) {
    const before = Math.max(0, ...card.used.map((u) => settled.get(u.from.split(':')[0]) ?? 0))
    const own    = NODE_REGISTRY[card.node.typeKey].linked && !card.node.bypassed ? settleOf(card.node) : 0
    settled.set(card.node.id, before + own)
    longest = Math.max(longest, before + own)
  }
  return Math.min(3 * LOOP_MS, longest)
}

/** One side of the music over a loop: its loudest peak, its average (a power mean). */
export interface MusicLevels {
  peak: number
  rms: number
}

export interface MusicSides {
  l: MusicLevels
  r: MusicLevels
}

/** Adds up the music of a signal (both sides) over time. */
class MusicMeter {
  private peak = { l: -Infinity, r: -Infinity }
  private power = { l: 0, r: 0 }
  private ticks = 0

  add(w: WireSignal) {
    this.peak.l = Math.max(this.peak.l, w.l.peak)
    this.peak.r = Math.max(this.peak.r, w.r.peak)
    this.power.l += Math.pow(10, w.l.rms / 10)
    this.power.r += Math.pow(10, w.r.rms / 10)
    this.ticks++
  }

  read(): MusicSides {
    const db = (power: number) => (power > 0 ? 10 * Math.log10(power / this.ticks) : -Infinity)
    return { l: { peak: this.peak.l, rms: db(this.power.l) }, r: { peak: this.peak.r, rms: db(this.power.r) } }
  }
}

/** The music over one loop: what arrives at and leaves each card measured, and what each of its outputs sends. */
export interface MeasuredMusic {
  cards: Map<string, { in: MusicSides; out: MusicSides }>
  wires: Map<string, MusicSides>
}

/** One output's levels, millisecond by millisecond: peak, average, noise, hum — one side, or left then right. */
interface WireSeries {
  kind: WireKind
  values: Float32Array
}

const strideOf = (kind: WireKind) => (kind === 'mono' ? 4 : 8)

function writeSeries(series: WireSeries, t: number, w: WireSignal) {
  const at = t * strideOf(series.kind)
  const v  = series.values
  v[at] = w.l.peak; v[at + 1] = w.l.rms; v[at + 2] = w.l.noise; v[at + 3] = w.l.hum
  if (series.kind !== 'mono') { v[at + 4] = w.r.peak; v[at + 5] = w.r.rms; v[at + 6] = w.r.noise; v[at + 7] = w.r.hum }
}

function readSeries(series: WireSeries, t: number): WireSignal {
  const at = t * strideOf(series.kind)
  const v  = series.values
  const l  = { peak: v[at], rms: v[at + 1], noise: v[at + 2], hum: v[at + 3] }
  const r  = series.kind === 'mono' ? l : { peak: v[at + 4], rms: v[at + 5], noise: v[at + 6], hum: v[at + 7] }
  return { kind: series.kind, l, r }
}

/**
 * A measurement, kept for the next one: what every card it played sent, millisecond by
 * millisecond, so a change plays again only the cards it reaches.
 */
export interface MusicTake {
  music: MeasuredMusic
  /** What each card's sound depended on */
  keys: Map<string, unknown[]>
  settleMs: number
  series: Map<string, WireSeries>
  domains: Map<string, SignalDomain>
}

/** What a card's sound depends on — not where it sits on the canvas (its params are replaced, never changed in place). */
function soundKeyOf(p: CardPlan): unknown[] {
  return [
    p.node.typeKey, p.node.params, p.node.bypassed, p.mode, p.followKind, p.fed, p.preamp, p.plays, p.amped,
    p.groundLoop, ...p.used.flatMap((u) => [u.from, u.sendDb]), ...p.outputs.flatMap((o) => [o.key, o.kind, o.direct]),
  ]
}

const sameKey = (a: unknown[] | undefined, b: unknown[]) =>
  a !== undefined && a.length === b.length && a.every((x, i) => Object.is(x, b[i]))

/** The card an output key (`${nodeId}:${portId}`) belongs to. */
export const cardOfKey = (key: string) => key.slice(0, key.lastIndexOf(':'))

/** The cards `ids` hear: themselves and every card before them, in signal order. */
function coneOf(plans: CardPlan[], ids: ReadonlySet<string>): CardPlan[] {
  const needed = new Set(ids)
  for (let i = plans.length - 1; i >= 0; i--) {
    if (needed.has(plans[i].node.id)) for (const u of plans[i].used) needed.add(cardOfKey(u.from))
  }
  return plans.filter((p) => needed.has(p.node.id))
}

/**
 * The music over one loop (the first beat to the last), once the dynamics have settled (played
 * from just before the loop starts — settleMsOf): for the cards in `ids`, the loudest peak and the
 * average of what arrives and leaves, and of what each of their outputs sends. The still picture
 * (engine.ts) takes its readings after a dynamics card from here.
 *
 * Given the last take, only the cards a change reaches play again — a changed card and every card
 * after it; what reaches them from the others is played back from the take. Cards the measured
 * ones do not hear are not played at all.
 */
export function measureMusic(plans: CardPlan[], ids: ReadonlySet<string>, before?: MusicTake): MusicTake {
  const cone     = coneOf(plans, ids)
  const settleMs = settleMsOf(cone)
  const totalMs  = settleMs + LOOP_MS
  const keys     = new Map(cone.map((p) => [p.node.id, soundKeyOf(p)]))
  const last     = before && before.settleMs === settleMs ? before : undefined

  // What plays again: what changed, and everything after it
  const again = new Set<string>()
  for (const card of cone) {
    const id = card.node.id
    if (!last || !sameKey(last.keys.get(id), keys.get(id)!) || card.used.some((u) => again.has(cardOfKey(u.from)))) again.add(id)
  }
  if (last && again.size === 0) return last

  const playingNow = cone.filter((p) => again.has(p.node.id))
  const kept       = [...new Set(playingNow.flatMap((p) => p.used.map((u) => u.from)))].filter((key) => !again.has(cardOfKey(key)))
  const given = last
    ? (t: number): GivenLevels => ({
        wires: new Map(kept.map((key) => [key, readSeries(last.series.get(key)!, t)])),
        domains: last.domains,
      })
    : undefined
  const run = playing(playingNow, { startMs: (LOOP_MS - (settleMs % LOOP_MS)) % LOOP_MS, given })

  const series  = new Map(last?.series ?? [])
  const domains = new Map(last?.domains ?? [])
  const fresh   = playingNow.flatMap((p) => p.outputs.map((o) => {
    const s = { kind: o.kind, values: new Float32Array(totalMs * strideOf(o.kind)) }
    series.set(o.key, s)
    return { key: o.key, series: s }
  }))
  const cardMeters = playingNow.filter((p) => ids.has(p.node.id)).map((p) => ({ id: p.node.id, in: new MusicMeter(), out: new MusicMeter() }))
  const wireMeters = playingNow.filter((p) => ids.has(p.node.id)).flatMap((p) => p.outputs.map((o) => ({ key: o.key, meter: new MusicMeter() })))

  for (let t = 0; t < totalMs; t += TICK_MS) {
    const now = run.tick()
    for (const f of fresh) writeSeries(f.series, t, now.wires.get(f.key)!)
    if (t === 0) for (const [id, card] of now.cards) domains.set(id, card.domain)
    if (t < settleMs) continue
    for (const m of cardMeters) {
      const card = now.cards.get(m.id)!
      m.in.add(card.in)
      m.out.add(card.out)
    }
    for (const w of wireMeters) w.meter.add(now.wires.get(w.key)!)
  }

  // Only what the measured cards hear is kept
  for (const key of series.keys()) if (!keys.has(cardOfKey(key))) series.delete(key)

  // The measured cards that did not play again keep their readings
  const cards = new Map<string, { in: MusicSides; out: MusicSides }>()
  const wires = new Map<string, MusicSides>()
  for (const id of ids) {
    const previous = last?.music.cards.get(id)
    if (!again.has(id) && previous) cards.set(id, previous)
  }
  for (const [key, music] of last?.music.wires ?? []) if (ids.has(cardOfKey(key)) && !again.has(cardOfKey(key))) wires.set(key, music)
  for (const m of cardMeters) cards.set(m.id, { in: m.in.read(), out: m.out.read() })
  for (const w of wireMeters) wires.set(w.key, w.meter.read())
  return { music: { cards, wires }, keys, settleMs, series, domains }
}

/**
 * What leaves each card, measured over time, keyed by node id: the loudest peak and the average
 * over a loop (measureMusic), and the noise and hum when the music stops (a run with the music
 * silent, settled). Over whole loops this is the still picture's reading (time.test.ts).
 */
export function measureChain(nodes: SignalNode[], edges: SignalEdge[]): Map<string, WireSignal> {
  const plans = planChain(nodes, edges)
  const { music } = measureMusic(plans, new Set(plans.map((p) => p.node.id)))

  // What you hear when the music stops: the noise, once the dynamics have settled on it
  const quiet = playing(plans, { music: false })
  for (let i = 0; i < settleMsOf(plans) + LOOP_MS; i += TICK_MS) quiet.tick()
  const still = quiet.tick()

  const measured = new Map<string, WireSignal>()
  for (const [id, card] of still.cards) {
    const { out } = music.cards.get(id)!
    measured.set(id, {
      kind: card.out.kind,
      l: { ...card.out.l, peak: out.l.peak, rms: out.l.rms },
      r: { ...card.out.r, peak: out.r.peak, rms: out.r.rms },
    })
  }
  return measured
}
