import { useMemo } from 'react'
import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import type { SignalNode, SignalEdge, EQBand } from '../data/nodeRegistry'
import { NODE_REGISTRY } from '../data/nodeRegistry'
import { bellGain, shelfGain } from '../components/controls/eqMath'

// ── Pink-noise-weighted EQ level change ───────────────────────────────────────
// Pink noise has equal power per octave. Sampling log-uniformly from 20–20kHz
// gives each octave the same weight, which is the correct weighting for perceptual
// level change estimation (as opposed to just summing band gains).
const GRAPHIC_EQ_CENTERS = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
const EQ_SAMPLES = 64

function eqPinkNoiseLevelChange(bands: EQBand[]): number {
  if (bands.every((b) => b.gainDb === 0)) return 0
  let sumPower = 0
  for (let i = 0; i < EQ_SAMPLES; i++) {
    const t = i / (EQ_SAMPLES - 1)
    const freq = Math.pow(10, t * (Math.log10(20000) - Math.log10(20)) + Math.log10(20))
    let gain = 0
    for (const band of bands) {
      if (band.type === 'high-shelf' || band.type === 'low-shelf') {
        gain += shelfGain(freq, band.freqHz, band.gainDb, band.type)
      } else {
        gain += bellGain(freq, band.freqHz, band.gainDb, band.Q ?? 1.4)
      }
    }
    sumPower += Math.pow(10, gain / 10)
  }
  return 10 * Math.log10(sumPower / EQ_SAMPLES)
}

function graphicEqPinkNoiseLevelChange(gains: number[]): number {
  if (gains.every((g) => g === 0)) return 0
  let sumPower = 0
  for (let i = 0; i < EQ_SAMPLES; i++) {
    const t = i / (EQ_SAMPLES - 1)
    const freq = Math.pow(10, t * (Math.log10(20000) - Math.log10(20)) + Math.log10(20))
    let gain = 0
    for (let b = 0; b < 10; b++) {
      // Q=1.4 gives about one-octave bandwidth, matching a graphic EQ band
      gain += bellGain(freq, GRAPHIC_EQ_CENTERS[b], gains[b], 1.4)
    }
    sumPower += Math.pow(10, gain / 10)
  }
  return 10 * Math.log10(sumPower / EQ_SAMPLES)
}

// 2nd-order Butterworth HPF: |H(f)|² = r⁴/(1+r⁴), r = f/cutoff
// Integrate over pink-noise spectrum (log-uniform samples) to get the
// broadband level reduction caused by rolling off frequencies below cutoff.
function hpfPinkNoiseLevelChange(cutoffHz: number): number {
  if (cutoffHz <= 20) return 0
  let sumPower = 0
  for (let i = 0; i < EQ_SAMPLES; i++) {
    const t = i / (EQ_SAMPLES - 1)
    const freq = Math.pow(10, t * (Math.log10(20000) - Math.log10(20)) + Math.log10(20))
    const r = freq / cutoffHz
    const r4 = r * r * r * r
    sumPower += r4 / (1 + r4)
  }
  return 10 * Math.log10(sumPower / EQ_SAMPLES)
}

export type SignalHealth = 'too-quiet' | 'good' | 'hot' | 'clipping'
export type SignalDomain = 'analog' | 'digital'

export interface StageResult {
  out: number
  health: SignalHealth
  domain: SignalDomain
  outL?: number                     // stereo bus / pan node left channel
  outR?: number                     // stereo bus / pan node right channel
  warning?: string                  // domain violation or blocked signal
  portOutputs?: Record<string, number> // per-port overrides for multi-output nodes
}

export interface CompressorResult extends StageResult {
  gainReductionDb: number
}

export interface DeesserResult extends StageResult {
  gainReductionDb: number
}

export const DEFAULT_STAGE: StageResult = { out: -Infinity, health: 'too-quiet', domain: 'analog' }
export const DEFAULT_COMP: CompressorResult = { out: -Infinity, health: 'too-quiet', domain: 'analog', gainReductionDb: 0 }

