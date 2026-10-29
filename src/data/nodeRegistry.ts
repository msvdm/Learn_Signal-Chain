// Node type registry — single source of truth for every element type: ports, defaults, levels.
// No imports from the rest of the app (only the levels); safe to import from anywhere.

import type { ComplexityLevel } from './levels'
import { LEVELS } from './levels'

/** A connection point. */
export type NodePort = {
  id: string
  /** Takes any number of wires, added together (an Audio Interface's line input; a bus's input takes them anyway) */
  many?: true
  /**
   * Its port line (0 = the first, PORT_TOP; one PORT_GAP apart), when not its place in the
   * stack: the Relay Switch's inputs on lines 0 and 2, its output centred between them on 1
   */
  row?: number
  /**
   * Halfway down its card's side, not on a port line: a Sound output — the sound leaves the
   * instrument itself, not a socket (the user's call, 2026-10-29)
   */
  middle?: true
  /** Its name, beside its ring (the locales' `ports`): the Guitar Amp's DI Out among its outputs */
  label?: PortLabel
  /** Never drawn, and no hand-drawn wire ends on it: the USB link's way back (graph/usbLink.ts) */
  hidden?: true
  /**
   * Drawn only at these levels (graph/queries.ts drawnPorts): the DAW records at Beginner and
   * Intermediate and plays its song out at Advanced, the Recorder Track's Monitor out is Advanced's
   */
  levels?: readonly ComplexityLevel[]
}

/** The names a port can show beside its ring (the locales' `ports`). */
export type PortLabel = 'diOut'

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
  | 'vocal' | 'drum-kit' | 'acoustic' | 'mic' | 'keyboard' | 'pc' | 'instrument' | 'guitar-amp' | 'generator'
  | 'phantom' | 'gain' | 'hpf' | 'eq' | 'graphic-eq' | 'comp' | 'noise-gate' | 'limiter' | 'deesser' | 'pad'
  | 'di-box' | 'amp' | 'fader' | 'switch' | 'relay' | 'pan' | 'adc' | 'dac'
  | 'master-bus' | 'aux-bus' | 'matrix-bus' | 'pfl-bus'
  | 'speaker' | 'active-speaker' | 'studio-monitor' | 'headphones' | 'recorder' | 'broadcast'
  | 'interface' | 'daw' | 'mixer' | 'stage-box' | 'decoder' | 'encoder'

export type Size = { w: number; h: number }

/**
 * One path through a card whose outputs never meet (NodeTypeDef `routes`): the input it reads, the
 * outputs it sends on, and the type whose job it does on the way. `from` null: it makes its own
 * sound (a DAW plays back); `to` empty: it only takes the signal in (a DAW records).
 */
export type Route = { from: string | null; to: readonly string[]; as: TypeKey }

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
  /**
   * The levels whose palette has it (D20: each level is a scale, so some elements leave at harder
   * levels). What it does never depends on the level, nor its ports — but which of them are drawn
   * (NodePort `levels`: the DAW's and the Recorder's, D23).
   */
  levels: readonly ComplexityLevel[]
  /**
   * Has an On / Off (bypass) button. Not for sources and end points, nor where the control itself
   * is the state (a fader, a switch, a pad …).
   */
  bypass: boolean
  /**
   * A mixing bus: its input takes any number of wires, added together. 'mix': a Master or Aux Bus,
   * whose mix may feed a Matrix Bus; 'matrix': the Matrix Bus, a bus of buses; 'pfl': the PFL Bus,
   * for listening only (no Main Fader, no Matrix).
   */
  bus?: 'mix' | 'matrix' | 'pfl'
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
   * Below Advanced drawn as a bare control, not a card, as on a small desk: the Compressor's one
   * knob (oneKnobComp), the Equalizer's three, the HPF's button. Its usual size there, for drop
   * previews.
   */
  bareSize?: Size
  /**
   * Paths that never meet, each from one input to one output (an Audio Interface records its line
   * input to the computer and, apart from that, plays the computer's sound out; a DAW records what
   * it gets and plays back a sound of its own). The card shows the first in use (signal/chain.ts
   * shownRoute). None: one path, every input into every output. Every input and output is on one
   * route.
   */
  routes?: readonly Route[]
  /** Zoomed out drawn bare at Advanced too (the HPF's button, its click its On / Off) */
  bareZoomedOut?: true
  /**
   * A card's size, the same at every level (its content grows to fill it); none: the usual minimum
   * (CARD_MIN_W × CARD_MIN_H in utils/layoutHelpers.ts). A face-only card's upright meter adds its
   * room to the width (FaceCard).
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

/**
 * The USB link between an Audio Interface and the computer (D22): one wire, drawn from the
 * Interface's TO_PC into a DAW, carries the sound both ways — what the Interface records goes to
 * the DAW, and the DAW plays back on PLAYBACK into the Interface's FROM_PC, along a wire of its own
 * that nobody draws: the store keeps it with the USB wire (graph/usbLink.ts). PLAYBACK and FROM_PC
 * are hidden ports; TO_PC goes only into a DAW (graph/connectionRules.ts).
 */
