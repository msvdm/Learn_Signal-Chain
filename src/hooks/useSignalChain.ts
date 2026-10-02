import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import type { Translations } from '../i18n/translations'
import type { SignalNode, SignalEdge, EQBand } from '../data/nodeRegistry'
import { MULTI_WIRE_TYPES, getPorts, portSide, basePortId } from '../data/nodeRegistry'
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
  outL?: number                     // stereo nodes, pan: left channel out
  outR?: number                     // stereo nodes, pan: right channel out
  inL?: number                      // stereo nodes: left channel in
  inR?: number                      // stereo nodes: right channel in
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

// Balance knob (the Pan node in stereo mode): 0 = full left, 50 = centre, 100 = full right.
// Unlike pan, the centre is unity on both sides; turning one way only fades the other side.
function balanceOutputs(position: number, inL: number, inR: number): { outL: number; outR: number } {
  const pos = position / 100
  const leftGainLin  = pos <= 0.5 ? 1 : 1 - (pos - 0.5) * 2
  const rightGainLin = pos >= 0.5 ? 1 : pos * 2
  return {
    outL: isFinite(inL) && leftGainLin  > 0 ? inL + 20 * Math.log10(leftGainLin)  : -Infinity,
    outR: isFinite(inR) && rightGainLin > 0 ? inR + 20 * Math.log10(rightGainLin) : -Infinity,
  }
}

