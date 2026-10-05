import type { SignalEdge, SignalNode } from '../data/nodeRegistry'
import { param } from '../data/nodeRegistry'
import type { ChainLevels, DynamicsGain, Moment, WireSignal } from './engine'
import { planChain, runChain } from './engine'
import type { SideLevels } from './levels'
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

/** What a dynamics card hears: its louder side, the music and the noise together (as powers). */
const heard = (sides: SideLevels[]) => Math.max(...sides.map((s) => sumNoiseToDb([s.rms, s.noise])))

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
  const level = heard(sides)
  switch (node.typeKey) {
    case 'noise-gate': {
      // Open while the threshold is reached, and for Hold after; opening takes Attack, closing Release
      const above = level >= param(node, 'thresholdDb')
      if (above) state.holdLeftMs = param(node, 'holdMs')
      state.open = above || state.holdLeftMs > 0
      if (!above) state.holdLeftMs = Math.max(0, state.holdLeftMs - TICK_MS)
      follow(state, state.open ? 0 : -param(node, 'rangeDb'), param(node, 'releaseMs'), param(node, 'attackMs'))
      return { gainDb: -state.reductionDb, gainReductionDb: state.reductionDb }
    }
    case 'limiter': {
      // Watches the peaks: none gets past the ceiling, not even for a millisecond
      const peak   = Math.max(...sides.map((s) => Math.max(s.peak, s.noise)))
      const target = Math.max(0, peak - param(node, 'thresholdDb'))
      follow(state, target, 0, LIMITER_RELEASE_MS)
      return { gainDb: param(node, 'makeupGainDb') - state.reductionDb, gainReductionDb: state.reductionDb }
    }
    case 'deesser': {
      follow(state, deesser(param(node, 'thresholdDb'))(level).gainReductionDb, DEESSER_ATTACK_MS, DEESSER_RELEASE_MS)
      return { gainDb: -state.reductionDb, gainReductionDb: state.reductionDb }
    }
    default: {
      const curve = compressor(param(node, 'thresholdDb'), param(node, 'ratio'), 0)
      follow(state, curve(level).gainReductionDb, param(node, 'attackMs'), param(node, 'releaseMs'))
      return { gainDb: param(node, 'makeupGainDb') - state.reductionDb, gainReductionDb: state.reductionDb }
    }
  }
}

export interface TimeOptions {
  /** false: the music is silent and only the noise plays — what you hear when the music stops */
  music?: boolean
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

/** The chain starts playing: every source at the start of its loop, the dynamics at rest. */
export function startTime(nodes: SignalNode[], edges: SignalEdge[], options: TimeOptions = {}): TimeRun {
  const music  = options.music ?? true
  const states = new Map<string, DynamicsState>()
  let plans = planChain(nodes, edges)
  let t = 0

  const moment: Moment = {
    play: (node, levels) => {
      if (!music) return { ...levels, peak: -Infinity, rms: -Infinity }
      const loop = loopOf(soundKindOf(node))
      const i    = t % LOOP_MS
      // Nothing leaves a source above the clip level, not even for a moment
      return { ...levels, rms: Math.min(levels.rms + loop.rms[i], CLIP_DBU), peak: Math.min(levels.rms + loop.peak[i], CLIP_DBU) }
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
      const levels = runChain(plans, moment)
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

// ── Measured over time ───────────────────────────────────────────────────────

/** Adds up one side over time: the loudest peak, and the average, noise and hum as powers. */
class SideMeter {
  private peak = -Infinity
  private rms = 0
  private noise = 0
  private hum = 0
  private ticks = 0
  private quietTicks = 0

  music(s: SideLevels) {
    this.peak = Math.max(this.peak, s.peak)
    this.rms += Math.pow(10, s.rms / 10)
    this.ticks++
  }

  quiet(s: SideLevels) {
    this.noise += Math.pow(10, s.noise / 10)
    this.hum += Math.pow(10, s.hum / 10)
    this.quietTicks++
  }

  read(): SideLevels {
    const db = (power: number, n: number) => (power > 0 ? 10 * Math.log10(power / n) : -Infinity)
    return { peak: this.peak, rms: db(this.rms, this.ticks), noise: db(this.noise, this.quietTicks), hum: db(this.hum, this.quietTicks) }
  }
}

export interface MeasureOptions {
  /** Played first, not measured: the dynamics settle (default: one loop) */
  warmupMs?: number
  /** Measured (default: one loop — every sound once) */
  ms?: number
}

/**
 * What leaves each card, measured over time, keyed by node id: the loudest peak, the average, and
 * the noise and hum when the music stops (a second run with the music silent, as the still picture
 * means its noise reading). Over whole loops this is the still picture's reading (time.test.ts).
 */
export function measureChain(nodes: SignalNode[], edges: SignalEdge[], options: MeasureOptions = {}): Map<string, WireSignal> {
  const warmupMs = options.warmupMs ?? LOOP_MS
  const ms       = options.ms ?? LOOP_MS
  const playing  = startTime(nodes, edges)
  const quiet    = startTime(nodes, edges, { music: false })
  const meters   = new Map<string, { kind: WireSignal['kind']; l: SideMeter; r: SideMeter }>()

  for (let i = 0; i < warmupMs; i += TICK_MS) {
    playing.tick()
    quiet.tick()
  }
  for (let i = 0; i < ms; i += TICK_MS) {
    const now   = playing.tick()
    const still = quiet.tick()
    for (const [id, card] of now.cards) {
      let meter = meters.get(id)
      if (!meter) meters.set(id, meter = { kind: card.out.kind, l: new SideMeter(), r: new SideMeter() })
      meter.l.music(card.out.l)
      meter.r.music(card.out.r)
      const silent = still.cards.get(id)
      if (silent) {
        meter.l.quiet(silent.out.l)
        meter.r.quiet(silent.out.r)
      }
    }
  }

  const measured = new Map<string, WireSignal>()
  for (const [id, meter] of meters) measured.set(id, { kind: meter.kind, l: meter.l.read(), r: meter.r.read() })
  return measured
}