export const TO_PC_PORT    = 'to-pc'
export const FROM_PC_PORT  = 'from-pc'
export const PLAYBACK_PORT = 'playback'

/** The Mixer's outputs (Beginner): its mix for the room's speakers, and for the wedges on stage. */
export const MIXER_MAIN_PORT    = 'main'
export const MIXER_MONITOR_PORT = 'monitor'

/** A DI Box's Direct Out: the instrument passed on unchanged, for a guitar amp (its XLR Out is 'out'). */
export const DI_DIRECT_PORT = 'direct'

/**
 * A Guitar Amp's DI Out: what it plays, as a balanced mic-level signal for the desk's Preamp — at
 * the same level whatever its Volume (signal/gains.ts AMP_DI_DB, D26).
 */
export const AMP_DI_PORT = 'di-out'

/**
 * Sound in the air — a Vocal's, a Drum Kit's, an Acoustic Instrument's, a Guitar Amp's: a wire of waves
 * that only a microphone can take (D21).
 */
export const SOUND_PORT = 'sound'

/** Their output: Sound, halfway down the card's side */
const SOUND_OUT: NodePort[] = [{ id: SOUND_PORT, middle: true }]

/**
 * What a Vocal does (param `character`): speak or sing. Chosen from Intermediate up; at Beginner it
 * speaks (the first).
 */
export const CHARACTERS = ['speech', 'singing'] as const
export type Character = typeof CHARACTERS[number]

/** A Microphone (param `micType`): dynamic (no power needed) or condenser (more sensitive, needs 48V — D21). */
export const MIC_TYPES = ['dynamic', 'condenser'] as const
export type MicType = typeof MIC_TYPES[number]

/**
 * What an Encoder packs the sound into for a stream (param `format`, D23): three of the formats
 * streams use. Each keeps the level; what they change is how much detail the listener gets.
 */
export const ENCODER_FORMATS = ['mp3', 'aac', 'opus'] as const
export type EncoderFormat = typeof ENCODER_FORMATS[number]

/** The easiest level whose Vocals and Microphones show their choices (Speech | Singing, Dynamic | Condenser). */
export const CHOICE_LEVEL: ComplexityLevel = 'intermediate'

/** What the Generator plays (param `sound`): a steady tone, hiss, short pulses. */
export const GENERATOR_SOUNDS = ['sine', 'noise', 'click'] as const
export type GeneratorSound = typeof GENERATOR_SOUNDS[number]

/** One of the Generator's sounds (made in code, audio/sounds.ts) — not a loop of real sound. */
export function isGeneratorSound(kind: string): kind is GeneratorSound {
  return (GENERATOR_SOUNDS as readonly string[]).includes(kind)
}

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
// The Keyboard's
const SOURCE_SIZE: Size = { w: 320, h: 350 }
// The Microphone's: half a face's each way (the user's call, 2026-10-11) — a small thing on a stand
const MIC_SIZE: Size = { w: 160, h: 164 }
const DYNAMICS_SIZE: Size = { w: 618, h: 366 }

