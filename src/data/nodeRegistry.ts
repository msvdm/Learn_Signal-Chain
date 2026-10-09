// Node type registry — single source of truth for every element type: ports, defaults, levels.
// No imports from the rest of the app (only the levels); safe to import from anywhere.

import type { ComplexityLevel } from './levels'
import { atLeast } from './levels'

/** A connection point. */
export type NodePort = {
  id: string
  /**
   * Its port line (0 = the first, PORT_TOP; one PORT_GAP apart), when not its place in the
   * stack: the Relay Switch's inputs on lines 0 and 2, its output centred between them on 1
   */
  row?: number
}

/** The port line of each port of a stack (its `row`, else its place). */
export function portRows(ports: NodePort[]): number[] {
  return ports.map((port, i) => port.row ?? i)
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
  | 'mic' | 'line-in' | 'instrument' | 'guitar-amp' | 'generator'
  | 'gain' | 'hpf' | 'eq' | 'graphic-eq' | 'comp' | 'noise-gate' | 'limiter' | 'deesser' | 'pad'
  | 'di-box' | 'amp' | 'fader' | 'switch' | 'relay' | 'pan' | 'adc' | 'dac'
  | 'master-bus' | 'aux-bus' | 'matrix-bus'
  | 'speaker' | 'active-speaker' | 'headphones'

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
   * separately: the Graphic EQ and the Amplifier (a two-channel amp) for any stereo wire (`true`;
   * fed one channel they stay single-channel); the Fader (Main Fader) and the Limiter only for a
   * bus's mix (`'mix'`: a stereo channel through them stays one wire).
   */
  splits?: true | 'mix'
  /**
   * A dynamics card (Compressor, Noise Gate, Limiter, De-esser): a level curve that turns its signal
   * down. In stereo it runs linked: the louder side decides, both sides get the same change.
   */
  dynamics?: true
  /** Drawn as a bare control, not a card (FreeControl): its usual size, for drop previews. */
  freeSize?: Size
  /**
   * A card's size, the same at every level (its content grows to fill it); none: the usual minimum
   * (CARD_MIN_W × CARD_MIN_H in utils/layoutHelpers.ts). A face-only card's upright meter adds its
   * room to the width (NodeWrapper).
   */
  minSize?: Size
}

// Graph node — the authoritative model: what the user built (the store holds them).
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

/** A DI Box's Direct Out: the instrument passed on unchanged, for a guitar amp (its XLR Out is 'out'). */
export const DI_DIRECT_PORT = 'direct'

/** A Guitar Amp's sound in the room: a dotted wire that only a microphone can take. */
export const SOUND_PORT = 'sound'

/**
 * What a Microphone picks up (param `character`): someone speaking, someone singing, or drums; what
 * a Line Input plays: music or drums. Drums' hits reach far above their average. Chosen from
 * Intermediate up; at Beginner a Microphone hears speech and a Line Input plays music (the first of each).
 */
export const MIC_CHARACTERS = ['speech', 'singing', 'drums'] as const
export const LINE_CHARACTERS = ['music', 'drums'] as const
export type Character = typeof MIC_CHARACTERS[number] | typeof LINE_CHARACTERS[number]

/** The choices of a Microphone or Line Input. */
export const CHARACTERS_OF = { mic: MIC_CHARACTERS, 'line-in': LINE_CHARACTERS } as const satisfies Partial<Record<TypeKey, readonly Character[]>>

/** The easiest level whose Microphones and Line Inputs show what they pick up. */
export const CHARACTER_LEVEL: ComplexityLevel = 'intermediate'

/** What the Generator plays (param `sound`): a steady tone, hiss, short pulses. */
export const GENERATOR_SOUNDS = ['sine', 'noise', 'click'] as const
export type GeneratorSound = typeof GENERATOR_SOUNDS[number]

const IN: NodePort[]    = [{ id: 'in' }]
const OUT: NodePort[]   = [{ id: 'out' }]
const SIDES: NodePort[] = [
  { id: 'out-l' },
  { id: 'out-r' },
]
// The cards' sizes (minSize): what they were with the readings under them at Intermediate, now the
// same at every level, their content grown into the room (2026-10-08). The mixing buses are big
// enough that their long names stay big in overview.
const BUS_SIZE: Size  = { w: 398, h: 361 }
const FACE_SIZE: Size = { w: 320, h: 328 }
// Microphone and Line Input: one size
const SOURCE_SIZE: Size = { w: 320, h: 350 }
const DYNAMICS_SIZE: Size = { w: 618, h: 366 }

