import type { SignalNode, SignalEdge } from '../data/nodeRegistry'
import { NODE_REGISTRY, param } from '../data/nodeRegistry'
import type { SideLevels, SignalDomain, SignalHealth } from './levels'
import { SILENT, louder } from './levels'
import type { StageCondition } from './process'
import { withOwnHiss } from './process'
import type { CardPlan, StageRole, WireSignal } from './chain'
import { contextOf, healthOf, humOf, levelOf, planChain, runChain } from './chain'
import type { MeasuredMusic, MusicSides, MusicTake } from './time'
import { cardOfKey, measureMusic } from './time'
import { sameShape } from '../utils/sameShape'

// The still picture: the levels at every card and on every wire — per side, the peaks, the average
// and the noise — worked out once per change of the graph and shared by every card (graphSignal).
// Pure — no React, no store.

// What the cards import from here; the walk itself is chain.ts
export type { StageRole, WireSignal } from './chain'
export { SILENT_WIRE, healthOf, humOf, levelOf, peakOf } from './chain'

/** What one card does to the signal. */
export interface StageResult {
  /** What the card works on: both sides when it takes a stereo signal, else one channel (l = r). */
  in: WireSignal
  /** What it sends out: both sides when it works in stereo, else one channel (l = r). */
  out: WireSignal
  /** Health of what leaves, judged in `domain`: clipping when its peaks reach the ceiling, else from its average */
  health: SignalHealth
  /** Analog (dBu) or digital (dBFS), leaving — an ADC / DAC changes it */
  domain: SignalDomain
  /** Analog or digital, arriving */
  inDomain: SignalDomain
  /** How far a dynamics card turns the signal (its average) down: over a loop, makeup gain left out */
  gainReductionDb?: number
  /**
   * What a dynamics card's level curve works on (Compressor, Noise Gate, Limiter, De-esser; none
   * when bypassed): the louder side's peaks, average and noise, its own hiss included — where the
   * marks on the card's curve sit, left to right.
   */
  curveIn?: SideLevels
  /**
   * What leaves it (with `curveIn`): the louder side's peaks and average measured over a loop, its
   * noise when the music stops — where the marks sit, bottom to top. A peak above the curve got
   * through before the Attack turned it down.
   */
  curveOut?: SideLevels
  condition?: StageCondition
  role?: StageRole
  /**
   * The level of the hum leaving it (dBu, dBFS after an ADC): a ground loop through a DI Box (its
   * Direct Out on a Guitar Amp, its XLR Out on the desk, Ground Lift off) starts one at HUM_DBU on
   * the XLR Out. It is part of the noise and follows the signal to the end of the chain — a fader
   * turns it down with the music; only Ground Lift takes it away. Undefined: no hum.
   */
  hum?: number
}

/** What a dynamics card's curve works on (`curveIn`); bypassed, what arrives — its louder side. */
export function curveInputOf(stage: StageResult | undefined): SideLevels {
  if (!stage) return SILENT
  return stage.curveIn ?? louder(stage.in.l, stage.in.r)
}

export interface GraphSignalResult {
  /** Keyed by node id. Cards in a loop (and after one) have none. */
  stages: Record<string, StageResult>
  /** What each output sends, keyed `${nodeId}:${portId}`. */
  wires: Map<string, WireSignal>
  /** The hum on each output that carries one (its level), keyed like `wires`. */
  hums: Map<string, number>
}

// Every node card, port and edge reads the graph result. The store replaces the
// nodes/edges arrays on every change, so one shared single-entry cache keyed on
// those references lets all callers reuse a single computation per change.
let lastGraph: { nodes: SignalNode[]; edges: SignalEdge[]; result: GraphSignalResult } | null = null

/**
 * The signal at every card and on every wire (computed once per change of the graph). A card's
 * stage and a wire's signal that came out the same as last time are last time's objects, so a
 * card that reads only its own (useStage) is redrawn only when its own result changed.
 */
export function graphSignal(nodes: SignalNode[], edges: SignalEdge[]): GraphSignalResult {
  if (lastGraph && lastGraph.nodes === nodes && lastGraph.edges === edges) return lastGraph.result
  const fresh  = computeGraphSignal(nodes, edges)
  const result = lastGraph ? keepUnchanged(fresh, lastGraph.result) : fresh
  lastGraph = { nodes, edges, result }
  return result
}