// The levels whose palette shows a type (`levels`)
const EVERY_LEVEL: readonly ComplexityLevel[]       = LEVELS
const FROM_INTERMEDIATE: readonly ComplexityLevel[] = ['intermediate', 'advanced']
const ADVANCED_ONLY: readonly ComplexityLevel[]     = ['advanced']

export const NODE_REGISTRY: Record<TypeKey, NodeTypeDef> = {
  // Sound in the air (D21): each sends it on its Sound output, which only a microphone takes — one
  // may feed several. How loud each is: signal/process.ts SOUND_SPL
  vocal: {
    category: 'source', inputs: [], outputs: SOUND_OUT, stereo: 'never',
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE,
    defaultParams: { character: 'speech' },
  },
  'drum-kit': {
    category: 'source', inputs: [], outputs: SOUND_OUT, stereo: 'never',
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE,
    defaultParams: {},
  },
  acoustic: {
    // An acoustic instrument (a saxophone on its icon; it plays the guitar loop): at Beginner too
    category: 'source', inputs: [], outputs: SOUND_OUT, stereo: 'never',
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE,
    defaultParams: {},
  },
  mic: {
    // Turns the sound it hears (its input: a Sound output, nothing else) into a weak signal (D21):
    // not a source — the chain's colour comes from the sound before it
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'never',
    levels: EVERY_LEVEL, bypass: false, minSize: MIC_SIZE,
    defaultParams: { micType: 'dynamic' },
  },
  // Line-level sources, always stereo (Left and Right on one wire): their level is their own
  keyboard: {
    category: 'source', inputs: [], outputs: OUT, stereo: 'always',
    levels: EVERY_LEVEL, bypass: false, minSize: SOURCE_SIZE,
    defaultParams: { levelDb: -10 },
  },
  pc: {
    category: 'source', inputs: [], outputs: OUT, stereo: 'always',
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE,
    defaultParams: { levelDb: 0 },
  },
  instrument: {
    category: 'source', inputs: [], outputs: OUT, stereo: 'never',
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE,
    defaultParams: { levelDb: -30 },
  },
  generator: {
    // A test sound of its own, at the level its knob sets (0 dBu: unity); Stereo: the same on both sides
    category: 'source', inputs: [], outputs: OUT, stereo: 'optional',
    levels: ADVANCED_ONLY, bypass: false, minSize: { w: 320, h: 285 },
    defaultParams: { sound: 'sine', levelDb: 0, stereo: false },
  },
  decoder: {
    // A stream or a file (MP3, AAC …) unpacked into numbers: a source that is digital from the
    // start (dBFS — DIGITAL_SOURCES in signal/process.ts), playing music. Its peaks at −18 dBFS,
    // EBU's level (the user's call, 2026-10-11): the music's are 12 dB above its average, −30
    category: 'source', inputs: [], outputs: OUT, stereo: 'always',
    levels: ADVANCED_ONLY, bypass: false, minSize: FACE_SIZE,
    defaultParams: { levelDb: -30 },
  },
  phantom: {
    // 48V phantom power: a bare button like the Pad (D21). It passes the signal on unchanged; a
    // condenser microphone before it, ahead of the Preamp, gets its power (graph/queries.ts phantomPowered)
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: FROM_INTERMEDIATE, bypass: false, freeSize: { w: 197, h: 188 },
    defaultParams: { on: true },
  },
  gain: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: FROM_INTERMEDIATE, bypass: false, freeSize: { w: 217, h: 285 },
    // The first Gain after a microphone is its Preamp (preampDb, 0…+60 dB);
    // anywhere else it is a plain gain stage (gainDb, −∞…+20 dB). Each mode keeps its own setting.
    defaultParams: { preampDb: 40, gainDb: 0 },
  },
  hpf: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    // Below Advanced one button at 80 Hz (its On / Off: bypass); zoomed out that button at Advanced too
    levels: FROM_INTERMEDIATE, bypass: true, minSize: { w: 320, h: 268 }, bareSize: { w: 196, h: 216 }, bareZoomedOut: true,
    defaultParams: { cutoffHz: 80 },
  },
  eq: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    // Below Advanced three bare knobs, Low · Mid · High (see initialParams)
    levels: FROM_INTERMEDIATE, bypass: true, minSize: { w: 410, h: 361 }, bareSize: { w: 603, h: 318 },
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
    levels: ADVANCED_ONLY, bypass: true, splits: true,
    // b0..b30 = gain of each of the 31 one-third-octave bands, 20 Hz … 20 kHz (eqMath GEQ_CENTERS)
    defaultParams: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`b${i}`, 0])),
  },
  comp: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: FROM_INTERMEDIATE, bypass: true, minSize: DYNAMICS_SIZE, dynamics: true, bareSize: { w: 273, h: 325 },
    // Attack / Release: how fast it turns down and lets go (audio/processors.ts)
    defaultParams: { thresholdDb: -20, ratio: 2, makeupGainDb: 0, attackMs: 10, releaseMs: 100 },
  },
  'noise-gate': {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: ADVANCED_ONLY, bypass: true, minSize: DYNAMICS_SIZE, dynamics: true,
    // Range sets how far it turns down when closed; Hold / Attack / Release: how long it stays open,
    // how fast it opens and closes (audio/processors.ts)
    defaultParams: { thresholdDb: -40, rangeDb: -80, holdMs: 50, attackMs: 1, releaseMs: 100 },
  },
  limiter: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: ADVANCED_ONLY, bypass: true, minSize: { w: 618, h: 361 }, dynamics: true, splits: 'mix',
    defaultParams: { thresholdDb: -3, makeupGainDb: 0 },
  },
  deesser: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: ADVANCED_ONLY, bypass: true, minSize: { w: 412, h: 361 }, dynamics: true,
    defaultParams: { thresholdDb: -20, frequencyHz: 6000 },
  },
  pad: {
    // A bare button like the On Off Switch (D11), with its name under it
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: FROM_INTERMEDIATE, bypass: false, freeSize: { w: 162, h: 188 },
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
    levels: FROM_INTERMEDIATE, bypass: true,
    defaultParams: { groundLift: false },
  },
  'guitar-amp': {
    // Fed a guitar (instrument level), it plays it out loud: its Sound reaches only a microphone.
    // Its DI Out sends it to the desk at mic level, on the first port line (D26)
    category: 'processor', inputs: IN, stereo: 'never',
    outputs: [SOUND_OUT[0], { id: AMP_DI_PORT, row: 0, label: 'diOut' }],
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE,
    // Its Volume knob goes to 11 (signal/gains.ts guitarAmpGainDb); Ground Lift on its DI Out (D26)
    defaultParams: { volume: 5, groundLift: false },
  },
  amp: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: EVERY_LEVEL, bypass: false, minSize: { w: 412, h: 361 }, splits: true,
    defaultParams: { gainDb: 0 },
  },
  fader: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: FROM_INTERMEDIATE, bypass: false, splits: 'mix', freeSize: { w: 198, h: 582 },
    defaultParams: { faderDb: 0 },
  },
  switch: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: FROM_INTERMEDIATE, bypass: false, freeSize: { w: 162, h: 167 },
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
    levels: FROM_INTERMEDIATE, bypass: false, minSize: { w: 240, h: 196 },
    defaultParams: { selectedInput: 'a' },
  },
  pan: {
    // Always a stereo wire out. A mono wire in = Pan knob; a stereo wire in = Balance knob.
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: FROM_INTERMEDIATE, bypass: false, freeSize: { w: 232, h: 308 },
    defaultParams: { panPosition: 50 },
  },
  adc: {
    category: 'processor', stereo: 'follow',
    inputs: [{ id: 'in' }],
    outputs: [{ id: 'out' }],
    levels: ADVANCED_ONLY, bypass: false, minSize: { w: 320, h: 218 },
    // alignmentDb: how far below the digital ceiling unity sits (EBU R68: 0 dBu = −18 dBFS,
    // so 0 dBFS = +18 dBu). dBFS = dBu − alignmentDb.
    defaultParams: { alignmentDb: 18 },
  },
  dac: {
    category: 'processor', stereo: 'follow',
    inputs: [{ id: 'in' }],
    outputs: [{ id: 'out' }],
    levels: ADVANCED_ONLY, bypass: false, minSize: { w: 320, h: 259 },
    defaultParams: { alignmentDb: 18 },
  },
  encoder: {
    // Packs the digital mix into a stream's format (MP3, AAC, Opus — ENCODER_FORMATS), its level
    // kept. It works on numbers only: fed an analog signal it sends nothing (D23 — encoding is more
    // than converting). Its output goes only into Stream / Broadcast (graph/connectionRules.ts).
    // Always stereo, like what it feeds; a bus's L or R into it is the whole mix (TAKES_WHOLE_MIX)
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'always',
    levels: ADVANCED_ONLY, bypass: false, minSize: { w: 320, h: 259 },
    defaultParams: { format: 'mp3' },
  },
  'master-bus': {
    // Always stereo. The input accepts any number of wires; they are added together.
    // The mix leaves on two wires: Left and Right.
    category: 'merge', inputs: IN, outputs: SIDES, stereo: 'always', bus: 'mix',
    levels: FROM_INTERMEDIATE, bypass: false, minSize: BUS_SIZE,
    defaultParams: { faderDb: 0 },
  },
  'aux-bus': {
    // The input accepts any number of wires; they are added together.
    // Mono: one output. Stereo: Left and Right outputs.
    category: 'merge', inputs: IN, outputs: OUT, stereoOutputs: SIDES, stereo: 'optional', bus: 'mix',
    levels: FROM_INTERMEDIATE, bypass: true, minSize: { w: 398, h: 397 },
    defaultParams: { faderDb: 0, stereo: false },
  },
  'matrix-bus': {
    // A bus of buses, always stereo: only finished mixes go in, after their fader — a stereo bus
    // through its Matrix send (one stereo wire), a mono Aux Bus through its output or its fader.
    // One send knob per bus (params `send-<busId>`, audio taper, 75 = full level).
    // A mono bus lands on both sides at full level.
    category: 'merge', inputs: IN, outputs: SIDES, stereo: 'always', bus: 'matrix',
    levels: ADVANCED_ONLY, bypass: false, minSize: BUS_SIZE,
    defaultParams: { faderDb: 0 },
  },
  'pfl-bus': {
    // PFL (Pre-Fade Listen): what the engineer hears in the headphones — the channels whose PFL
    // button is down (a Switch wired into it). Always stereo, a mono wire on both sides at full
    // level (no Pan); one stereo output and no fader: the Gain before the headphones sets how loud.
    // Never a Main Fader's or a Matrix Bus's
    category: 'merge', inputs: IN, outputs: OUT, stereo: 'always', bus: 'pfl',
    levels: FROM_INTERMEDIATE, bypass: true, minSize: { w: 398, h: 397 },
    defaultParams: {},
  },
  speaker: {
    // Passive speaker — requires a power amplifier (amp node) upstream to produce sound
    category: 'sink', inputs: IN, outputs: [], stereo: 'never',
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE,
    defaultParams: { outputTrimDb: 0 },
  },
  'active-speaker': {
    // Active/powered speaker — has built-in amplification, works directly from line level
    category: 'sink', inputs: IN, outputs: [], stereo: 'never',
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE,
    defaultParams: { volumeDb: 0 },
  },
  'studio-monitor': {
    // Works as an Active Speaker does (amplifier built in): the speakers a studio mixes on. Advanced
    // has the Active Speaker for both
    category: 'sink', inputs: IN, outputs: [], stereo: 'never',
    levels: ['beginner', 'intermediate'], bypass: false, minSize: FACE_SIZE,
    defaultParams: { volumeDb: 0 },
  },
  headphones: {
    // There to show where a listener plugs in: no knob of their own — a Gain right before them sets
    // how loud (the desk's Phones knob); fed by anything else they are silent
    category: 'sink', inputs: IN, outputs: [], stereo: 'never',
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE,
    defaultParams: {},
  },
  recorder: {
    // Records what reaches it, as it is: a stereo wire in two channels, a mono one in one. At
    // Advanced, the Recorder Track (D23), its Monitor out passes on what it records — back into a
    // channel, or on to be heard (graph/connectionRules.ts: into a processing or routing card)
    category: 'sink', inputs: IN, outputs: [{ id: 'out', levels: ADVANCED_ONLY }], stereo: 'follow',
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE,
    defaultParams: {},
  },
  broadcast: {
    // Stream / Broadcast: the mix sent out to listeners far away, always in stereo (a mono wire goes
    // out on both sides). At Advanced it takes only an Encoder's output (graph/connectionRules.ts)
    category: 'sink', inputs: IN, outputs: [], stereo: 'always',
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE,
    defaultParams: {},
  },
  // Record and play back (D22). Each path from its own port line, left to right: the top one
  // records, the one under it plays back
  interface: {
    // A USB Audio Interface, two converters in a box: its line input (any number of wires: the
    // channels to record) goes to the computer as numbers, over the USB wire; the computer's sound
    // comes back along it and out of its line output (one stereo wire, From computer: into the
    // desk, or the monitors). The two never meet
    category: 'processor', stereo: 'always',
    inputs: [{ id: 'in', many: true }, { id: FROM_PC_PORT, hidden: true }],
    outputs: [{ id: TO_PC_PORT }, { id: 'out' }],
    routes: [{ from: 'in', to: [TO_PC_PORT], as: 'adc' }, { from: FROM_PC_PORT, to: ['out'], as: 'dac' }],
    // Advanced has its parts instead: the converters, the Encoder and the Decoder
    levels: ['beginner', 'intermediate'], bypass: false, minSize: FACE_SIZE,
    defaultParams: {},
  },
  daw: {
    // The computer's recording program. Below Advanced: it records what the Interface sends it, over
    // the USB wire, and plays back a song of its own (−18 dBFS on average: unity on the desk after
    // the Interface; a file played — a Decoder's job), back along that wire (a hidden port). At
    // Advanced there is no Interface (D23): a digital summing bus (the user's call, 2026-10-11) —
    // digital signals in, as many as you like, added up in stereo; what it records leaves on an
    // output of its own, into a Recorder Track only. Nothing in: silent
    category: 'source', stereo: 'always',
    inputs: [{ id: 'in', many: true }],
    outputs: [{ id: PLAYBACK_PORT, hidden: true }, { id: 'out', levels: ADVANCED_ONLY }],
    routes: [{ from: 'in', to: ['out'], as: 'daw' }, { from: null, to: [PLAYBACK_PORT], as: 'decoder' }],
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE,
    defaultParams: { levelDb: -18 },
  },
  // Beginner's devices (D20): what stands in the room, not its parts
  mixer: {
    // The whole desk in one box: any number of wires in (the channels), its mix out of Main (the
    // room's speakers) and Monitor (the wedges on stage) — or into a Recorder, an Audio Interface
    // or a DAW (a wire into a DAW brings the computer's sound back: graph/usbLink.ts)
    category: 'merge', stereo: 'always',
    inputs: [{ id: 'in', many: true }], outputs: [{ id: MIXER_MAIN_PORT }, { id: MIXER_MONITOR_PORT }],
    // Drawn big (the user's call, 2026-10-11): three times as wide as the Parametric EQ's card, as
    // tall as its drawing then is (BeginnerFaces.tsx)
    levels: ['beginner'], bypass: false, minSize: { w: 1230, h: 728 },
    defaultParams: {},
  },
  'stage-box': {
    // On the stage: every microphone and instrument plugs in here, and one thick cable (the snake)
    // takes them all to the Mixer — nothing else takes it
    category: 'merge', stereo: 'always',
    inputs: [{ id: 'in', many: true }], outputs: OUT,
    levels: ['beginner'], bypass: false, minSize: FACE_SIZE,
    defaultParams: {},
  },
}

