import { useMemo } from 'react'
import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import type { ChannelNodeState, MasterState, Channel, Bus, Send } from '../store/signalStore'
import type { Translations } from '../i18n/translations'
import type { SignalNode, SignalEdge } from '../data/nodeRegistry'
import { NODE_REGISTRY } from '../data/nodeRegistry'

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

export interface MultiChannelSignalResult {
  allStages: Record<string, StageResult | CompressorResult>
  allInputDb: Record<string, number>
  channelResults: Record<string, { stages: Record<string, StageResult | CompressorResult>; outputDb: number }>
  masterStages: Record<string, StageResult | CompressorResult>
  masterInputDb: number
  busResults: Record<string, { inputDb: number; outputDb: number }>
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

// ── Per-channel computation ───────────────────────────────────────────────────

function computeSource(state: ChannelNodeState): StageResult {
  let out: number
  switch (state.sourceType) {
    case 'mic':        out = state.micSensitivityDb; break
    case 'line':       out = state.lineInputDb; break
    case 'instrument': out = state.instrumentInputDb; break
    default:           out = -60
  }
  return { out, health: getHealth(out) }
}

function computePreamp(input: number, state: ChannelNodeState): StageResult {
  const out = Math.min(input + state.preampGainDb, 20)
  return { out, health: getHealth(out) }
}

function computeEQ(input: number, state: ChannelNodeState): StageResult {
  const bandSum = state.eqBands.reduce((acc, b) => acc + b.gainDb, 0)
  const out = input + bandSum
  return { out, health: getHealth(out) }
}

function computeCompressor(input: number, state: ChannelNodeState): CompressorResult {
  const { compThresholdDb, compRatio, compMakeupGainDb } = state
  let gainReductionDb = 0
  if (input > compThresholdDb) {
    gainReductionDb = (input - compThresholdDb) * (1 - 1 / compRatio)
  }
  const out = input - gainReductionDb + compMakeupGainDb
  return { out, health: getHealth(out), gainReductionDb }
}

function computeChannelFader(input: number, state: ChannelNodeState): StageResult {
  const out = input + state.faderDb
  return { out, health: getHealth(out) }
}

function computeHPF(input: number): StageResult {
  // HPF shapes the frequency spectrum but does not change the overall signal level
  // in this educational model. The visual curve in HPFNode teaches the concept.
  return { out: input, health: getHealth(input) }
}

function computeChannelNode(
  typeKey: string,
  input: number,
  state: ChannelNodeState
): StageResult | CompressorResult {
  switch (typeKey) {
    case 'source':  return computeSource(state)
    case 'preamp':  return computePreamp(input, state)
    case 'hpf':     return computeHPF(input)
    case 'eq':      return computeEQ(input, state)
    case 'comp':    return computeCompressor(input, state)
    case 'fader':   return computeChannelFader(input, state)
    default:        return { out: input, health: getHealth(input) }
  }
}

function computeChannelStages(
  channel: Channel
): { stages: Record<string, StageResult | CompressorResult>; inputDb: Record<string, number>; outputDb: number } {
  const { id, chainOrder, bypassedNodes, nodeState } = channel
  const stages: Record<string, StageResult | CompressorResult> = {}
  const inputDb: Record<string, number> = {}
  let signal = -Infinity

  for (const typeKey of chainOrder) {
    const rfId = `${id}:${typeKey}`
    inputDb[rfId] = signal
    if (bypassedNodes.has(typeKey)) {
      stages[rfId] = typeKey === 'comp'
        ? { out: signal, health: getHealth(signal), gainReductionDb: 0 }
        : { out: signal, health: getHealth(signal) }
    } else {
      stages[rfId] = computeChannelNode(typeKey, signal, nodeState)
    }
    signal = stages[rfId].out
  }

  return { stages, inputDb, outputDb: signal }
}

// ── Signal summing ────────────────────────────────────────────────────────────

function sumSignalsToDb(dbs: number[]): number {
  const finite = dbs.filter((db) => isFinite(db))
  if (finite.length === 0) return -Infinity
  const linearSum = finite.reduce((acc, db) => acc + Math.pow(10, db / 20), 0)
  return 20 * Math.log10(linearSum)
}

// ── Master section computation ────────────────────────────────────────────────

function computeMasterFader(input: number, state: MasterState): StageResult {
  const out = input + state.masterFaderDb
  return { out, health: getHealth(out) }
}

function computeOutputGain(input: number, state: MasterState): StageResult {
  const out = input + state.outputGainDb
  return { out, health: getHealth(out) }
}

function computeGraphicEQ(input: number, state: MasterState): StageResult {
  const bandSum = state.graphicEqBands.reduce((acc, b) => acc + b.gainDb, 0)
  const out = input + bandSum
  return { out, health: getHealth(out) }
}

function computeMasterStages(
  summedDb: number,
  masterState: MasterState,
  masterChain: string[]
): Record<string, StageResult | CompressorResult> {
  const stages: Record<string, StageResult | CompressorResult> = {}
  let signal = summedDb

  for (const nodeId of masterChain) {
    switch (nodeId) {
      case 'master-bus':
        stages[nodeId] = { out: signal, health: getHealth(signal) }
        break
      case 'master-fader':
        stages[nodeId] = computeMasterFader(signal, masterState)
        break
      case 'graphic-eq':
        stages[nodeId] = computeGraphicEQ(signal, masterState)
        break
      case 'speaker':
        // Speaker applies the output gain trim (merged with OutputGainNode)
        stages[nodeId] = computeOutputGain(signal, masterState)
        break
      default:
        stages[nodeId] = { out: signal, health: getHealth(signal) }
    }
    signal = stages[nodeId].out
  }

  return stages
}

// ── Bus signal computation ────────────────────────────────────────────────────

function computeBusResults(
  buses: Bus[],
  sends: Send[],
  allStages: Record<string, StageResult | CompressorResult>
): Record<string, { inputDb: number; outputDb: number }> {
  const results: Record<string, { inputDb: number; outputDb: number }> = {}

  for (const bus of buses) {
    const busSends = sends.filter((s) => s.busId === bus.id)
    const tapDbs = busSends.map((s) => {
      const stage = allStages[s.fromNodeId]
      return (stage?.out ?? -Infinity) + s.sendLevelDb
    })
    const inputDb = sumSignalsToDb(tapDbs)
    const outputDb = isFinite(inputDb) ? inputDb + bus.faderDb : -Infinity
    results[bus.id] = { inputDb, outputDb }
  }

  return results
}

// ── Health helpers ────────────────────────────────────────────────────────────

function worstHealth(healths: SignalHealth[]): SignalHealth {
  if (healths.includes('clipping')) return 'clipping'
  if (healths.includes('hot')) return 'hot'
  if (healths.includes('too-quiet')) return 'too-quiet'
  return 'good'
}

function buildWarnings(
  allStages: Record<string, StageResult | CompressorResult>,
  channels: Channel[],
  masterStages: Record<string, StageResult | CompressorResult>,
  w: Translations['warnings'],
  fmt: (str: string, params: Record<string, string>) => string
): string[] {
  const warns: string[] = []

  for (const ch of channels) {
    const preamp = allStages[`${ch.id}:preamp`]
    const eq     = allStages[`${ch.id}:eq`]
    const comp   = allStages[`${ch.id}:comp`] as CompressorResult | undefined

    if (preamp?.health === 'too-quiet') warns.push(w.preampTooQuiet)
    if (preamp?.health === 'clipping') warns.push(w.preampClipping)
    if (eq?.health === 'clipping') warns.push(w.eqClipping)
    if (comp != null && comp.gainReductionDb > 10)
      warns.push(fmt(w.heavyCompression, { amount: comp.gainReductionDb.toFixed(1) }))
  }

  const masterFader = masterStages['master-fader']
  if (masterFader?.health === 'clipping') warns.push(w.masterClipping)
  if (masterFader?.health === 'too-quiet') warns.push(w.masterTooQuiet)

  return warns
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useMultiChannelSignal(): MultiChannelSignalResult {
  const channels         = useSignalStore((s) => s.channels)
  const masterState      = useSignalStore((s) => s.masterState)
  const masterChainOrder = useSignalStore((s) => s.masterChainOrder)
  const buses            = useSignalStore((s) => s.buses)
  const sends            = useSignalStore((s) => s.sends)
  const { t, fmt }       = useTranslation()

  return useMemo(() => {
    const channelResults: Record<string, { stages: Record<string, StageResult | CompressorResult>; outputDb: number }> = {}
    const allStages: Record<string, StageResult | CompressorResult> = {}
    const allInputDb: Record<string, number> = {}
    const channelOutputDbs: number[] = []

    for (const ch of channels) {
      const result = computeChannelStages(ch)
      channelResults[ch.id] = result
      Object.assign(allStages, result.stages)
      Object.assign(allInputDb, result.inputDb)
      channelOutputDbs.push(result.outputDb)
    }

    const masterInputDb = sumSignalsToDb(channelOutputDbs)
    const masterStages = computeMasterStages(masterInputDb, masterState, masterChainOrder)
    let masterSignal = masterInputDb
    for (const nodeId of masterChainOrder) {
      allInputDb[nodeId] = masterSignal
      masterSignal = masterStages[nodeId]?.out ?? masterSignal
    }
    Object.assign(allStages, masterStages)

    const busResults = computeBusResults(buses, sends, allStages)

    const allHealths = Object.values(allStages).map((s) => s.health)
    const overallHealth = worstHealth(allHealths.length > 0 ? allHealths : ['too-quiet'])
    const warnings = buildWarnings(allStages, channels, masterStages, t.warnings, fmt)

    return { allStages, allInputDb, channelResults, masterStages, masterInputDb, busResults, overallHealth, warnings }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, masterState, masterChainOrder, buses, sends])
}

// ── Graph traversal engine (Phase 2+) ────────────────────────────────────────

function topoSort(nodes: SignalNode[], edges: SignalEdge[]): SignalNode[] {
  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>()

  for (const n of nodes) {
    inDegree.set(n.id, 0)
    adjList.set(n.id, [])
  }
  for (const e of edges) {
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
    adjList.get(e.source)?.push(e.target)
  }

  const queue = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0)
  const sorted: SignalNode[] = []

  while (queue.length > 0) {
    const node = queue.shift()!
    sorted.push(node)
    for (const neighborId of adjList.get(node.id) ?? []) {
      const deg = (inDegree.get(neighborId) ?? 1) - 1
      inDegree.set(neighborId, deg)
      if (deg === 0) {
        const neighbor = nodes.find((n) => n.id === neighborId)
        if (neighbor) queue.push(neighbor)
      }
    }
  }

  return sorted
}

function computeGraphNode(
  node: SignalNode,
  inputSignals: number[]
): StageResult | CompressorResult {
  const input = inputSignals[0] ?? -Infinity
  const p = node.params

  switch (node.typeKey) {
    case 'mic': {
      const out = (p.sensitivityDb as number) ?? -60
      return { out, health: getHealth(out) }
    }
    case 'line-in':
    case 'instrument': {
      const out = (p.levelDb as number) ?? -10
      return { out, health: getHealth(out) }
    }
    // Legacy source node (old architecture — handled during migration)
    case 'source': {
      const sourceType = (p.sourceType as string) ?? 'mic'
      let out: number
      if (sourceType === 'line') out = (p.lineInputDb as number) ?? -10
      else if (sourceType === 'instrument') out = (p.instrumentInputDb as number) ?? -30
      else out = (p.micSensitivityDb as number) ?? -60
      return { out, health: getHealth(out) }
    }
    case 'gain':
    case 'preamp': {
      const gain = (p.gainDb as number) ?? (p.preampGainDb as number) ?? 40
      const out = Math.min(input + gain, 20)
      return { out, health: getHealth(out) }
    }
    case 'amp': {
      const out = Math.min(input + ((p.gainDb as number) ?? 20), 20)
      return { out, health: getHealth(out) }
    }
    case 'hpf':
      return { out: input, health: getHealth(input) }
    case 'eq': {
      const bandSum =
        ((p.band0gainDb as number) ?? 0) +
        ((p.band1gainDb as number) ?? 0) +
        ((p.band2gainDb as number) ?? 0) +
        ((p.band3gainDb as number) ?? 0)
      const out = input + bandSum
      return { out, health: getHealth(out) }
    }
    case 'comp': {
      const threshold = (p.thresholdDb as number) ?? 0
      const ratio = (p.ratio as number) ?? 2
      const makeup = (p.makeupGainDb as number) ?? 0
      let gainReductionDb = 0
      if (input > threshold) {
        gainReductionDb = (input - threshold) * (1 - 1 / ratio)
      }
      const out = input - gainReductionDb + makeup
      return { out, health: getHealth(out), gainReductionDb }
    }
    case 'fader':
    case 'master-fader': {
      const out = input + ((p.faderDb as number) ?? (p.masterFaderDb as number) ?? 0)
      return { out, health: getHealth(out) }
    }
    case 'potentiometer': {
      const out = input - Math.abs((p.attenuationDb as number) ?? 0)
      return { out, health: getHealth(out) }
    }
    case 'switch': {
      const out = (p.on as boolean) !== false ? input : -Infinity
      return { out, health: getHealth(out) }
    }
    case 'splitter':
      // Signal duplicates to both outputs; both get the same level
      return { out: input, health: getHealth(input) }
    case 'master-bus':
    case 'bus': {
      const summed = sumSignalsToDb(inputSignals)
      const fader = (p.faderDb as number) ?? 0
      const out = isFinite(summed) ? summed + fader : -Infinity
      return { out, health: getHealth(out) }
    }
    case 'graphic-eq': {
      const bandSum = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].reduce(
        (acc, i) => acc + ((p[`b${i}`] as number) ?? 0),
        0
      )
      const out = input + bandSum
      return { out, health: getHealth(out) }
    }
    case 'speaker': {
      const out = input + ((p.outputTrimDb as number) ?? (p.outputGainDb as number) ?? 0)
      return { out, health: getHealth(out) }
    }
    default:
      return { out: input, health: getHealth(input) }
  }
}

