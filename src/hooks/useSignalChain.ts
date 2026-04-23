import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import type { NodeState } from '../store/signalStore'
import type { Translations } from '../i18n/translations'

export type SignalHealth = 'too-quiet' | 'good' | 'hot' | 'clipping'

export interface StageResult {
  out: number
  health: SignalHealth
}

export interface CompressorResult extends StageResult {
  gainReductionDb: number
}

export interface SignalChainResult {
  mic: StageResult
  preamp: StageResult
  eq: StageResult
  comp: CompressorResult
  fader: StageResult
  master: StageResult
  overallHealth: SignalHealth
  warnings: string[]
}

export function getHealth(db: number): SignalHealth {
  if (db < -40) return 'too-quiet'
  if (db <= -12) return 'good'
  if (db <= 0) return 'hot'
  return 'clipping'
}

function computeMic(state: NodeState): StageResult {
  const out = state.micSensitivityDb
  return { out, health: getHealth(out) }
}

function computePreamp(micOut: number, state: NodeState): StageResult {
  const out = Math.min(micOut + state.preampGainDb, 20)
  return { out, health: getHealth(out) }
}

function computeEQ(preampOut: number, state: NodeState): StageResult {
  const bandSum = state.eqBands.reduce((acc, b) => acc + b.gainDb, 0)
  const out = preampOut + bandSum
  return { out, health: getHealth(out) }
}

function computeCompressor(eqOut: number, state: NodeState): CompressorResult {
  const { compThresholdDb, compRatio, compMakeupGainDb } = state
  let gainReductionDb = 0
  if (eqOut > compThresholdDb) {
    gainReductionDb = (eqOut - compThresholdDb) * (1 - 1 / compRatio)
  }
  const out = eqOut - gainReductionDb + compMakeupGainDb
  return { out, health: getHealth(out), gainReductionDb }
}

function computeFader(compOut: number, state: NodeState): StageResult {
  const out = compOut + state.faderDb
  return { out, health: getHealth(out) }
}

function computeMaster(faderOut: number, state: NodeState): StageResult {
  const out = faderOut + state.masterTrimDb
  return { out, health: getHealth(out) }
}

function worstHealth(healths: SignalHealth[]): SignalHealth {
  if (healths.includes('clipping')) return 'clipping'
  if (healths.includes('hot')) return 'hot'
  if (healths.includes('too-quiet')) return 'too-quiet'
  return 'good'
}

function buildWarnings(
  result: Omit<SignalChainResult, 'overallHealth' | 'warnings'>,
  w: Translations['warnings'],
  fmt: (str: string, params: Record<string, string>) => string
): string[] {
  const warns: string[] = []
  if (result.preamp.health === 'too-quiet') warns.push(w.preampTooQuiet)
  if (result.preamp.health === 'clipping') warns.push(w.preampClipping)
  if (result.eq.health === 'clipping') warns.push(w.eqClipping)
  if (result.comp.gainReductionDb > 10)
    warns.push(fmt(w.heavyCompression, { amount: result.comp.gainReductionDb.toFixed(1) }))
  if (result.master.health === 'clipping') warns.push(w.masterClipping)
  if (result.master.health === 'too-quiet') warns.push(w.masterTooQuiet)
  return warns
}

export function computeSignalChain(state: NodeState): Omit<SignalChainResult, 'warnings'> & { warnings: string[] } {
  const mic = computeMic(state)
  const preamp = computePreamp(mic.out, state)
  const eq = computeEQ(preamp.out, state)
  const comp = computeCompressor(eq.out, state)
  const fader = computeFader(comp.out, state)
  const master = computeMaster(fader.out, state)

  const partial = { mic, preamp, eq, comp, fader, master }
  const overallHealth = worstHealth([mic, preamp, eq, comp, fader, master].map((s) => s.health))

  return { ...partial, overallHealth, warnings: [] }
}

export function useSignalChain(): SignalChainResult {
  const nodeState = useSignalStore((s) => s.nodeState)
  const { t, fmt } = useTranslation()

  const mic = computeMic(nodeState)
  const preamp = computePreamp(mic.out, nodeState)
  const eq = computeEQ(preamp.out, nodeState)
  const comp = computeCompressor(eq.out, nodeState)
  const fader = computeFader(comp.out, nodeState)
  const master = computeMaster(fader.out, nodeState)

  const partial = { mic, preamp, eq, comp, fader, master }
  const overallHealth = worstHealth([mic, preamp, eq, comp, fader, master].map((s) => s.health))
  const warnings = buildWarnings(partial, t.warnings, fmt)

  return { ...partial, overallHealth, warnings }
}