/** True for a type this version of the app knows (a saved file may hold newer ones). */
export function isTypeKey(key: string): key is TypeKey {
  return Object.hasOwn(NODE_REGISTRY, key)
}

/** Is this element in the palette at this level? */
export function availableAt(typeKey: TypeKey, level: ComplexityLevel): boolean {
  return NODE_REGISTRY[typeKey].levels.includes(level)
}

// The Compressor below Advanced has one knob, 0 … 10, as a small desk's (Yamaha MG12XU, from its
// spec sheet): turning it up lowers the threshold (+22 → −8 dBu), raises the ratio (1:1 → 4:1) and
// the makeup gain (0 → +7 dB) together; attack and release are fixed (about 25 and 300 ms).
export const ONE_KNOB_MAX = 10
const ONE_KNOB = { thresholdDb: [22, -8], ratio: [1, 4], makeupGainDb: [0, 7], attackMs: 25, releaseMs: 300 } as const
/** Where the one knob starts: a little compression — 2 to 3 dB off a voice at unity, measured. */
const ONE_KNOB_START = 7

/**
 * Drawn at this level as a bare control, not as its card (NodeTypeDef `bareSize`) — zoomed out
 * (`overview`), at Advanced too where the type says so (`bareZoomedOut`: the HPF).
 */
