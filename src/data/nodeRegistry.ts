// Node type registry — single source of truth for every element type: ports, defaults, levels.
// No imports from the rest of the app (only the levels); safe to import from anywhere.

import type { ComplexityLevel } from './levels'
import { LEVELS } from './levels'

/** A connection point. Its tooltip is in the locales (`ports`, utils/nodeName.ts portName). */
export type NodePort = {
  id: string
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

/** Every kind of element on the canvas. */
export type TypeKey =
  | 'mic' | 'line-in' | 'instrument'
  | 'gain' | 'hpf' | 'eq' | 'graphic-eq' | 'comp' | 'noise-gate' | 'limiter' | 'deesser' | 'pad'
  | 'di-box' | 'amp' | 'fader' | 'switch' | 'relay' | 'pan' | 'adc' | 'dac'
  | 'master-bus' | 'aux-bus' | 'matrix-bus'
  | 'speaker' | 'active-speaker'

export type Size = { w: number; h: number }

/**
 * What an element type is and does. Its look (icon, palette group) is in
 * components/nodes/nodeLook.ts, its card in components/nodes/index.ts, what it does to the level in
 * signal/process.ts (PROCESS) — each a table keyed by TypeKey, so a new type missing from one does
 * not compile.
 */
export type NodeTypeDef = {
  /** source: starts a chain (and gives it its colour) · processor · merge: a bus · sink: an end point */
  category: NodeCategory
  inputs: NodePort[]
  outputs: NodePort[]
  stereo: StereoSupport
  /** Outputs when the Mono | Stereo switch is on (the Aux Bus splits into L / R). */
  stereoOutputs?: NodePort[]
  defaultParams: Record<string, NodeParamValue>
  /** The easiest level whose palette has it; every harder level has it too. */
  minLevel: ComplexityLevel
  /**
   * Has an On / Off (bypass) button. Not for sources and end points, nor where the control itself
   * is the state (a fader, a switch, a pad …).
   */
  bypass: boolean
  /**
   * A mixing bus: its input takes any number of wires, added together. 'mix': a Master or Aux Bus,
   * whose mix may feed a Matrix Bus; 'matrix': the Matrix Bus, a bus of buses.
   */
  bus?: 'mix' | 'matrix'
  /**
   * Takes a stereo mix's Left / Right outputs over when wired to one of them, and sends L and R out
   * separately: the Fader after a bus (Main Fader), the Graphic EQ and the Amplifier (a two-channel
   * amp). The Graphic EQ and the Amplifier do it for any stereo wire; fed one channel they stay
   * single-channel.
   */
  splits?: true
  /** Dynamics that run "linked" in stereo: the louder side decides, both sides get the same change. */
  linked?: true
  /** Drawn as a bare control, not a card (FreeControl): its usual size, for drop previews. */
  freeSize?: Size
  /** A card bigger than the usual minimum (CARD_MIN_W × CARD_MIN_H in utils/layoutHelpers.ts). */
  minSize?: Size
}

// Graph node — the authoritative model for Phase 2+ rendering.
export type SignalNode = {
  id: string
  typeKey: TypeKey
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
  sourceHandle: string // port id, e.g. 'out' | 'out-l' | 'mix'
  target: string
  targetHandle: string // port id, e.g. 'in' | 'in-a'
  // Optional intermediate corner points in flow coordinates.
  // When present, the wire follows these waypoints instead of a plain two-point elbow.
  waypoints?: { x: number; y: number }[]
}

const IN: NodePort[]    = [{ id: 'in' }]
const OUT: NodePort[]   = [{ id: 'out' }]
const SIDES: NodePort[] = [
  { id: 'out-l' },
  { id: 'out-r' },
]
// Mixing buses: the size of the Compressor card, so their long names stay big in overview
const BUS_SIZE: Size = { w: 398, h: 298 }

export const NODE_REGISTRY: Record<TypeKey, NodeTypeDef> = {
  mic: {
    category: 'source', inputs: [], outputs: OUT, stereo: 'never',
    minLevel: 'beginner', bypass: false,
    defaultParams: { sensitivityDb: -60 },
  },
  'line-in': {
    category: 'source', inputs: [], outputs: OUT, stereo: 'optional',
    minLevel: 'beginner', bypass: false,
    defaultParams: { levelDb: -10, stereo: false },
  },
  instrument: {
    category: 'source', inputs: [], outputs: OUT, stereo: 'never',
    minLevel: 'beginner', bypass: false,
    defaultParams: { levelDb: -30 },
  },
  gain: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'beginner', bypass: false, freeSize: { w: 162, h: 216 },
    // The first Gain after a microphone is its Preamp (preampDb, 0…+60 dB);
    // anywhere else it is a plain gain stage (gainDb, −∞…+20 dB). Each mode keeps its own setting.
    defaultParams: { preampDb: 40, gainDb: 0 },
  },
  hpf: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: true,
    defaultParams: { cutoffHz: 80 },
  },
  eq: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: true,
    defaultParams: {
      bands: [
        { freqHz: 200,  gainDb: 0, Q: 1.4, type: 'bell' },
        { freqHz: 500,  gainDb: 0, Q: 1.4, type: 'bell' },
        { freqHz: 1000, gainDb: 0, Q: 1.4, type: 'bell' },
        { freqHz: 8000, gainDb: 0, Q: 1.4, type: 'bell' },
      ] as EQBand[],
    },
  },
  'graphic-eq': {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'advanced', bypass: true, splits: true,
    // b0..b30 = gain of each of the 31 one-third-octave bands, 20 Hz … 20 kHz (eqMath GEQ_CENTERS)
    defaultParams: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`b${i}`, 0])),
  },
  comp: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: true, linked: true,
    // Attack / Release are shown on the card but do not change the sound yet
    defaultParams: { thresholdDb: -20, ratio: 2, makeupGainDb: 0, attackMs: 10, releaseMs: 100 },
  },
  'noise-gate': {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: true, linked: true,
    // Range sets how far it turns down when closed; Hold / Attack / Release are shown, not simulated
    defaultParams: { thresholdDb: -40, rangeDb: -80, holdMs: 50, attackMs: 1, releaseMs: 100 },
  },
  limiter: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: true, linked: true,
    defaultParams: { thresholdDb: -3, makeupGainDb: 0 },
  },
  deesser: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: true, linked: true,
    defaultParams: { thresholdDb: -20, frequencyHz: 6000 },
  },
  pad: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: false,
    defaultParams: { engaged: true },
  },
  'di-box': {
    category: 'processor', inputs: IN, stereo: 'follow',
    outputs: [
      { id: 'out' },
      { id: 'direct' },
    ],
    minLevel: 'beginner', bypass: true,
    defaultParams: { groundLift: false },
  },
  amp: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'advanced', bypass: false, splits: true,
    defaultParams: { gainDb: 0 },
  },
  fader: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'beginner', bypass: false, splits: true, freeSize: { w: 198, h: 541 },
    defaultParams: { faderDb: 0 },
  },
  switch: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: false, freeSize: { w: 175, h: 188 },
    defaultParams: { on: true },
  },
  relay: {
    category: 'processor', stereo: 'follow',
    inputs: [
      { id: 'in-a' },
      { id: 'in-b' },
    ],
    outputs: OUT,
    minLevel: 'intermediate', bypass: false,
    defaultParams: { selectedInput: 'a' },
  },
  pan: {
    // Always a stereo wire out. A mono wire in = Pan knob; a stereo wire in = Balance knob.
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: false, freeSize: { w: 232, h: 266 },
    defaultParams: { panPosition: 50 },
  },
  adc: {
    category: 'processor', stereo: 'follow',
    inputs: [{ id: 'in' }],
    outputs: [{ id: 'out' }],
    minLevel: 'advanced', bypass: false,
    // alignmentDb: how far below the digital ceiling unity sits (EBU R68: 0 dBu = −18 dBFS,
    // so 0 dBFS = +18 dBu). dBFS = dBu − alignmentDb.
    defaultParams: { alignmentDb: 18 },
  },
  dac: {
    category: 'processor', stereo: 'follow',
    inputs: [{ id: 'in' }],
    outputs: [{ id: 'out' }],
    minLevel: 'advanced', bypass: false,
    defaultParams: { alignmentDb: 18 },
  },
  'master-bus': {
    // Always stereo. The input accepts any number of wires; they are added together.
    // The mix leaves on two wires: Left and Right.
    category: 'merge', inputs: IN, outputs: SIDES, stereo: 'always', bus: 'mix',
    minLevel: 'intermediate', bypass: false, minSize: BUS_SIZE,
    defaultParams: { faderDb: 0 },
  },
  'aux-bus': {
    // The input accepts any number of wires; they are added together.
    // Mono: one output. Stereo: Left and Right outputs.
    category: 'merge', inputs: IN, outputs: OUT, stereoOutputs: SIDES, stereo: 'optional', bus: 'mix',
    minLevel: 'intermediate', bypass: true, minSize: BUS_SIZE,
    defaultParams: { faderDb: 0, stereo: false },
  },
  'matrix-bus': {
    // A bus of buses, always stereo: only finished mixes go in, after their fader — a stereo bus
    // through its Matrix send (one stereo wire), a mono Aux Bus through its output or its fader.
    // One send knob per bus (params `send-<busId>`, audio taper, 75 = full level).
    // A mono bus lands on both sides at full level.
    category: 'merge', inputs: IN, outputs: SIDES, stereo: 'always', bus: 'matrix',
    minLevel: 'advanced', bypass: false, minSize: BUS_SIZE,
    defaultParams: { faderDb: 0 },
  },
  speaker: {
    // Passive speaker — requires a power amplifier (amp node) upstream to produce sound
    category: 'sink', inputs: IN, outputs: [], stereo: 'never',
    minLevel: 'advanced', bypass: false,
    defaultParams: { outputTrimDb: 0 },
  },
  'active-speaker': {
    // Active/powered speaker — has built-in amplification, works directly from line level
    category: 'sink', inputs: IN, outputs: [], stereo: 'never',
    minLevel: 'beginner', bypass: false,
    defaultParams: { volumeDb: 0 },
  },
}

