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
  stages: Record<string, StageResult | CompressorResult>
  inputDb: Record<string, number>
  chainOrder: string[]
  overallHealth: SignalHealth
  warnings: string[]
}

export const DEFAULT_STAGE: StageResult = { out: -Infinity, health: 'too-quiet' }
export const DEFAULT_COMP: CompressorResult = { out: -Infinity, health: 'too-quiet', gainReductionDb: 0 }

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

function computePreamp(input: number, state: NodeState): StageResult {
  const out = Math.min(input + state.preampGainDb, 20)
  return { out, health: getHealth(out) }
}

function computeEQ(input: number, state: NodeState): StageResult {
  const bandSum = state.eqBands.reduce((acc, b) => acc + b.gainDb, 0)
  const out = input + bandSum
  return { out, health: getHealth(out) }
}

function computeCompressor(input: number, state: NodeState): CompressorResult {
  const { compThresholdDb, compRatio, compMakeupGainDb } = state
  let gainReductionDb = 0
  if (input > compThresholdDb) {
    gainReductionDb = (input - compThresholdDb) * (1 - 1 / compRatio)
  }
  const out = input - gainReductionDb + compMakeupGainDb
  return { out, health: getHealth(out), gainReductionDb }
}

function computeFader(input: number, state: NodeState): StageResult {
  const out = input + state.faderDb
  return { out, health: getHealth(out) }
}

function computeMasterFader(input: number, state: NodeState): StageResult {
  const out = input + state.masterFaderDb
  return { out, health: getHealth(out) }
}

function computeOutputGain(input: number, state: NodeState): StageResult {
  const out = input + state.outputGainDb
  return { out, health: getHealth(out) }
}

function computeOutputEQ(input: number, state: NodeState): StageResult {
  const bandSum = state.outputEqBands.reduce((acc, b) => acc + b.gainDb, 0)
  const out = input + bandSum
  return { out, health: getHealth(out) }
}

function computeNodeById(
  nodeId: string,
  input: number,
  state: NodeState
): StageResult | CompressorResult {
  switch (nodeId) {
    case 'mic':           return computeMic(state)
    case 'preamp':        return computePreamp(input, state)
    case 'eq':            return computeEQ(input, state)
    case 'comp':          return computeCompressor(input, state)
    case 'fader':         return computeFader(input, state)
    case 'master-bus':    return { out: input, health: getHealth(input) }
    case 'master-fader':  return computeMasterFader(input, state)
    case 'output-eq':     return computeOutputEQ(input, state)
    case 'output-gain':   return computeOutputGain(input, state)
    case 'speaker':       return { out: input, health: getHealth(input) }
    default:              return { out: input, health: getHealth(input) }
  }
}

function worstHealth(healths: SignalHealth[]): SignalHealth {
  if (healths.includes('clipping')) return 'clipping'
  if (healths.includes('hot')) return 'hot'
  if (healths.includes('too-quiet')) return 'too-quiet'
  return 'good'
}

function buildWarnings(
  stages: Record<string, StageResult | CompressorResult>,
  w: Translations['warnings'],
  fmt: (str: string, params: Record<string, string>) => string
): string[] {
  const warns: string[] = []
  const preamp = stages['preamp']
  const eq = stages['eq']
  const comp = stages['comp'] as CompressorResult | undefined
  const masterFader = stages['master-fader']

  if (preamp?.health === 'too-quiet') warns.push(w.preampTooQuiet)
  if (preamp?.health === 'clipping') warns.push(w.preampClipping)
  if (eq?.health === 'clipping') warns.push(w.eqClipping)
  if (comp != null && comp.gainReductionDb > 10)
    warns.push(fmt(w.heavyCompression, { amount: comp.gainReductionDb.toFixed(1) }))
  if (masterFader?.health === 'clipping') warns.push(w.masterClipping)
  if (masterFader?.health === 'too-quiet') warns.push(w.masterTooQuiet)
  return warns
}

export function useSignalChain(): SignalChainResult {
  const nodeState    = useSignalStore((s) => s.nodeState)
  const chainOrder   = useSignalStore((s) => s.chainOrder)
  const bypassedNodes = useSignalStore((s) => s.bypassedNodes)
  const { t, fmt }   = useTranslation()

  const stages: Record<string, StageResult | CompressorResult> = {}
  const inputDb: Record<string, number> = {}
  let signal = -Infinity

  for (const id of chainOrder) {
    inputDb[id] = signal
    if (bypassedNodes.has(id)) {
      const bypassed: StageResult | CompressorResult =
        id === 'comp'
          ? { out: signal, health: getHealth(signal), gainReductionDb: 0 }
          : { out: signal, health: getHealth(signal) }
      stages[id] = bypassed
    } else {
      stages[id] = computeNodeById(id, signal, nodeState)
    }
    signal = stages[id].out
  }

  const allHealths = Object.values(stages).map((s) => s.health)
  const overallHealth = worstHealth(allHealths.length > 0 ? allHealths : ['too-quiet'])
  const warnings = buildWarnings(stages, t.warnings, fmt)

  return { stages, inputDb, chainOrder, overallHealth, warnings }
}