export function isBareAt(typeKey: TypeKey, level: ComplexityLevel, overview = false): boolean {
  const def = NODE_REGISTRY[typeKey]
  return def.bareSize !== undefined && (level !== 'advanced' || (overview && def.bareZoomedOut === true))
}

/** What the Compressor's one knob at `amount` (0 … 10) sets. */
export function oneKnobComp(amount: number) {
  const f  = Math.min(Math.max(amount / ONE_KNOB_MAX, 0), 1)
  const at = ([from, to]: readonly [number, number]) => Math.round((from + (to - from) * f) * 100) / 100
  return {
    thresholdDb: at(ONE_KNOB.thresholdDb), ratio: at(ONE_KNOB.ratio), makeupGainDb: at(ONE_KNOB.makeupGainDb),
    attackMs: ONE_KNOB.attackMs, releaseMs: ONE_KNOB.releaseMs,
  }
}

/** Where the one knob sits for a Compressor's threshold (0 … 10): it is what the knob turned. */
export function oneKnobAt(thresholdDb: number): number {
  const [from, to] = ONE_KNOB.thresholdDb
  const at = Math.round(((thresholdDb - from) / (to - from)) * ONE_KNOB_MAX * 100) / 100
  return Math.min(Math.max(at, 0), ONE_KNOB_MAX)
}

