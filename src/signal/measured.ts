import type { SideLevels } from './levels'
import { ceilingOf, eachReading, louder } from './levels'
import type { WireSignal } from './chain'
import { healthOf, humOf } from './chain'
import type { GraphSignalResult, StageResult } from './engine'

// The readings of real sound (decision D9): a render of the chain (audio/measure.ts) measures what
// arrives at and leaves every card — the peaks, the average, the noise when the music stops, the
// hum. It takes a moment, so between renders the number engine (engine.ts) says how far the chain
// has moved since the last one: a knob turned shows at once, by the number engine's step, and the
// next render puts the exact reading in. Pure — no React, no store.

/** What a render measured at one card. */
export interface MeasuredStage {
  in: WireSignal
  out: WireSignal
  /** A dynamics card at work: how far it turned the average down over the loop (its makeup left out) */
  gainReductionDb?: number
  /** A dynamics card at work: what its curve worked on (the louder side, its own hiss in) */
  curveIn?: SideLevels
}

/** A render's readings, and the number engine's picture of the chain it rendered. */
export interface MeasuredChain {
  /** The number engine's result for the chain as it was rendered */
  at: GraphSignalResult
  stages: Map<string, MeasuredStage>
  wires: Map<string, WireSignal>
}

/**
 * A reading measured, moved on by what the number engine says changed since (`now` − `at`). Where
 * either has silence the number engine's reading stands: there is nothing to move from.
 */
function movedOn(now: number, at: number, measured: number): number {
  return isFinite(now) && isFinite(at) && isFinite(measured) ? measured + (now - at) : now
}

/** A whole signal moved on; the peaks kept between the average and the ceiling (`ceilingDb`). */
function signalMovedOn(now: WireSignal, at: WireSignal | undefined, measured: WireSignal | undefined, ceilingDb: number): WireSignal {
  if (!at || !measured || at.kind !== now.kind || measured.kind !== now.kind) return now
  const side = (n: SideLevels, a: SideLevels, m: SideLevels): SideLevels => {
    const s = eachReading((k) => movedOn(n[k], a[k], m[k]))
    return { ...s, peak: isFinite(s.peak) ? Math.max(s.rms, Math.min(s.peak, ceilingDb)) : s.peak }
  }
  const l = side(now.l, at.l, measured.l)
  return { kind: now.kind, l, r: now.kind === 'mono' ? l : side(now.r, at.r, measured.r) }
}

/** The number engine's picture (`now`) with the readings of the last render put in. */
export function withMeasured(now: GraphSignalResult, measured: MeasuredChain | null): GraphSignalResult {
  if (!measured) return now
  const stages: Record<string, StageResult> = {}
  for (const [id, stage] of Object.entries(now.stages)) {
    const m  = measured.stages.get(id)
    const at = measured.at.stages[id]
    // An active speaker fed an amplifier is blown: its readings are not the sound's
    if (!m || !at || stage.condition === 'blown') {
      stages[id] = stage
      continue
    }
    const inSig  = signalMovedOn(stage.in, at.in, m.in, ceilingOf(stage.inDomain))
    const outSig = signalMovedOn(stage.out, at.out, m.out, ceilingOf(stage.domain))
    const curveIn = stage.curveIn && at.curveIn && m.curveIn
      ? eachReading((k) => movedOn(stage.curveIn![k], at.curveIn![k], m.curveIn![k]))
      : stage.curveIn
    const reduction = stage.gainReductionDb !== undefined && at.gainReductionDb !== undefined && m.gainReductionDb !== undefined
      ? Math.max(0, movedOn(stage.gainReductionDb, at.gainReductionDb, m.gainReductionDb))
      : stage.gainReductionDb
    const next: StageResult = { ...stage, in: inSig, out: outSig, health: healthOf(outSig, stage.domain), gainReductionDb: reduction }
    if (curveIn) {
      next.curveIn  = curveIn
      next.curveOut = louder(outSig.l, outSig.r)
    }
    const hum = humOf(outSig)
    if (isFinite(hum)) next.hum = hum
    else delete next.hum
    stages[id] = next
  }

  const wires = new Map<string, WireSignal>()
  const hums  = new Map<string, number>()
  for (const [key, wire] of now.wires) {
    const from = stages[key.slice(0, key.lastIndexOf(':'))]
    const sent = signalMovedOn(wire, measured.at.wires.get(key), measured.wires.get(key), ceilingOf(from?.domain ?? 'analog'))
    wires.set(key, sent)
    const h = humOf(sent)
    if (isFinite(h)) hums.set(key, h)
  }
  return { stages, wires, hums }
}
