// Node type registry — single source of truth for port definitions and defaults.
// No imports from the rest of the app (only the level type); safe to import from anywhere.

import type { ComplexityLevel } from './levels'

export type NodePort = {
  id: string
  /** Tooltip of the port */
  label: string
}

export type NodeCategory = 'source' | 'processor' | 'merge' | 'sink'

export type EQBand = {
  freqHz: number
  gainDb: number
  Q?: number
  type?: 'bell' | 'low-shelf' | 'high-shelf'
}

export type NodeParamValue = number | string | boolean | EQBand[]

/**
 * Mono / stereo support. One wire carries a whole stereo signal (Left + Right together).
 * - 'never'    — one channel: a stereo wire arriving here is mixed into one (default)
 * - 'follow'   — passes on whatever it gets: a stereo wire in → a stereo wire out
 * - 'optional' — the card has a Mono | Stereo switch, stored in params.stereo
 * - 'always'   — always two channels, Left and Right
 */
export type StereoSupport = 'never' | 'follow' | 'optional' | 'always'

export type NodeTypeDef = {
  typeKey: string
  inputs: NodePort[]
  outputs: NodePort[]
  category: NodeCategory
  stereo?: StereoSupport
  /** Outputs when the Mono | Stereo switch is on (the Aux Bus splits into L / R). */
  stereoOutputs?: NodePort[]
  defaultParams: Record<string, NodeParamValue>
}

// Graph node — the authoritative model for Phase 2+ rendering.
export type SignalNode = {
  id: string
  typeKey: string
  position: { x: number; y: number }
  params: Record<string, NodeParamValue>
  bypassed: boolean
  label?: string
  color?: string
}

// Graph edge — connects an output port of one node to an input port of another.
export type SignalEdge = {
  id: string
  source: string       // node id
  sourceHandle: string // port id, e.g. 'out' | 'out-1' | 'out-2'
  target: string
  targetHandle: string // port id, e.g. 'in' | 'in-1'
  // Optional intermediate corner points in flow coordinates.
  // When present, the wire follows these waypoints instead of a plain two-point elbow.
  waypoints?: { x: number; y: number }[]
}