/**
 * Params of a node dropped on the canvas at this level. The Equalizer below Advanced works like a
 * simple mixing desk's: Low and High are shelves and cannot be switched. Advanced starts with bells
 * and lets you choose. The Compressor below Advanced starts where its one knob sets it.
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
  if (typeKey === 'comp' && level !== 'advanced') Object.assign(params, oneKnobComp(ONE_KNOB_START))
  return params
}

// ── Reading params ─────────────────────────────────────────────────────────────

/**
 * The type of every setting a node can have. The ones that may be `undefined` have no default:
 * they are written the first time they are changed.
 */
export interface ParamTypes {
  levelDb: number
  /** Vocal: speaking or singing (CHARACTERS) */
  character: Character
  /** Microphone: dynamic or condenser (MIC_TYPES) */
  micType: MicType
  /** Encoder: the stream's format (ENCODER_FORMATS) */
  format: EncoderFormat
  /** Generator: what it plays (GENERATOR_SOUNDS) */
  sound: GeneratorSound
  /** The Mono | Stereo switch (Generator, Aux Bus) */
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
  /** Flipped horizontally (FLIPS): its sound flows right to left — its input on the right */
  flipH: boolean | undefined
  /** Flipped vertically (FLIPS): on its side — its input on top, its output at the bottom */
  flipV: boolean | undefined
}