export const NODE_REGISTRY: Record<TypeKey, NodeTypeDef> = {
  mic: {
    // Its input is the sound it hears: a Guitar Amp's Sound (SOUND_PORT), nothing else
    category: 'source', inputs: IN, outputs: OUT, stereo: 'never',
    minLevel: 'beginner', bypass: false, minSize: SOURCE_SIZE,
    defaultParams: { sensitivityDb: -60, character: 'speech' },
  },
  'line-in': {
    category: 'source', inputs: [], outputs: OUT, stereo: 'optional',
    minLevel: 'beginner', bypass: false, minSize: SOURCE_SIZE,
    defaultParams: { levelDb: -10, stereo: false, character: 'music' },
  },
  instrument: {
    category: 'source', inputs: [], outputs: OUT, stereo: 'never',
    minLevel: 'beginner', bypass: false, minSize: FACE_SIZE,
    defaultParams: { levelDb: -30 },
  },
  generator: {
    // A test sound of its own, at the level its knob sets (0 dBu: unity); Stereo: the same on both sides
    category: 'source', inputs: [], outputs: OUT, stereo: 'optional',
    minLevel: 'intermediate', bypass: false, minSize: { w: 320, h: 285 },
    defaultParams: { sound: 'sine', levelDb: 0, stereo: false },
  },
  gain: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'beginner', bypass: false, freeSize: { w: 217, h: 285 },
    // The first Gain after a microphone is its Preamp (preampDb, 0…+60 dB);
    // anywhere else it is a plain gain stage (gainDb, −∞…+20 dB). Each mode keeps its own setting.
    defaultParams: { preampDb: 40, gainDb: 0 },
  },
  hpf: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: true, minSize: { w: 320, h: 268 },
    defaultParams: { cutoffHz: 80 },
  },
  eq: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: true, minSize: { w: 410, h: 361 },
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
    minLevel: 'intermediate', bypass: true, minSize: DYNAMICS_SIZE, dynamics: true,
    // Attack / Release: how fast it turns down and lets go (audio/processors.ts)
    defaultParams: { thresholdDb: -20, ratio: 2, makeupGainDb: 0, attackMs: 10, releaseMs: 100 },
  },
  'noise-gate': {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: true, minSize: DYNAMICS_SIZE, dynamics: true,
    // Range sets how far it turns down when closed; Hold / Attack / Release: how long it stays open,
    // how fast it opens and closes (audio/processors.ts)
    defaultParams: { thresholdDb: -40, rangeDb: -80, holdMs: 50, attackMs: 1, releaseMs: 100 },
  },
  limiter: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: true, minSize: { w: 618, h: 361 }, dynamics: true, splits: 'mix',
    defaultParams: { thresholdDb: -3, makeupGainDb: 0 },
  },
  deesser: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: true, minSize: { w: 412, h: 361 }, dynamics: true,
    defaultParams: { thresholdDb: -20, frequencyHz: 6000 },
  },
  pad: {
    // A bare button like the On Off Switch (D11), with its name under it
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: false, freeSize: { w: 162, h: 188 },
    defaultParams: { engaged: true },
  },
  'di-box': {
    // XLR Out ('out') brings an instrument down to mic level, for a Preamp; Direct Out passes it on
    // unchanged, for a guitar amp (signal/process.ts DI_DROP_DB, graph/queries.ts)
    category: 'processor', inputs: IN, stereo: 'follow',
    outputs: [
      { id: 'out' },
      { id: DI_DIRECT_PORT },
    ],
    minLevel: 'beginner', bypass: true,
    defaultParams: { groundLift: false },
  },
  'guitar-amp': {
    // Fed a guitar (instrument level), it plays it out loud: its Sound reaches only a microphone
    category: 'processor', inputs: IN, outputs: [{ id: SOUND_PORT }], stereo: 'never',
    minLevel: 'intermediate', bypass: false, minSize: FACE_SIZE,
    // Its Volume knob goes to 11 (signal/process.ts guitarAmpGainDb)
    defaultParams: { volume: 5 },
  },
  amp: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'advanced', bypass: false, minSize: { w: 412, h: 361 }, splits: true,
    defaultParams: { gainDb: 0 },
  },
  fader: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'beginner', bypass: false, splits: 'mix', freeSize: { w: 198, h: 582 },
    defaultParams: { faderDb: 0 },
  },
  switch: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: false, freeSize: { w: 162, h: 167 },
    defaultParams: { on: true },
  },
  relay: {
    // The Relay Switch: two inputs, A (in-a, top) and B (in-b), one goes out — an aux send's
    // pre-fader (A) or post-fader (B) copy, say
    category: 'processor', stereo: 'follow',
    inputs: [
      { id: 'in-a', row: 0 },
      { id: 'in-b', row: 2 },
    ],
    // Centred between them, straight out of the switch's pivot
    outputs: [{ id: 'out', row: 1 }],
    minLevel: 'intermediate', bypass: false, minSize: { w: 240, h: 196 },
    defaultParams: { selectedInput: 'a' },
  },
  pan: {
    // Always a stereo wire out. A mono wire in = Pan knob; a stereo wire in = Balance knob.
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    minLevel: 'intermediate', bypass: false, freeSize: { w: 232, h: 308 },
    defaultParams: { panPosition: 50 },
  },
  adc: {
    category: 'processor', stereo: 'follow',
    inputs: [{ id: 'in' }],
    outputs: [{ id: 'out' }],
    minLevel: 'advanced', bypass: false, minSize: { w: 320, h: 218 },
    // alignmentDb: how far below the digital ceiling unity sits (EBU R68: 0 dBu = −18 dBFS,
    // so 0 dBFS = +18 dBu). dBFS = dBu − alignmentDb.
    defaultParams: { alignmentDb: 18 },
  },
  dac: {
    category: 'processor', stereo: 'follow',
    inputs: [{ id: 'in' }],
    outputs: [{ id: 'out' }],
    minLevel: 'advanced', bypass: false, minSize: { w: 320, h: 259 },
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
    minLevel: 'intermediate', bypass: true, minSize: { w: 398, h: 397 },
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
    minLevel: 'advanced', bypass: false, minSize: FACE_SIZE,
    defaultParams: { outputTrimDb: 0 },
  },
  'active-speaker': {
    // Active/powered speaker — has built-in amplification, works directly from line level
    category: 'sink', inputs: IN, outputs: [], stereo: 'never',
    minLevel: 'beginner', bypass: false, minSize: FACE_SIZE,
    defaultParams: { volumeDb: 0 },
  },
  headphones: {
    // Works as an Active Speaker does (amplifier built in): there to show where a listener plugs in
    category: 'sink', inputs: IN, outputs: [], stereo: 'never',
    minLevel: 'beginner', bypass: false, minSize: FACE_SIZE,
    defaultParams: { volumeDb: 0 },
  },
}