export interface GraphSignalResult {
  stages: Record<string, StageResult | CompressorResult>
  inputDb: Record<string, number>
  portSignal: Map<string, number>
  overallHealth: SignalHealth
  warnings: string[]
}

export function useGraphSignal(): GraphSignalResult {
  const nodes = useSignalStore((s) => s.nodes)
  const edges = useSignalStore((s) => s.edges)
  const { t, fmt } = useTranslation()

  return useMemo(() => {
    const sorted = topoSort(nodes, edges)
    const portSignal = new Map<string, number>()
    const stages: Record<string, StageResult | CompressorResult> = {}
    const inputDb: Record<string, number> = {}

    for (const node of sorted) {
      const incoming = edges.filter((e) => e.target === node.id)
      const inputSignals = incoming.map(
        (e) => portSignal.get(`${e.source}:${e.sourceHandle}`) ?? -Infinity
      )

      inputDb[node.id] = inputSignals.length > 0 ? inputSignals[0] : -Infinity

      const def = NODE_REGISTRY[node.typeKey]
      const outputs = def?.outputs ?? [{ id: 'out', label: '', side: 'right' as const }]

      if (node.bypassed && incoming.length > 0) {
        const bypassSig = inputSignals[0] ?? -Infinity
        const result: StageResult = { out: bypassSig, health: getHealth(bypassSig) }
        stages[node.id] = result
        for (const port of outputs) portSignal.set(`${node.id}:${port.id}`, bypassSig)
      } else {
        const result = computeGraphNode(node, inputSignals)
        stages[node.id] = result
        // For splitters all outputs carry the same signal; for everyone else the single 'out'
        for (const port of outputs) portSignal.set(`${node.id}:${port.id}`, result.out)
      }
    }

    const allHealths = Object.values(stages).map((s) => s.health)
    const overallHealth = worstHealth(allHealths.length > 0 ? allHealths : ['too-quiet'])

    // Simplified warning pass for graph model
    const warns: string[] = []
    for (const node of nodes) {
      const stage = stages[node.id]
      if (!stage) continue
      if ((node.typeKey === 'gain' || node.typeKey === 'preamp') && stage.health === 'too-quiet')
        warns.push(t.warnings.preampTooQuiet)
      if ((node.typeKey === 'gain' || node.typeKey === 'preamp') && stage.health === 'clipping')
        warns.push(t.warnings.preampClipping)
      if (node.typeKey === 'eq' && stage.health === 'clipping')
        warns.push(t.warnings.eqClipping)
      if (node.typeKey === 'comp') {
        const comp = stage as CompressorResult
        if (comp.gainReductionDb > 10)
          warns.push(fmt(t.warnings.heavyCompression, { amount: comp.gainReductionDb.toFixed(1) }))
      }
      if (node.typeKey === 'fader' && node.id === 'fader-master' && stage.health === 'clipping')
        warns.push(t.warnings.masterClipping)
      if (node.typeKey === 'fader' && node.id === 'fader-master' && stage.health === 'too-quiet')
        warns.push(t.warnings.masterTooQuiet)
    }

    return { stages, inputDb, portSignal, overallHealth, warnings: warns }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])
}

// ── Backward-compat wrapper ───────────────────────────────────────────────────
// GainStagingBanner and SignalLevelProfile still use useSignalChain().
// Returns the first channel + master merged into the old shape.

export function useSignalChain(): SignalChainResult {
  const result = useMultiChannelSignal()
  const channels = useSignalStore((s) => s.channels)

  const firstChannel = channels[0]
  const firstChain = firstChannel
    ? firstChannel.chainOrder.map((k) => `${firstChannel.id}:${k}`)
    : []

  const masterChain = ['master-bus', 'master-fader', 'graphic-eq', 'speaker']
    .filter((id) => id in result.masterStages)

  const chainOrder = [...firstChain, ...masterChain]
  const stages = result.allStages

  return {
    stages,
    inputDb: result.allInputDb,
    chainOrder,
    overallHealth: result.overallHealth,
    warnings: result.warnings,
  }
}