export type ParamKey = keyof ParamTypes

// ── Flipping a card ────────────────────────────────────────────────────────────

/** A way a card can be flipped: h — its sound flows the other way; v — turned on its side */
export type Flip = 'h' | 'v'

/**
 * The cards that can be flipped (their right-click menu: Flip horizontal / vertical — the user's
 * call, 2026-10-11): an On Off Switch or a Gain on its side above a PFL Bus, or flowing back toward
 * a bus on the left; a speaker or headphones facing the other way (an Active Speaker flipped is a
 * stage monitor, turned toward the band). Its ports go with it; the picture of a face is mirrored.
 */
export const FLIPS: Partial<Record<TypeKey, readonly Flip[]>> = {
  gain:             ['h', 'v'],
  switch:           ['h', 'v'],
  'active-speaker': ['h'],
  headphones:       ['h'],
}

/** Is this card flipped that way (a type that can't be never is)? */
export function isFlipped(node: Pick<SignalNode, 'typeKey' | 'params'>, flip: Flip): boolean {
  return (FLIPS[node.typeKey]?.includes(flip) ?? false) && param(node, flip === 'h' ? 'flipH' : 'flipV') === true
}

/** The side of its card a port sits on and its wire leaves or enters by */
export type Facing = 'left' | 'right' | 'top' | 'bottom'

