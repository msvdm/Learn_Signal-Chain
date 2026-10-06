import type { SignalNode, SignalEdge } from '../data/nodeRegistry'
import { NODE_REGISTRY } from '../data/nodeRegistry'
import type { SideLevels, SignalDomain, SignalHealth } from './levels'
import { SILENT, louder } from './levels'
import type { StageCondition } from './process'
import { withOwnHiss } from './process'
import type { CardPlan, ChainLevels, StageRole, WireSignal } from './chain'
import { contextOf, healthOf, humOf, planChain, runChain } from './chain'
import type { MeasuredChain } from './measured'
import { withMeasured } from './measured'
import { sameShape } from '../utils/sameShape'

// The levels at every card and on every wire — per side, the peaks, the average and the noise —
// shared by every card (graphSignal): the number engine's picture (stillPicture, worked out at once
// on every change of the graph), with the readings of the last render on real sound put in
// (signal/measured.ts, decision D9). Pure — no React, no store.

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
   * What leaves it (with `curveIn`): the louder side's peaks and average over a loop, its noise when
   * the music stops — where the marks sit, bottom to top. Measured on real sound (until the first
   * render: through the curve); a peak above the curve got through before the Attack turned it down.
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

/** The number engine's picture of a graph: the plan, the levels it gives, and what the cards show from them. */
export interface StillPicture {
  plans: CardPlan[]
  levels: ChainLevels
  result: GraphSignalResult
}

// Every node card, port and edge reads the graph result. The store replaces the nodes / edges
// arrays on every change, so a single-entry cache keyed on those references lets all callers reuse
// one computation per change.
let lastStill: { nodes: SignalNode[]; edges: SignalEdge[]; still: StillPicture } | null = null
let lastShown: { still: GraphSignalResult; measured: MeasuredChain | null; result: GraphSignalResult } | null = null

/** The number engine's picture (computed once per change of the graph). */
export function stillPicture(nodes: SignalNode[], edges: SignalEdge[]): StillPicture {
  if (lastStill && lastStill.nodes === nodes && lastStill.edges === edges) return lastStill.still
  const plans  = planChain(nodes, edges)
  const levels = runChain(plans)
  const still  = { plans, levels, result: pictureOf(plans, levels) }
  lastStill = { nodes, edges, still }
  return still
}

/**
 * The signal at every card and on every wire: the number engine's, the last render's readings put
 * in (`measured`). A card's stage and a wire's signal that came out the same as last time are last
 * time's objects, so a card that reads only its own (useStage) is redrawn only when its own result
 * changed.
 */
export function graphSignal(nodes: SignalNode[], edges: SignalEdge[], measured: MeasuredChain | null = null): GraphSignalResult {
  const still = stillPicture(nodes, edges).result
  if (lastShown && lastShown.still === still && lastShown.measured === measured) return lastShown.result
  const fresh  = withMeasured(still, measured)
  const result = lastShown ? keepUnchanged(fresh, lastShown.result) : fresh
  lastShown = { still, measured, result }
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
// ── The number engine's picture ─────────────────────────────────────────────────

/** A dynamics card at work (Compressor, Noise Gate, Limiter, De-esser — not bypassed). */
const atWork = (node: SignalNode) => Boolean(NODE_REGISTRY[node.typeKey].linked) && !node.bypassed

function pictureOf(plans: CardPlan[], levels: ChainLevels): GraphSignalResult {
  const { cards, wires } = levels
  const stages: Record<string, StageResult> = {}
  const hums   = new Map<string, number>()

  for (const card of plans) {
    const { node } = card
    const at = cards.get(node.id)!
    // The dynamics run linked: one curve for both sides, driven by the louder one
    const curveIn = atWork(node)
      ? withOwnHiss(node, louder(at.in.l, at.in.r), contextOf(card, at.inDomain, at.mixedDomains, null))
      : undefined
    const hum = humOf(at.out)

    stages[node.id] = {
      in: at.in,
      out: at.out,
      // Judged in the domain the signal leaves in
      health: healthOf(at.out, at.domain),
      domain: at.domain,
      inDomain: at.inDomain,
      gainReductionDb: at.gainReductionDb,
      ...(curveIn ? { curveIn, curveOut: louder(at.out.l, at.out.r) } : {}),
      condition: at.condition,
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
