import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import type { Translations } from '../i18n/translations'
import type { SignalNode, SignalEdge, EQBand } from '../data/nodeRegistry'
import {
  NODE_REGISTRY, MULTI_WIRE_TYPES, MATRIX_INPUTS, MATRIX_OUTPUTS,
  getPorts, portSide, isNodeStereo, mixBusOf, preampMicOf, matrixParam,
} from '../data/nodeRegistry'
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
  stereoIn?: boolean                // a stereo wire comes in (two input meter bars)
  stereoOut?: boolean               // the node sends out Left and Right (two output meter bars)
  mainFader?: boolean               // a Fader on a bus's Mix output: controls the whole mix
  preamp?: boolean                  // a Gain after a microphone: lifts it up to line level
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

// Audio-taper knob position (0–100), used by the Matrix knobs.
// 0 = fully CCW → −∞,  75 = unity (0 dB),  100 = fully CW (+10 dB).
// Below unity: log taper (−60 dB/octave feel). Above unity: linear boost to +10 dB.
export function taperToDb(position: number): number {
  if (position <= 0) return -Infinity
  const t = position / 100
  if (t <= 0.75) {
    const normalized = t / 0.75                          // 0 → 1 as the knob goes CCW → unity
    return 60 * Math.log10(Math.max(normalized, 0.0001)) // −∞ → 0 dB
  }
  return ((t - 0.75) / 0.25) * 10                       // 0 → +10 dB above unity
}

/** A Gain (not a Preamp) turned all the way down is switched off. */
export const GAIN_OFF_DB = -60

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

// ── What a wire carries ───────────────────────────────────────────────────────

/**
 * - mono:   one channel. On a stereo bus it lands on both sides at full level.
 * - stereo: Left and Right together on one wire.
 * - left / right: one side of a stereo mix (a bus's L / R output). It keeps its side
 *   through effects and lands only on that side of a stereo bus.
 */
export type WireKind = 'mono' | 'stereo' | 'left' | 'right'

/** mono: l = r = its level · left: r = −∞ · right: l = −∞ · stereo: both sides. */
export interface WireSignal {
  kind: WireKind
  l: number
  r: number
}

const SILENT_WIRE: WireSignal = { kind: 'mono', l: -Infinity, r: -Infinity }

/** A one-channel wire (mono, left or right) at level `db`. */
function oneChannelWire(kind: Exclude<WireKind, 'stereo'>, db: number): WireSignal {
  return { kind, l: kind === 'right' ? -Infinity : db, r: kind === 'left' ? -Infinity : db }
}