export const NODE_REGISTRY: Record<string, NodeTypeDef> = {
  mic: {
    typeKey: 'mic',
    inputs: [],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'source',
    defaultParams: { sensitivityDb: -60 },
  },
  'line-in': {
    typeKey: 'line-in',
    inputs: [],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'source',
    stereo: 'optional',
    defaultParams: { levelDb: -10, stereo: false },
  },
  instrument: {
    typeKey: 'instrument',
    inputs: [],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'source',
    defaultParams: { levelDb: -30 },
  },
  gain: {
    typeKey: 'gain',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'processor',
    stereo: 'follow',
    // The first Gain after a microphone is its Preamp (preampDb, 0…+60 dB);
    // anywhere else it is a plain gain stage (gainDb, −∞…+20 dB). Each mode keeps its own setting.
    defaultParams: { preampDb: 40, gainDb: 0 },
  },
  hpf: {
    typeKey: 'hpf',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { cutoffHz: 80 },
  },
  eq: {
    typeKey: 'eq',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: {
      bands: [
        { freqHz: 200,  gainDb: 0, Q: 1.4, type: 'bell' },
        { freqHz: 500,  gainDb: 0, Q: 1.4, type: 'bell' },
        { freqHz: 1000, gainDb: 0, Q: 1.4, type: 'bell' },
        { freqHz: 8000, gainDb: 0, Q: 1.4, type: 'bell' },
      ] as EQBand[],
    },
  },
  comp: {
    typeKey: 'comp',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'processor',
    stereo: 'follow',
    // Attack / Release are shown on the card but do not change the sound yet
    defaultParams: { thresholdDb: -20, ratio: 2, makeupGainDb: 0, attackMs: 10, releaseMs: 100 },
  },
  fader: {
    typeKey: 'fader',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { faderDb: 0 },
  },
  switch: {
    typeKey: 'switch',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { on: true },
  },
  amp: {
    typeKey: 'amp',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { gainDb: 0 },
  },
  'di-box': {
    typeKey: 'di-box',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [
      { id: 'out', label: 'XLR Out' },
      { id: 'direct', label: 'Direct Out' },
    ],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { groundLift: false },
  },
  'noise-gate': {
    typeKey: 'noise-gate',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'processor',
    stereo: 'follow',
    // Range sets how far it turns down when closed; Hold / Attack / Release are shown, not simulated
    defaultParams: { thresholdDb: -40, rangeDb: -80, holdMs: 50, attackMs: 1, releaseMs: 100 },
  },
  limiter: {
    typeKey: 'limiter',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { thresholdDb: -3, makeupGainDb: 0 },
  },
  pad: {
    typeKey: 'pad',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { engaged: true },
  },
  deesser: {
    typeKey: 'deesser',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { thresholdDb: -20, frequencyHz: 6000 },
  },
  relay: {
    typeKey: 'relay',
    inputs: [
      { id: 'in-a', label: 'Input A' },
      { id: 'in-b', label: 'Input B' },
    ],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { selectedInput: 'a' },
  },
  pan: {
    typeKey: 'pan',
    inputs: [{ id: 'in', label: 'Input' }],
    // Always a stereo wire out. A mono wire in = Pan knob; a stereo wire in = Balance knob.
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { panPosition: 50 },
  },
  'audio-interface': {
    typeKey: 'audio-interface',
    inputs: [], // dynamic at runtime — one per connected channel
    outputs: [],
    category: 'sink',
    defaultParams: {},
  },
  adc: {
    typeKey: 'adc',
    inputs: [{ id: 'in', label: 'Analog In' }],
    outputs: [{ id: 'out', label: 'Digital Out' }],
    category: 'processor',
    stereo: 'follow',
    // alignmentDb: how far below the digital ceiling unity sits (EBU R68: 0 dBu = −18 dBFS,
    // so 0 dBFS = +18 dBu). dBFS = dBu − alignmentDb.
    defaultParams: { alignmentDb: 18 },
  },
  dac: {
    typeKey: 'dac',
    inputs: [{ id: 'in', label: 'Digital In' }],
    outputs: [{ id: 'out', label: 'Analog Out' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { alignmentDb: 18 },
  },
  'master-bus': {
    typeKey: 'master-bus',
    // Always stereo. The input accepts any number of wires; they are added together.
    // The mix leaves on two wires: Left and Right.
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [
      { id: 'out-l', label: 'Left Out' },
      { id: 'out-r', label: 'Right Out' },
    ],
    category: 'merge',
    stereo: 'always',
    defaultParams: { faderDb: 0 },
  },
  'aux-bus': {
    typeKey: 'aux-bus',
    // The input accepts any number of wires; they are added together.
    // Mono: one output. Stereo: Left and Right outputs.
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    stereoOutputs: [
      { id: 'out-l', label: 'Left Out' },
      { id: 'out-r', label: 'Right Out' },
    ],
    category: 'merge',
    stereo: 'optional',
    defaultParams: { faderDb: 0, stereo: false },
  },
  'matrix-bus': {
    typeKey: 'matrix-bus',
    // A bus of buses, always stereo: only finished mixes go in, after their fader — a stereo bus
    // through its Matrix send (one stereo wire), a mono Aux Bus through its output or its fader.
    // One send knob per bus (params `send-<busId>`, audio taper, 75 = full level).
    // A mono bus lands on both sides at full level.
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [
      { id: 'out-l', label: 'Left Out' },
      { id: 'out-r', label: 'Right Out' },
    ],
    category: 'merge',
    stereo: 'always',
    defaultParams: { faderDb: 0 },
  },
  'graphic-eq': {
    typeKey: 'graphic-eq',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [{ id: 'out', label: 'Output' }],
    category: 'processor',
    stereo: 'follow',
    // b0..b30 = gain of each of the 31 one-third-octave bands, 20 Hz … 20 kHz (eqMath GEQ_CENTERS)
    defaultParams: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`b${i}`, 0])),
  },
  speaker: {
    typeKey: 'speaker',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [],
    category: 'sink',
    // Passive speaker — requires a power amplifier (amp node) upstream to produce sound
    defaultParams: { outputTrimDb: 0 },
  },
  'active-speaker': {
    typeKey: 'active-speaker',
    inputs: [{ id: 'in', label: 'Input' }],
    outputs: [],
    category: 'sink',
    // Active/powered speaker — has built-in amplification, works directly from line level
    defaultParams: { volumeDb: 0 },
  },
}

/**
 * Params of a node dropped on the canvas at this level. The Equalizer below Advanced works like a
 * simple mixing desk's: Low and High are shelves and cannot be switched. Advanced starts with bells
 * and lets you choose.
 */
export function initialParams(
  typeKey: string,
  level: ComplexityLevel,
): Record<string, NodeParamValue> {
  const params = { ...NODE_REGISTRY[typeKey]?.defaultParams }
  if (typeKey === 'eq' && level !== 'advanced') {
    params.bands = (params.bands as EQBand[]).map((b, i): EQBand =>
      i === 0 ? { ...b, type: 'low-shelf' } : i === 3 ? { ...b, type: 'high-shelf' } : b)
  }
  return params
}

// ── Reading params ─────────────────────────────────────────────────────────────

/**
 * The type of every setting a node can have. The ones that may be `undefined` have no default:
 * they are written the first time they are changed.
 */