// Dynamics that run "linked" in stereo: the louder side decides, both sides get the same change
const LINKED_DYNAMICS = new Set(['comp', 'limiter', 'deesser', 'noise-gate'])

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
  if (domainMismatch && (MULTI_WIRE_TYPES.has(node.typeKey) || node.typeKey === 'audio-interface')) {
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
      const makeupGain = (p.makeupGainDb as number) ?? 0
      const gainReductionDb = Math.max(0, input - ceiling)
      const out = Math.min(input, ceiling) + makeupGain
      return { out, health: getHealth(out), gainReductionDb, domain }
    }
    case 'pad': {
      const engaged = (p.engaged as boolean) !== false
      const out = engaged ? input - 20 : input
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
    case 'aux-bus':
    case 'audio-interface': {
      const summed = sumSignalsToDb(inputSignals)
      const fader = (p.faderDb as number) ?? 0
      const out = isFinite(summed) ? summed + fader : -Infinity
      return { out, health: getHealth(out), domain }
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

/** What a bus is being fed — drives the plain-language hints on bus cards. */
export interface BusNote {
  /** A mono bus receives left/right wires — the two sides are added into one channel. */
  foldedStereo: boolean
  /** A stereo bus receives a mono wire — it lands on both sides at full level. */
  monoOnStereo: boolean
}

export interface GraphSignalResult {
  stages: Record<string, StageResult | CompressorResult | DeesserResult>
  /** Level arriving at each node (the left side for stereo nodes; see stage.inL / inR). */
  inputDb: Record<string, number>
  portSignal: Map<string, number>
  busNotes: Record<string, BusNote>
  overallHealth: SignalHealth
  warnings: string[]
}

// Every node card, port and edge reads the graph result. The store replaces the
// nodes/edges arrays on every change, so one shared single-entry cache keyed on
// those references lets all callers reuse a single computation per change.
let lastGraph: {
  nodes: SignalNode[]
  edges: SignalEdge[]
  warningsText: Translations['warnings']
  result: GraphSignalResult
} | null = null

function cachedGraphSignal(
  nodes: SignalNode[],
  edges: SignalEdge[],
  t: Translations,
  fmt: (str: string, params: Record<string, string>) => string,
): GraphSignalResult {
  if (lastGraph && lastGraph.nodes === nodes && lastGraph.edges === edges && lastGraph.warningsText === t.warnings) {
    return lastGraph.result
  }
  const result = computeGraphSignal(nodes, edges, t, fmt)
  lastGraph = { nodes, edges, warningsText: t.warnings, result }
  return result
}

export function useGraphSignal(): GraphSignalResult {
  const nodes = useSignalStore((s) => s.nodes)
  const edges = useSignalStore((s) => s.edges)
  const { t, fmt } = useTranslation()
  return cachedGraphSignal(nodes, edges, t, fmt)
}

function computeGraphSignal(
  nodes: SignalNode[],
  edges: SignalEdge[],
  t: Translations,
  fmt: (str: string, params: Record<string, string>) => string,
): GraphSignalResult {
  {
    const sorted = topoSort(nodes, edges)
    const portSignal = new Map<string, number>()
    const stages: Record<string, StageResult | CompressorResult | DeesserResult> = {}
    const inputDb: Record<string, number> = {}
    const busNotes: Record<string, BusNote> = {}
    // Track which node typeKeys exist anywhere upstream of each node
    const upstreamTypes = new Map<string, Set<string>>()
    for (const n of nodes) upstreamTypes.set(n.id, new Set())

    for (const node of sorted) {
      const incoming = edges.filter((e) => e.target === node.id)
      const wireDb   = (e: SignalEdge) => portSignal.get(`${e.source}:${e.sourceHandle}`) ?? -Infinity

      // Accumulate upstream types from all source nodes
      const myUpstream = new Set<string>()
      for (const edge of incoming) {
        const srcTypes = upstreamTypes.get(edge.source) ?? new Set()
        for (const t of srcTypes) myUpstream.add(t)
        const srcNode = nodes.find((n) => n.id === edge.source)
        if (srcNode) myUpstream.add(srcNode.typeKey)
      }
      upstreamTypes.set(node.id, myUpstream)

      const ports  = getPorts(node)
      const stereo = ports.isStereo
      // Input port names without the -l / -r side ('in-l' → 'in'), in port order
      const inputBases = [...new Set(ports.inputs.map((p) => basePortId(p.id)))]

      /**
       * Signals arriving at one side of this node, keyed by input port name.
       * - Mono node (side = null): every wire counts, grouped by the port it lands on.
       * - Stereo node: a wire from a stereo output (…-l / …-r) feeds only the side it lands on;
       *   a wire from a mono output feeds both sides.
       * Several wires on one port are added together.
       */
      const gather = (side: 'l' | 'r' | null) => {
        const grouped: Record<string, number[]> = {}
        for (const e of incoming) {
          let port = e.targetHandle
          if (side) {
            const fromStereo = portSide(e.sourceHandle) !== null
            if (fromStereo && portSide(e.targetHandle) !== side) continue
            port = basePortId(e.targetHandle)
          }
          if (!grouped[port]) grouped[port] = []
          grouped[port].push(wireDb(e))
        }
        const portInputs: Record<string, number> = {}
        for (const [port, dbs] of Object.entries(grouped)) portInputs[port] = sumSignalsToDb(dbs)
        const signals = inputBases.length > 0
          ? inputBases.map((b) => portInputs[b] ?? -Infinity)
          : Object.values(portInputs)
        return { portInputs, signals }
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
        const selEdge = incoming.find((e) => basePortId(e.targetHandle) === `in-${selected}` || e.targetHandle === `in-${selected}`)
        inputDomain = selEdge ? (stages[selEdge.source]?.domain ?? 'analog') : 'analog'
        domainMismatch = false
      }

      // Passive speaker requires a power amplifier (amp node) somewhere upstream
      if (node.typeKey === 'speaker' && !myUpstream.has('amp') && incoming.length > 0) {
        const noAmpResult: StageResult = { out: -Infinity, health: 'too-quiet', domain: inputDomain }
        stages[node.id] = noAmpResult
        inputDb[node.id] = gather(null).signals[0] ?? -Infinity
        for (const port of ports.outputs) portSignal.set(`${node.id}:${port.id}`, -Infinity)
        continue
      }

      // One side (or the only channel) of this node
      const runSide = (side: 'l' | 'r' | null): StageResult | CompressorResult | DeesserResult => {
        const { portInputs, signals } = gather(side)
        if (node.bypassed && incoming.length > 0) {
          const pass = signals[0] ?? -Infinity
          return { out: pass, health: getHealth(pass), domain: inputDomain }
        }
        return computeGraphNode(node, signals, inputDomain, domainMismatch, portInputs)
      }

      /** Value of output port `portId` (e.g. 'out', 'direct') from one side's result. */
      const portValue = (r: StageResult, portId: string) => r.portOutputs?.[portId] ?? r.out

      let result: StageResult | CompressorResult | DeesserResult

      if (node.typeKey === 'pan' && stereo) {
        // Balance: L in → L out, R in → R out, one side faded by the knob
        const inL = gather('l').signals[0] ?? -Infinity
        const inR = gather('r').signals[0] ?? -Infinity
        const { outL, outR } = node.bypassed
          ? { outL: inL, outR: inR }
          : balanceOutputs((node.params.panPosition as number) ?? 50, inL, inR)
        const out = Math.max(outL, outR)
        result = { out, health: getHealth(out), domain: inputDomain, outL, outR, inL, inR }
        portSignal.set(`${node.id}:out-l`, outL)
        portSignal.set(`${node.id}:out-r`, outR)
      } else if (stereo && LINKED_DYNAMICS.has(node.typeKey) && !node.bypassed) {
        // The louder side drives the detector; the same gain change goes to both sides
        const inL = gather('l').signals[0] ?? -Infinity
        const inR = gather('r').signals[0] ?? -Infinity
        const detector = Math.max(inL, inR)
        const linked   = computeGraphNode(node, [detector], inputDomain, domainMismatch)
        const gain     = isFinite(detector) ? linked.out - detector : -Infinity
        const outL = isFinite(inL) ? inL + gain : -Infinity
        const outR = isFinite(inR) ? inR + gain : -Infinity
        const out  = Math.max(outL, outR)
        result = { ...linked, out, health: getHealth(out), outL, outR, inL, inR, portOutputs: undefined }
        portSignal.set(`${node.id}:out-l`, outL)
        portSignal.set(`${node.id}:out-r`, outR)
      } else if (stereo) {
        // Run the node once per side; each output port gets its side's value
        const left  = runSide('l')
        const right = runSide('r')
        const out   = Math.max(left.out, right.out)
        result = {
          ...left,
          out, health: getHealth(out),
          outL: left.out, outR: right.out,
          inL: gather('l').signals[0] ?? -Infinity,
          inR: gather('r').signals[0] ?? -Infinity,
          portOutputs: undefined,
        }
        for (const port of ports.outputs) {
          const side = portSide(port.id) === 'r' ? right : left
          portSignal.set(`${node.id}:${port.id}`, portValue(side, basePortId(port.id)))
        }
      } else {
        result = runSide(null)
        for (const port of ports.outputs) portSignal.set(`${node.id}:${port.id}`, portValue(result, port.id))
      }

      stages[node.id] = result
      inputDb[node.id] = stereo ? (result.inL ?? -Infinity) : (gather(null).signals[0] ?? -Infinity)

      // Teaching hints for buses: stereo folded into a mono bus, or mono spread onto a stereo bus
      if (MULTI_WIRE_TYPES.has(node.typeKey)) {
        const fromStereo = incoming.some((e) => portSide(e.sourceHandle) !== null)
        const fromMono   = incoming.some((e) => portSide(e.sourceHandle) === null)
        busNotes[node.id] = {
          foldedStereo: !stereo && fromStereo,
          monoOnStereo: stereo && fromMono,
        }
      }

      // Audio interface: show L / R from the stereo wires plugged into it (mono wires count on both)
      if (node.typeKey === 'audio-interface' && !result.warning) {
        const lInputs: number[] = []
        const rInputs: number[] = []
        for (const edge of incoming) {
          const side = portSide(edge.sourceHandle)
          if (side !== 'r') lInputs.push(wireDb(edge))
          if (side !== 'l') rInputs.push(wireDb(edge))
        }
        result.outL = sumSignalsToDb(lInputs)
        result.outR = sumSignalsToDb(rInputs)
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

    return { stages, inputDb, portSignal, busNotes, overallHealth, warnings: warns }
  }
}