/** The wire as one channel: a stereo wire's two sides are added (about +6 dB when they match). */
function foldToMono(w: WireSignal): number {
  return w.kind === 'mono' ? w.l : sumSignalsToDb([w.l, w.r])
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
  opts: { preamp?: boolean } = {},
): StageResult | CompressorResult | DeesserResult {
  const input = inputSignals[0] ?? -Infinity
  const p = node.params
  const domain = inputDomain // most nodes pass domain through unchanged

  // Domain mismatch in bus nodes — cannot sum analog and digital signals
  if (domainMismatch && (MULTI_WIRE_TYPES.has(node.typeKey) || node.typeKey === 'audio-interface' || node.typeKey === 'matrix')) {
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
    case 'gain': {
      // Preamp: lifts a microphone up to line level. Gain: turns any signal up or down.
      if (opts.preamp) {
        const out = Math.min(input + ((p.preampDb as number) ?? 40), 20)
        return { out, health: getHealth(out), domain }
      }
      const gainDb = (p.gainDb as number) ?? 0
      const out = gainDb <= GAIN_OFF_DB ? -Infinity : Math.min(input + gainDb, 20)
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
      // A side turned fully off is silent (−∞), not a tiny number
      const sideDb = (g: number) => (isFinite(input) && g > 1e-6 ? input + 20 * Math.log10(g) : -Infinity)
      const outL = sideDb(leftGain)
      const outR = sideDb(rightGain)
      const out  = isFinite(input) ? Math.max(outL, outR) : -Infinity
      return { out, health: getHealth(out), domain, outL, outR }
    }
    case 'master-bus':
    case 'aux-bus':
    case 'audio-interface': {
      const summed = sumSignalsToDb(inputSignals)
      const fader = (p.faderDb as number) ?? 0
      const out = isFinite(summed) ? summed + fader : -Infinity
      return { out, health: getHealth(out), domain }
    }
    case 'matrix': {
      // Each output adds up every input, each turned up or down by its own knob
      const portOutputs: Record<string, number> = {}
      for (const o of MATRIX_OUTPUTS) {
        portOutputs[`out-${o}`] = sumSignalsToDb(MATRIX_INPUTS.map((i) => {
          const knobDb = taperToDb((p[matrixParam(i, o)] as number) ?? 75)
          const inDb   = portInputs[`in-${i}`] ?? -Infinity
          return isFinite(knobDb) ? inDb + knobDb : -Infinity
        }))
      }
      const out = Math.max(...Object.values(portOutputs))
      return { out, health: getHealth(out), domain, portOutputs }
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
  /** Level arriving at each node (the left side for stereo nodes; see stage.inL / inR). */
  inputDb: Record<string, number>
  /** What each output carries, keyed `${nodeId}:${portId}`. */
  wires: Map<string, WireSignal>
  /** Loudness of each output (the louder side of a stereo wire), keyed like `wires`. */
  portSignal: Map<string, number>
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
    const wires = new Map<string, WireSignal>()
    const portSignal = new Map<string, number>()
    const stages: Record<string, StageResult | CompressorResult | DeesserResult> = {}
    const inputDb: Record<string, number> = {}
    // Track which node typeKeys exist anywhere upstream of each node
    const upstreamTypes = new Map<string, Set<string>>()
    for (const n of nodes) upstreamTypes.set(n.id, new Set())

    for (const node of sorted) {
      const incoming = edges.filter((e) => e.target === node.id)
      const wireOf   = (e: SignalEdge) => wires.get(`${e.source}:${e.sourceHandle}`) ?? SILENT_WIRE
      const send     = (portId: string, w: WireSignal) => {
        wires.set(`${node.id}:${portId}`, w)
        portSignal.set(`${node.id}:${portId}`, Math.max(w.l, w.r))
      }

      // Accumulate upstream types from all source nodes
      const myUpstream = new Set<string>()
      for (const edge of incoming) {
        const srcTypes = upstreamTypes.get(edge.source) ?? new Set()
        for (const t of srcTypes) myUpstream.add(t)
        const srcNode = nodes.find((n) => n.id === edge.source)
        if (srcNode) myUpstream.add(srcNode.typeKey)
      }
      upstreamTypes.set(node.id, myUpstream)

      const ports    = getPorts(node, { nodes, edges })
      const def      = NODE_REGISTRY[node.typeKey]
      const follows  = def?.stereo === 'follow'
      const selected = (node.params.selectedInput as string) ?? 'a'

      // A "follow" node copies what its wire carries — the Relay follows its selected input
      const driving    = node.typeKey === 'relay'
        ? incoming.find((e) => e.targetHandle === `in-${selected}`)
        : incoming[0]
      const followKind = driving ? wireOf(driving).kind : 'mono'
      const anyStereo  = incoming.some((e) => wireOf(e).kind === 'stereo')

      // Stereo: a bus (or Line In) set to Stereo, or a follow node fed a stereo wire.
      // Mono: everything else — one channel; a stereo wire arriving here is folded into one.
      const isSource = def?.category === 'source'
      // The first Gain after a microphone works as its Preamp
      const preamp   = node.typeKey === 'gain' && preampMicOf(node.id, { nodes, edges }) !== null
      const stereo   = node.typeKey !== 'pan' && (isNodeStereo(node) || (follows && followKind === 'stereo'))

      /**
       * Signals arriving at this node, keyed by input port.
       * side = 'l' / 'r': that side of every wire (a mono wire counts on both sides,
       * a left wire only on the left). side = null: every wire folded into one channel.
       * Several wires on one port are added together.
       */
      const inputsFor = (side: 'l' | 'r' | null) => {
        const grouped: Record<string, number[]> = {}
        for (const e of incoming) {
          const w = wireOf(e)
          if (!grouped[e.targetHandle]) grouped[e.targetHandle] = []
          grouped[e.targetHandle].push(side ? w[side] : foldToMono(w))
        }
        const portInputs: Record<string, number> = {}
        for (const [port, dbs] of Object.entries(grouped)) portInputs[port] = sumSignalsToDb(dbs)
        const signals = ports.inputs.length > 0
          ? ports.inputs.map((p) => portInputs[p.id] ?? -Infinity)
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
        inputDomain = driving ? (stages[driving.source]?.domain ?? 'analog') : 'analog'
        domainMismatch = false
      }

      // Passive speaker requires a power amplifier (amp node) somewhere upstream
      if (node.typeKey === 'speaker' && !myUpstream.has('amp') && incoming.length > 0) {
        const noAmpResult: StageResult = { out: -Infinity, health: 'too-quiet', domain: inputDomain }
        stages[node.id] = noAmpResult
        inputDb[node.id] = inputsFor(null).signals[0] ?? -Infinity
        for (const port of ports.outputs) send(port.id, SILENT_WIRE)
        continue
      }

      // One side (or the only channel) of this node
      const runSide = (side: 'l' | 'r' | null): StageResult | CompressorResult | DeesserResult => {
        const { portInputs, signals } = inputsFor(side)
        if (node.bypassed && incoming.length > 0) {
          const pass = signals[0] ?? -Infinity
          return { out: pass, health: getHealth(pass), domain: inputDomain }
        }
        return computeGraphNode(node, signals, inputDomain, domainMismatch, portInputs, { preamp })
      }

      /** Value of output port `portId` (e.g. 'out', 'direct') from one side's result. */
      const portValue = (r: StageResult, portId: string) => r.portOutputs?.[portId] ?? r.out

      /** Stereo outputs: a bus's L / R outputs each carry one side; any other output carries both. */
      const sendStereo = (left: StageResult, right: StageResult) => {
        for (const port of ports.outputs) {
          const side = portSide(port.id)
          const l = portValue(left, port.id)
          const r = portValue(right, port.id)
          send(port.id, side === 'l' ? oneChannelWire('left', l)
            : side === 'r' ? oneChannelWire('right', r)
            : { kind: 'stereo', l, r })
        }
      }

      let result: StageResult | CompressorResult | DeesserResult

      if (node.typeKey === 'pan') {
        // Mono wire in → Pan knob spreads it over L / R. Stereo wire in → Balance knob.
        let outL: number
        let outR: number
        let inL: number | undefined
        let inR: number | undefined
        if (followKind === 'stereo') {
          inL = inputsFor('l').signals[0] ?? -Infinity
          inR = inputsFor('r').signals[0] ?? -Infinity
          ;({ outL, outR } = node.bypassed
            ? { outL: inL, outR: inR }
            : balanceOutputs((node.params.panPosition as number) ?? 50, inL, inR))
        } else {
          const panned = runSide(null)
          outL = panned.outL ?? panned.out
          outR = panned.outR ?? panned.out
        }
        const out = Math.max(outL, outR)
        result = { out, health: getHealth(out), domain: inputDomain, outL, outR, inL, inR }
        send('out', { kind: 'stereo', l: outL, r: outR })
      } else if (isSource) {
        // Line In set to Stereo sends the same level on both sides
        result = runSide(null)
        if (stereo) {
          result = { ...result, outL: result.out, outR: result.out }
          for (const port of ports.outputs) send(port.id, { kind: 'stereo', l: result.out, r: result.out })
        } else {
          for (const port of ports.outputs) send(port.id, oneChannelWire('mono', portValue(result, port.id)))
        }
      } else if (stereo && LINKED_DYNAMICS.has(node.typeKey) && !node.bypassed) {
        // The louder side drives the detector; the same gain change goes to both sides
        const inL = inputsFor('l').signals[0] ?? -Infinity
        const inR = inputsFor('r').signals[0] ?? -Infinity
        const detector = Math.max(inL, inR)
        const linked   = computeGraphNode(node, [detector], inputDomain, domainMismatch)
        const gain     = isFinite(detector) ? linked.out - detector : -Infinity
        const outL = isFinite(inL) ? inL + gain : -Infinity
        const outR = isFinite(inR) ? inR + gain : -Infinity
        const out  = Math.max(outL, outR)
        result = { ...linked, out, health: getHealth(out), outL, outR, inL, inR, portOutputs: undefined }
        sendStereo({ ...result, out: outL }, { ...result, out: outR })
      } else if (stereo) {
        // Run the node once per side
        const left  = runSide('l')
        const right = runSide('r')
        const out   = Math.max(left.out, right.out)
        result = {
          ...left,
          out, health: getHealth(out),
          outL: left.out, outR: right.out,
          inL: inputsFor('l').signals[0] ?? -Infinity,
          inR: inputsFor('r').signals[0] ?? -Infinity,
          portOutputs: undefined,
        }
        sendStereo(left, right)
      } else {
        // One channel. A follow node keeps the side it was given (a left wire in → a left wire out).
        result = runSide(null)
        const kind = follows && followKind !== 'stereo' ? followKind : 'mono'
        for (const port of ports.outputs) send(port.id, oneChannelWire(kind, portValue(result, port.id)))
      }

      if (node.typeKey === 'fader' && mixBusOf(node.id, { nodes, edges }) !== null) result.mainFader = true
      if (preamp) result.preamp = true
      result.stereoIn  = follows ? followKind === 'stereo' : anyStereo
      result.stereoOut = stereo || node.typeKey === 'pan'
      stages[node.id]  = result
      inputDb[node.id] = stereo ? (result.inL ?? -Infinity) : (inputsFor(null).signals[0] ?? -Infinity)

      // Audio interface: show L / R — each wire adds its left side to L and its right side to R
      if (node.typeKey === 'audio-interface' && !result.warning) {
        result.outL = sumSignalsToDb(incoming.map((e) => wireOf(e).l))
        result.outR = sumSignalsToDb(incoming.map((e) => wireOf(e).r))
      }
    }

    const allHealths = Object.values(stages).map((s) => s.health)
    const overallHealth = worstHealth(allHealths.length > 0 ? allHealths : ['too-quiet'])

    const warns: string[] = []
    for (const node of nodes) {
      const stage = stages[node.id]
      if (!stage) continue
      if (stage.preamp && stage.health === 'too-quiet')
        warns.push(t.warnings.preampTooQuiet)
      if (stage.preamp && stage.health === 'clipping')
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

    return { stages, inputDb, wires, portSignal, overallHealth, warnings: warns }
  }
}