export function getHealth(db: number): SignalHealth {
  if (db < -40) return 'too-quiet'
  if (db <= -12) return 'good'
  if (db <= 0) return 'hot'
  return 'clipping'
}

// Audio-taper mapping for potentiometer position (0–100).
// 0 = fully CCW → −∞,  75 = unity (0 dB),  100 = fully CW (+10 dB).
// Below unity: log taper (−60 dB/octave feel). Above unity: linear boost to +10 dB.
export function potPositionToDb(position: number): number {
  if (position <= 0) return -Infinity
  const t = position / 100
  if (t <= 0.75) {
    const normalized = t / 0.75                          // 0 → 1 as pot goes CCW → unity
    return 60 * Math.log10(Math.max(normalized, 0.0001)) // −∞ → 0 dB
  }
  return ((t - 0.75) / 0.25) * 10                       // 0 → +10 dB above unity
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
  inputSignals: number[],
  inputDomain: SignalDomain,
  domainMismatch: boolean,
  portInputs: Record<string, number> = {},
): StageResult | CompressorResult | DeesserResult {
  const input = inputSignals[0] ?? -Infinity
  const p = node.params
  const domain = inputDomain // most nodes pass domain through unchanged

  // Domain mismatch in bus nodes — cannot sum analog and digital signals
  if (domainMismatch && (
    node.typeKey === 'master-bus' || node.typeKey === 'mono-bus' ||
    node.typeKey === 'stereo-bus' || node.typeKey === 'audio-interface'
  )) {
    return { out: -Infinity, health: 'too-quiet', domain, warning: 'domainMixedBus' }
  }

  // Amp and speakers cannot process digital signals
  if (inputDomain === 'digital' && (node.typeKey === 'amp' || node.typeKey === 'speaker' || node.typeKey === 'active-speaker')) {
    const warning = node.typeKey === 'amp' ? 'digitalToAmp' : 'digitalToSpeaker'
    return { out: -Infinity, health: 'too-quiet', domain, warning }
  }

  switch (node.typeKey) {
    case 'mic': {
      const out = (p.sensitivityDb as number) ?? -60
      return { out, health: getHealth(out), domain: 'analog' }
    }
    case 'line-in':
    case 'instrument': {
      const out = (p.levelDb as number) ?? -10
      return { out, health: getHealth(out), domain: 'analog' }
    }
    case 'di-box': {
      // Passive DI: impedance conversion only, no level change. Both outputs carry same signal.
      const out = input
      return { out, health: getHealth(out), domain: 'analog' }
    }
    case 'gain':
    case 'preamp': {
      const gain = (p.gainDb as number) ?? (p.preampGainDb as number) ?? 40
      const out = Math.min(input + gain, 20)
      return { out, health: getHealth(out), domain }
    }
    case 'amp': {
      const out = Math.min(input + ((p.gainDb as number) ?? 20), 20)
      return { out, health: getHealth(out), domain }
    }
    case 'hpf': {
      const cutoffHz = (p.cutoffHz as number) ?? 80
      const levelChange = hpfPinkNoiseLevelChange(cutoffHz)
      const out = input + levelChange
      return { out, health: getHealth(out), domain }
    }
    case 'eq': {
      const bands = (p.bands as EQBand[]) ?? []
      const levelChange = eqPinkNoiseLevelChange(bands)
      const out = input + levelChange
      return { out, health: getHealth(out), domain }
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
      return { out, health: getHealth(out), gainReductionDb, domain }
    }
    case 'noise-gate': {
      const threshold = (p.thresholdDb as number) ?? -40
      const out = input >= threshold ? input : -Infinity
      return { out, health: getHealth(out), domain }
    }
    case 'limiter': {
      const ceiling = (p.thresholdDb as number) ?? -3
      const out = Math.min(input, ceiling)
      return { out, health: getHealth(out), domain }
    }
    case 'deesser': {
      const threshold = (p.thresholdDb as number) ?? -20
      // 8:1 ratio on sibilant frequencies — simplified to overall level reduction
      const gainReductionDb = Math.max(0, (input - threshold) * (1 - 1 / 8))
      const out = input - gainReductionDb
      return { out, health: getHealth(out), gainReductionDb, domain }
    }
    case 'fader':
    case 'master-fader': {
      const out = input + ((p.faderDb as number) ?? (p.masterFaderDb as number) ?? 0)
      return { out, health: getHealth(out), domain }
    }
    case 'potentiometer': {
      const db  = potPositionToDb((p.position as number) ?? 75)
      const out = isFinite(db) ? input + db : -Infinity
      return { out, health: getHealth(out), domain }
    }
    case 'switch': {
      const out = (p.on as boolean) !== false ? input : -Infinity
      return { out, health: getHealth(out), domain }
    }
    case 'relay': {
      // 2 inputs (in-a, in-b) → 1 output; selectedInput picks which source passes
      const selected = (p.selectedInput as string) ?? 'a'
      const out = portInputs[`in-${selected}`] ?? -Infinity
      return { out, health: getHealth(out), domain }
    }
    case 'pan': {
      const pos = (p.panPosition as number) ?? 50
      const ratio = pos / 100
      const leftGain  = Math.cos(ratio * Math.PI / 2)
      const rightGain = Math.sin(ratio * Math.PI / 2)
      const outL = isFinite(input) ? input + 20 * Math.log10(Math.max(leftGain,  1e-10)) : -Infinity
      const outR = isFinite(input) ? input + 20 * Math.log10(Math.max(rightGain, 1e-10)) : -Infinity
      const out  = isFinite(input) ? Math.max(outL, outR) : -Infinity
      return {
        out,
        health: getHealth(out),
        domain,
        outL,
        outR,
        portOutputs: { 'out-l': outL, 'out-r': outR },
      }
    }
    case 'master-bus':
    case 'stereo-bus':
    case 'mono-bus':
    case 'audio-interface': {
      const summed = sumSignalsToDb(inputSignals)
      const fader = (p.faderDb as number) ?? 0
      const out = isFinite(summed) ? summed + fader : -Infinity
      return { out, health: getHealth(out), domain }
    }
    case 'stereo-fader': {
      const fader = (p.faderDb as number) ?? 0
      const inL = portInputs['in-l'] ?? inputSignals[0] ?? -Infinity
      const inR = portInputs['in-r'] ?? inputSignals[1] ?? inputSignals[0] ?? -Infinity
      const outL = isFinite(inL) ? inL + fader : -Infinity
      const outR = isFinite(inR) ? inR + fader : -Infinity
      const out  = Math.max(isFinite(outL) ? outL : -Infinity, isFinite(outR) ? outR : -Infinity)
      return { out, health: getHealth(out), domain, outL, outR, portOutputs: { 'out-l': outL, 'out-r': outR } }
    }
    case 'balance': {
      const pos  = ((p.balancePosition as number) ?? 50) / 100  // 0..1
      const inL  = portInputs['in-l'] ?? inputSignals[0] ?? -Infinity
      const inR  = portInputs['in-r'] ?? inputSignals[1] ?? inputSignals[0] ?? -Infinity
      // Left gain: full at pos=0..0.5, fades to 0 at pos=1
      const leftGainLin  = pos <= 0.5 ? 1 : 1 - (pos - 0.5) * 2
      // Right gain: 0 at pos=0, full at pos=0.5..1
      const rightGainLin = pos >= 0.5 ? 1 : pos * 2
      const outL = isFinite(inL) && leftGainLin  > 0 ? inL  + 20 * Math.log10(leftGainLin)  : -Infinity
      const outR = isFinite(inR) && rightGainLin > 0 ? inR  + 20 * Math.log10(rightGainLin) : -Infinity
      const out  = Math.max(isFinite(outL) ? outL : -Infinity, isFinite(outR) ? outR : -Infinity)
      return { out, health: getHealth(out), domain, outL, outR, portOutputs: { 'out-l': outL, 'out-r': outR } }
    }
    case 'graphic-eq': {
      const gains = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (p[`b${i}`] as number) ?? 0)
      const levelChange = graphicEqPinkNoiseLevelChange(gains)
      const out = input + levelChange
      return { out, health: getHealth(out), domain }
    }
    case 'adc': {
      if (inputDomain === 'digital') {
        return { out: -Infinity, health: 'too-quiet', domain: 'digital', warning: 'adcExpectsAnalog' }
      }
      const alignment = (p.alignmentDb as number) ?? 18
      const out = isFinite(input) ? input + alignment : -Infinity
      return { out, health: getHealth(out), domain: 'digital' }
    }
    case 'dac': {
      if (inputDomain === 'analog') {
        return { out: -Infinity, health: 'too-quiet', domain: 'analog', warning: 'dacExpectsDigital' }
      }
      const alignment = (p.alignmentDb as number) ?? 18
      const out = isFinite(input) ? input - alignment : -Infinity
      return { out, health: getHealth(out), domain: 'analog' }
    }
    case 'speaker': {
      // Handled in useGraphSignal with upstream amp check; this path only runs when amp is present
      const out = input + ((p.outputTrimDb as number) ?? 0)
      return { out, health: getHealth(out), domain }
    }
    case 'active-speaker': {
      const volumeDb = (p.volumeDb as number) ?? 0
      const out = isFinite(input) ? input + volumeDb : -Infinity
      return { out, health: getHealth(out), domain }
    }
    default:
      return { out: input, health: getHealth(input), domain }
  }
}