/** True for a type this version of the app knows (a saved file may hold newer ones). */
export function isTypeKey(key: string): key is TypeKey {
  return Object.hasOwn(NODE_REGISTRY, key)
}

/** Is this element in the palette at this level? */
export function availableAt(typeKey: TypeKey, level: ComplexityLevel): boolean {
  return atLeast(level, NODE_REGISTRY[typeKey].minLevel)
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
  /** Microphone, Line Input: what it picks up (CHARACTERS_OF) */
  character: Character
  /** Generator: what it plays (GENERATOR_SOUNDS) */
  sound: GeneratorSound
  /** The Mono | Stereo switch (Line In, Generator, Aux Bus) */
  stereo: boolean
  preampDb: number
  gainDb: number
  /** A stereo Amplifier's channel B (the right side) volume; until it is turned, it follows gainDb (channel A) */
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
  /** Guitar Amp: its Volume knob, 0 … 11 (GUITAR_AMP_MAX) */
  volume: number
  /** Graphic EQ: Left (or only) side's band gains, b0 … b30 */
  [band: `b${number}`]: number
  /** Graphic EQ: Right side's band gains; until the right side is touched, they follow the left */
  [band: `r${number}`]: number | undefined
  /** Matrix Bus: one send knob per bus (matrixSendParam); until it is turned, it sits at unity */
  [send: `send-${string}`]: number | undefined
}

export type ParamKey = keyof ParamTypes

/** Settings that take one of a few words: any other word (from a file) falls back to the default. */
const PARAM_CHOICES: Partial<Record<string, readonly string[]>> = {
  sound:         GENERATOR_SOUNDS,
  selectedInput: ['a', 'b'],
}

/** The words a type's setting can take (undefined: it is not a word). */
export function paramChoices(typeKey: TypeKey, key: string): readonly string[] | undefined {
  if (key === 'character') return (CHARACTERS_OF as Partial<Record<TypeKey, readonly string[]>>)[typeKey] ?? []
  return PARAM_CHOICES[key]
}

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

/** A Compressor, Noise Gate, Limiter or De-esser: a level curve, linked in stereo (NodeTypeDef `dynamics`). */
export function isDynamics(typeKey: TypeKey): boolean {
  return NODE_REGISTRY[typeKey].dynamics === true
}

/** A Fader, Limiter, Graphic EQ or Amplifier: takes a stereo mix's L / R over (NodeTypeDef `splits`). */
export function canSplit(typeKey: TypeKey): boolean {
  return NODE_REGISTRY[typeKey].splits !== undefined
}

/** A Fader or Limiter: takes L / R over only from a bus's mix (NodeTypeDef `splits: 'mix'`). */
export function splitsOnlyMix(typeKey: TypeKey): boolean {
  return NODE_REGISTRY[typeKey].splits === 'mix'
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