/** `fresh`, with every stage, wire and hum that equals the one in `before` replaced by that one. */
function keepUnchanged(fresh: GraphSignalResult, before: GraphSignalResult): GraphSignalResult {
  let allSame = Object.keys(fresh.stages).length === Object.keys(before.stages).length
  const stages: Record<string, StageResult> = {}
  for (const [id, stage] of Object.entries(fresh.stages)) {
    const old = before.stages[id]
    const same = old !== undefined && sameShape(old, stage)
    stages[id] = same ? old : stage
    allSame &&= same
  }

  const wires = new Map<string, WireSignal>()
  let wiresSame = fresh.wires.size === before.wires.size
  for (const [key, wire] of fresh.wires) {
    const old = before.wires.get(key)
    const same = old !== undefined && sameShape(old, wire)
    wires.set(key, same ? old : wire)
    wiresSame &&= same
  }

  const humsSame = sameShape(Object.fromEntries(fresh.hums), Object.fromEntries(before.hums))
  return {
    stages: allSame ? before.stages : stages,
    wires:  wiresSame ? before.wires : wires,
    hums:   humsSame ? before.hums : fresh.hums,
  }
}
// ── The still picture ─────────────────────────────────────────────────────────

/** A dynamics card at work (Compressor, Noise Gate, Limiter, De-esser — not bypassed): it reacts over time. */
const reactsOverTime = (node: SignalNode) => Boolean(NODE_REGISTRY[node.typeKey].linked) && !node.bypassed

/**
 * The cards whose readings come from the moving picture (decision D6): every dynamics card at work
 * and every card after one. A real one gives one gain to the whole moment, over its Attack and
 * Release, which no level curve can tell from the readings alone. Before them, and on chains
 * without one, the two pictures agree exactly (time.test.ts), so nothing needs playing.
 */
function afterDynamics(plans: CardPlan[]): Set<string> {
  const ids = new Set<string>()
  for (const card of plans) {
    if (reactsOverTime(card.node) || card.used.some((u) => ids.has(cardOfKey(u.from)))) ids.add(card.node.id)
  }
  return ids
}

/** The last measurement: a change plays again only what it reaches; a card dragged across the canvas, nothing. */
let lastTake: MusicTake | undefined

function musicOf(plans: CardPlan[], ids: Set<string>): MeasuredMusic {
  lastTake = measureMusic(plans, ids, lastTake)
  return lastTake.music
}

/** `still` with the peaks and the average measured over time (the noise stays: the two pictures agree on it). */
function withMusic(still: WireSignal, music: MusicSides | undefined): WireSignal {
  if (!music) return still
  return {
    kind: still.kind,
    l: { ...still.l, peak: music.l.peak, rms: music.l.rms },
    r: { ...still.r, peak: music.r.peak, rms: music.r.rms },
  }
}

/** A dynamics card's makeup gain: it lifts everything after turning it down. */
const makeupOf = (node: SignalNode) =>
  node.typeKey === 'comp' || node.typeKey === 'limiter' ? param(node, 'makeupGainDb') : 0

function computeGraphSignal(nodes: SignalNode[], edges: SignalEdge[]): GraphSignalResult {
  const plans = planChain(nodes, edges)
  const { cards, wires } = runChain(plans)
  // After a dynamics card at work, the peaks and the average come from the moving picture (D6)
  const moving = afterDynamics(plans)
  const music  = moving.size > 0 ? musicOf(plans, moving) : null
  const stages: Record<string, StageResult> = {}
  const hums   = new Map<string, number>()

  for (const card of plans) {
    const { node } = card
    const levels   = cards.get(node.id)!
    const measured = music?.cards.get(node.id)
    // What arrives is measured too when it comes from a measured card
    const inSig  = card.used.some((u) => moving.has(cardOfKey(u.from))) ? withMusic(levels.in, measured?.in) : levels.in
    const outSig = withMusic(levels.out, measured?.out)
    for (const o of card.outputs) {
      const sent = music?.wires.get(o.key)
      if (sent) wires.set(o.key, withMusic(wires.get(o.key)!, sent))
    }

    // The dynamics run linked: one curve for both sides, driven by the louder one. What leaves it,
    // measured over time, places the marks on the card's curve.
    const curveIn = reactsOverTime(node)
      ? withOwnHiss(node, louder(levels.in.l, levels.in.r), contextOf(card, levels.inDomain, levels.mixedDomains, null))
      : undefined
    const curveOut = curveIn ? louder(outSig.l, outSig.r) : undefined
    // How far it turns the average down, over the loop
    const gainReductionDb = curveIn && measured
      ? Math.max(0, levelOf(inSig) + makeupOf(node) - levelOf(outSig))
      : levels.gainReductionDb
    const hum = humOf(outSig)

    stages[node.id] = {
      in: inSig,
      out: outSig,
      // Judged in the domain the signal leaves in
      health: healthOf(outSig, levels.domain),
      domain: levels.domain,
      inDomain: levels.inDomain,
      gainReductionDb,
      ...(curveIn ? { curveIn, curveOut } : {}),
      condition: levels.condition,
      role: card.role,
      ...(isFinite(hum) ? { hum } : {}),
    }
    for (const o of card.outputs) {
      const h = humOf(wires.get(o.key))
      if (isFinite(h)) hums.set(o.key, h)
    }
  }

  return { stages, wires, hums }
}