/** True for a type this version of the app knows (a saved file may hold newer ones). */
export function isTypeKey(key: string): key is TypeKey {
  return Object.hasOwn(NODE_REGISTRY, key)
}

/** Is this element in the palette at this level? */
export function availableAt(typeKey: TypeKey, level: ComplexityLevel): boolean {
  return LEVELS.indexOf(NODE_REGISTRY[typeKey].minLevel) <= LEVELS.indexOf(level)
}

/**
 * Params of a node dropped on the canvas at this level. The Equalizer below Advanced works like a
 * simple mixing desk's: Low and High are shelves and cannot be switched. Advanced starts with bells
 * and lets you choose.
 */
export function initialParams(
  typeKey: TypeKey,
  level: ComplexityLevel,
): Record<string, NodeParamValue> {
  const params = { ...NODE_REGISTRY[typeKey].defaultParams }
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
  return (node.params[key] ?? NODE_REGISTRY[node.typeKey].defaultParams[key]) as ParamTypes[K]
}

// ── Buses, mono / stereo ports ──────────────────────────────────────────────────

/** A mixing bus (Master, Aux, Matrix): its input takes any number of wires, added together. */
export function isBus(typeKey: TypeKey): boolean {
  return NODE_REGISTRY[typeKey].bus !== undefined
}