export interface GraphSignalResult {
  stages: Record<string, StageResult | CompressorResult | DeesserResult>
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
    const stages: Record<string, StageResult | CompressorResult | DeesserResult> = {}
    const inputDb: Record<string, number> = {}
    // Track which node typeKeys exist anywhere upstream of each node
    const upstreamTypes = new Map<string, Set<string>>()
    for (const n of nodes) upstreamTypes.set(n.id, new Set())

    for (const node of sorted) {
      const incoming = edges.filter((e) => e.target === node.id)
      const inputSignals = incoming.map(
        (e) => portSignal.get(`${e.source}:${e.sourceHandle}`) ?? -Infinity
      )

      // Accumulate upstream types from all source nodes
      const myUpstream = new Set<string>()
      for (const edge of incoming) {
        const srcTypes = upstreamTypes.get(edge.source) ?? new Set()
        for (const t of srcTypes) myUpstream.add(t)
        const srcNode = nodes.find((n) => n.id === edge.source)
        if (srcNode) myUpstream.add(srcNode.typeKey)
      }
      upstreamTypes.set(node.id, myUpstream)

      inputDb[node.id] = inputSignals.length > 0 ? inputSignals[0] : -Infinity

      const def = NODE_REGISTRY[node.typeKey]
      const outputs = def?.outputs ?? [{ id: 'out', label: '', side: 'right' as const }]

      // Map each target handle to its incoming signal value
      const portInputs: Record<string, number> = {}
      for (const edge of incoming) {
        portInputs[edge.targetHandle] = portSignal.get(`${edge.source}:${edge.sourceHandle}`) ?? -Infinity
      }

      // Determine input domain from upstream stages
      let inputDomain: SignalDomain = 'analog'
      let domainMismatch = false
      if (incoming.length > 0) {
        const inputDomains = incoming.map((e) => stages[e.source]?.domain ?? 'analog')
        const unique = new Set(inputDomains)
        domainMismatch = unique.size > 1
        inputDomain = inputDomains[0] ?? 'analog'
      }

      // Relay: output domain follows the selected input, not all inputs
      if (node.typeKey === 'relay') {
        const selected = (node.params.selectedInput as string) ?? 'a'
        const selEdge = incoming.find((e) => e.targetHandle === `in-${selected}`)
        inputDomain = selEdge ? (stages[selEdge.source]?.domain ?? 'analog') : 'analog'
        domainMismatch = false
      }

      // Passive speaker requires a power amplifier (amp node) somewhere upstream
      if (node.typeKey === 'speaker' && !myUpstream.has('amp') && incoming.length > 0) {
        const noAmpResult: StageResult = { out: -Infinity, health: 'too-quiet', domain: inputDomain }
        stages[node.id] = noAmpResult
        for (const port of outputs) portSignal.set(`${node.id}:${port.id}`, -Infinity)
        continue
      }

      let result: StageResult | CompressorResult | DeesserResult

      if (node.bypassed && incoming.length > 0) {
        // Stereo pass-through nodes: preserve L/R channel mapping on bypass
        if (node.typeKey === 'stereo-fader' || node.typeKey === 'balance') {
          const bypassL = portInputs['in-l'] ?? inputSignals[0] ?? -Infinity
          const bypassR = portInputs['in-r'] ?? inputSignals[0] ?? -Infinity
          const out = Math.max(isFinite(bypassL) ? bypassL : -Infinity, isFinite(bypassR) ? bypassR : -Infinity)
          result = { out, health: getHealth(out), domain: inputDomain, portOutputs: { 'out-l': bypassL, 'out-r': bypassR } }
          stages[node.id] = result
          portSignal.set(`${node.id}:out-l`, bypassL)
          portSignal.set(`${node.id}:out-r`, bypassR)
        } else {
          const bypassSig = inputSignals[0] ?? -Infinity
          result = { out: bypassSig, health: getHealth(bypassSig), domain: inputDomain }
          stages[node.id] = result
          for (const port of outputs) portSignal.set(`${node.id}:${port.id}`, bypassSig)
        }
      } else {
        result = computeGraphNode(node, inputSignals, inputDomain, domainMismatch, portInputs)
        stages[node.id] = result

        // Apply per-port overrides for multi-output nodes (relay, pan, di-box)
        if (result.portOutputs) {
          for (const [portId, value] of Object.entries(result.portOutputs)) {
            portSignal.set(`${node.id}:${portId}`, value)
          }
          // Set any remaining ports to result.out as fallback
          for (const port of outputs) {
            if (!(port.id in result.portOutputs)) {
              portSignal.set(`${node.id}:${port.id}`, result.out)
            }
          }
        } else {
          for (const port of outputs) portSignal.set(`${node.id}:${port.id}`, result.out)
        }
      }

      // Compute stereo L/R for bus nodes (master-bus, stereo-bus, audio-interface)
      if (
        node.typeKey === 'master-bus' ||
        node.typeKey === 'stereo-bus' ||
        node.typeKey === 'audio-interface'
      ) {
        const lInputs: number[] = []
        const rInputs: number[] = []
        for (const edge of incoming) {
          if (edge.sourceHandle === 'out-l') {
            const sig = portSignal.get(`${edge.source}:out-l`) ?? -Infinity
            lInputs.push(sig)
          } else if (edge.sourceHandle === 'out-r') {
            const sig = portSignal.get(`${edge.source}:out-r`) ?? -Infinity
            rInputs.push(sig)
          } else {
            const sig = portSignal.get(`${edge.source}:${edge.sourceHandle}`) ?? -Infinity
            if (isFinite(sig)) {
              lInputs.push(sig)
              rInputs.push(sig)
            }
          }
        }
        const fader = (node.params.faderDb as number) ?? 0
        const sumL = sumSignalsToDb(lInputs)
        const sumR = sumSignalsToDb(rInputs)
        result.outL = isFinite(sumL) ? sumL + fader : -Infinity
        result.outR = isFinite(sumR) ? sumR + fader : -Infinity

        // Push the actual L/R values to their dedicated output ports so
        // downstream nodes reading portSignal get the correct per-channel level.
        if (node.typeKey === 'master-bus' || node.typeKey === 'stereo-bus') {
          portSignal.set(`${node.id}:out-l`, result.outL)
          portSignal.set(`${node.id}:out-r`, result.outR)
        }
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