/**
 * Where a card's inputs (`target`) and outputs (`source`) sit: inputs left, outputs right — flipped
 * horizontally the other way round; flipped vertically, the input on top and the output at the
 * bottom (both ways: the input at the bottom, the output on top).
 */
export function portFacing(node: Pick<SignalNode, 'typeKey' | 'params'>, type: 'source' | 'target'): Facing {
  const first = (type === 'target') !== isFlipped(node, 'h')
  if (isFlipped(node, 'v')) return first ? 'top' : 'bottom'
  return first ? 'left' : 'right'
}

/** An Active Speaker flipped to face the band: a stage monitor (its name) */
export function isStageMonitor(node: Pick<SignalNode, 'typeKey' | 'params'>): boolean {
  return node.typeKey === 'active-speaker' && isFlipped(node, 'h')
}

/** Settings that take one of a few words: any other word (from a file) falls back to the default. */
const PARAM_CHOICES: Partial<Record<string, readonly string[]>> = {
  character:     CHARACTERS,
  micType:       MIC_TYPES,
  format:        ENCODER_FORMATS,
  sound:         GENERATOR_SOUNDS,
  selectedInput: ['a', 'b'],
}

/** The words a setting can take (undefined: it is not a word). */
export function paramChoices(key: string): readonly string[] | undefined {
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
 * A one-input card that passes on what it gets (an EQ, a compressor, a pad, a fader …; a Recorder
 * Track through its Monitor out): walks up a chain (graph/queries.ts) go through these and stop at
 * anything else — a source, a bus, a Relay.
 */
export function passesThrough(typeKey: TypeKey): boolean {
  const def = NODE_REGISTRY[typeKey]
  return def.stereo === 'follow' && def.inputs.length === 1 && def.outputs.length > 0
}

/** True when this node's own setting is stereo (Mono | Stereo switch on, or always stereo). */
export function isNodeStereo(node: Pick<SignalNode, 'typeKey' | 'params'>): boolean {
  const support = NODE_REGISTRY[node.typeKey].stereo
  if (support === 'always') return true
  return support === 'optional' && node.params.stereo === true
}

/**
 * A bus that sends its mix out as Left and Right: the Master, the Matrix, an Aux set to Stereo
 * (not the PFL Bus: stereo on one wire).
 */
export function isStereoBus(node: Pick<SignalNode, 'typeKey' | 'params'>): boolean {
  if (!isBus(node.typeKey) || !isNodeStereo(node)) return false
  const def = NODE_REGISTRY[node.typeKey]
  return (def.stereoOutputs ?? def.outputs).some((p) => portSide(p.id) !== null)
}

/** Which side a bus output carries: 'l' / 'r' for Left / Right outputs, null otherwise. */
/**
 * Cards that take a stereo mix's L or R as the whole mix — the holder's send (MATRIX_PORT, one
 * stereo wire after the fader: graph/mainFader.ts): a Matrix Bus, and what sends the mix out to
 * listeners as one stereo stream (the user's call, 2026-10-11).
 */
export const TAKES_WHOLE_MIX: ReadonlySet<TypeKey> = new Set<TypeKey>(['matrix-bus', 'broadcast', 'encoder'])

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