/** A Master or Aux Bus: its mix may feed a Matrix Bus. */
export function isMixBus(typeKey: TypeKey): boolean {
  return NODE_REGISTRY[typeKey].bus === 'mix'
}

/** A Fader, Graphic EQ or Amplifier: takes a stereo mix's L / R over (NodeTypeDef `splits`). */
export function canSplit(typeKey: TypeKey): boolean {
  return NODE_REGISTRY[typeKey].splits === true
}

/**
 * A one-input card that passes on what it gets (an EQ, a compressor, a pad, a fader …): walks up a
 * chain (graph/queries.ts) go through these and stop at anything else — a source, a bus, a Relay.
 */
export function passesThrough(typeKey: TypeKey): boolean {
  const def = NODE_REGISTRY[typeKey]
  return def.stereo === 'follow' && def.inputs.length === 1
}

/** True when this node's own setting is stereo (Mono | Stereo switch on, or always stereo). */
export function isNodeStereo(node: Pick<SignalNode, 'typeKey' | 'params'>): boolean {
  const support = NODE_REGISTRY[node.typeKey].stereo
  if (support === 'always') return true
  return support === 'optional' && node.params.stereo === true
}

/** A bus that sends its mix out as Left and Right: the Master, or an Aux set to Stereo. */
export function isStereoBus(node: Pick<SignalNode, 'typeKey' | 'params'>): boolean {
  return isBus(node.typeKey) && isNodeStereo(node)
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

/** Param key of a Matrix Bus send knob (`key`: the bus it is for, graph/queries.ts matrixSendKey). */
export function matrixSendParam(key: string): `send-${string}` {
  return `send-${key}`
}
