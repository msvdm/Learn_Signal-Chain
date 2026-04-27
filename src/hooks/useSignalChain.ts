import { useMemo } from 'react'
import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
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

export const DEFAULT_STAGE: StageResult = { out: -Infinity, health: 'too-quiet' }
export const DEFAULT_COMP: CompressorResult = { out: -Infinity, health: 'too-quiet', gainReductionDb: 0 }

export function getHealth(db: number): SignalHealth {
  if (db < -40) return 'too-quiet'
  if (db <= -12) return 'good'
  if (db <= 0) return 'hot'
  return 'clipping'
}

// ── Signal summing ─────────────────────────────────────────────────────────────

function sumSignalsToDb(dbs: number[]): number {
  const finite = dbs.filter((db) => isFinite(db))
  if (finite.length === 0) return -Infinity
  const linearSum = finite.reduce((acc, db) => acc + Math.pow(10, db / 20), 0)
  return 20 * Math.log10(linearSum)
}

// ── Health helpers ─────────────────────────────────────────────────────────────

function worstHealth(healths: SignalHealth[]): SignalHealth {
  if (healths.includes('clipping')) return 'clipping'
  if (healths.includes('hot')) return 'hot'
  if (healths.includes('too-quiet')) return 'too-quiet'
  return 'good'
}

// ── Graph traversal engine ─────────────────────────────────────────────────────

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
        for (const port of outputs) portSignal.set(`${node.id}:${port.id}`, result.out)
      }
    }

    const allHealths = Object.values(stages).map((s) => s.health)
    const overallHealth = worstHealth(allHealths.length > 0 ? allHealths : ['too-quiet'])

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