export interface ParamTypes {
  sensitivityDb: number
  levelDb: number
  /** The Mono | Stereo switch (Line In, Aux Bus) */
  stereo: boolean
  preampDb: number
  gainDb: number
  /** A stereo Amplifier's Right volume; until it is turned, it follows gainDb */
  gainDbR: number | undefined
  cutoffHz: number
  bands: EQBand[]
  thresholdDb: number
  ratio: number
  makeupGainDb: number
  attackMs: number
  releaseMs: number
  holdMs: number
  rangeDb: number
  frequencyHz: number
  faderDb: number
  on: boolean
  engaged: boolean
  groundLift: boolean
  selectedInput: 'a' | 'b'
  panPosition: number
  alignmentDb: number
  outputTrimDb: number
  volumeDb: number
  /** Graphic EQ: Left (or only) side's band gains, b0 … b30 */
  [band: `b${number}`]: number
  /** Graphic EQ: Right side's band gains; until the right side is touched, they follow the left */
  [band: `r${number}`]: number | undefined
  /** Matrix Bus: one send knob per bus (matrixSendParam); until it is turned, it sits at unity */
  [send: `send-${string}`]: number | undefined
}

export type ParamKey = keyof ParamTypes

/** A node's setting: its own value, else its type's default. */
export function param<K extends ParamKey>(
  node: Pick<SignalNode, 'typeKey' | 'params'>,
  key: K,
): ParamTypes[K] {
  return (node.params[key] ?? NODE_REGISTRY[node.typeKey]?.defaultParams[key]) as ParamTypes[K]
}

// ── Mono / stereo ports ────────────────────────────────────────────────────────

// Bypassing these makes no sense — the control itself is the state, or the node is a source / end point
const NO_BYPASS_TYPES = new Set([
  'mic', 'line-in', 'instrument', 'speaker', 'active-speaker', 'amp',
  'fader', 'switch', 'gain', 'relay', 'pan', 'adc', 'dac', 'pad',
  'master-bus', 'matrix-bus', 'audio-interface',
])

/** Can this element be bypassed (On / Off)? */
export function canBypass(typeKey: string): boolean {
  return !NO_BYPASS_TYPES.has(typeKey)
}

/** Bus types whose inputs accept any number of wires (they are added together). */
export const MULTI_WIRE_TYPES = new Set(['master-bus', 'aux-bus', 'matrix-bus'])

/** Buses whose outputs are mixes a Matrix Bus may take. */
export const MIX_BUS_TYPES = new Set(['master-bus', 'aux-bus'])

/**
 * A one-input card that passes on what it gets (an EQ, a compressor, a pad, a fader …): walks up a
 * chain (graph/queries.ts) go through these and stop at anything else — a source, a bus, a Relay.
 */
export function passesThrough(typeKey: string): boolean {
  const def = NODE_REGISTRY[typeKey]
  return def?.stereo === 'follow' && def.inputs.length === 1
}

/** True when this node's own setting is stereo (Mono | Stereo switch on, or always stereo). */
export function isNodeStereo(node: Pick<SignalNode, 'typeKey' | 'params'>): boolean {
  const support = NODE_REGISTRY[node.typeKey]?.stereo ?? 'never'
  if (support === 'always') return true
  return support === 'optional' && node.params.stereo === true
}

/** A bus that sends its mix out as Left and Right: the Master, or an Aux set to Stereo. */
export function isStereoBus(node: Pick<SignalNode, 'typeKey' | 'params'>): boolean {
  return MULTI_WIRE_TYPES.has(node.typeKey) && isNodeStereo(node)
}

/** Which side a bus output carries: 'l' / 'r' for Left / Right outputs, null otherwise. */
export function portSide(portId: string): 'l' | 'r' | null {
  if (portId.endsWith('-l')) return 'l'
  if (portId.endsWith('-r')) return 'r'
  return null
}

/** The bus output that carries the whole stereo mix while a Main Fader is attached. */
export const MIX_PORT = 'mix'

/**
 * A stereo bus's (or its Main Fader's) send to Matrix Buses: Left and Right together on one wire,
 * after the fader. It shows below the R output once a wire uses it.
 */
export const MATRIX_PORT = 'send'

/**
 * Cards that take a stereo mix's Left / Right outputs over when wired to one of them, and send
 * L and R out separately: the Fader after a bus (Main Fader), the Graphic EQ and the Amplifier
 * (a two-channel amp). The Graphic EQ and the Amplifier do it for any stereo wire; fed one
 * channel they stay single-channel.
 */
export const SPLIT_TYPES = new Set(['fader', 'graphic-eq', 'amp'])

/** Param key of a Matrix Bus send knob (`key`: the bus it is for, graph/queries.ts matrixSendKey). */
export function matrixSendParam(key: string): `send-${string}` {
  return `send-${key}`
}
