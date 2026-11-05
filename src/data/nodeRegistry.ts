// Node type registry — single source of truth for every element type: ports, defaults, levels.
// No imports from the rest of the app (only the levels); safe to import from anywhere.

import type { ComplexityLevel } from './levels'
import { LEVELS } from './levels'

/** A connection point. */
export type NodePort = {
  id: string
  /**
   * Takes several wires, added together (a bus's input, the Mixer's, an Audio Interface's line
   * input …): drawn as one port per wire and an empty one for the next, up to MAX_SLOTS (graph/slots.ts)
   */
  many?: true
  /** Port lines its extra ports leave free (the Interface's playback line, 1) */
  skipRows?: readonly number[]
  /** Which of a `many` input's ports it is (graph/slots.ts: 0 is the input's own id) */
  slot?: number
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
  /**
   * With `middle`: halfway down only at these levels (the Drum Kit's and the Acoustic's: on their
   * Beginner face; from Intermediate they have no card, their Sound leaves the icon on its port
   * line — BareSource). drawnPorts settles it: a port drawn at a level has `middle` or not.
   */
  middleLevels?: readonly ComplexityLevel[]
  /**
   * Different at some levels (graph/queries.ts drawnPorts settles it): the Audio Interface's Line
   * out on its own line from Intermediate, on the line under To computer on its Beginner face
   */
  atLevels?: Partial<Record<ComplexityLevel, Pick<NodePort, 'row' | 'skipRows'>>>
  /** Its name, beside its ring (the locales' `ports`): the Computer's Analog and Digital outputs */
  label?: PortLabel
  /** With `label`: shown only at these levels (the Computer's, at Advanced where it has two outputs) */
  labelLevels?: readonly ComplexityLevel[]
  /** Never drawn, and no hand-drawn wire ends on it: the USB link's way back (graph/usbLink.ts), a cable's channels (graph/interfaceLink.ts) */
  hidden?: true
  /**
   * Drawn only at these levels (graph/queries.ts drawnPorts): the DAW records at Beginner and
   * Intermediate and plays its mix out at Advanced
   */
  levels?: readonly ComplexityLevel[]
}

/** The names a port can show beside its ring (the locales' `ports`). */
export type PortLabel = 'diOut' | 'analog' | 'digital'

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
  | 'di-box' | 'amp' | 'effects' | 'fader' | 'switch' | 'phase' | 'delay' | 'relay' | 'pan' | 'adc' | 'dac'
  | 'master-bus' | 'aux-bus' | 'matrix-bus' | 'pfl-bus'
  | 'speaker' | 'active-speaker' | 'studio-monitor' | 'headphones' | 'recorder' | 'broadcast'
  | 'interface' | 'daw' | 'mixer' | 'stage-box' | 'codec' | 'digital-interface'

export type Size = { w: number; h: number }

/**
 * One path through a card whose outputs never meet (NodeTypeDef `routes`): the input it reads, the
 * outputs it sends on, and the type whose job it does on the way. `from` null: it makes its own
 * sound (a DAW plays back); `to` empty: it only takes the signal in (a DAW records).
 */
export type Route = {
  from: string | null
  to: readonly string[]
  as: TypeKey
  /** Planned only while a wire comes in on `from` (a Digital Interface's channels: eight each way, most unused) */
  ifWired?: true
}

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
   * A dynamics card (Compressor, Noise Gate, Limiter, De-esser): a level curve that turns its signal
   * down. In stereo it runs linked: the louder side decides, both sides get the same change.
   */
  dynamics?: true
  /**
   * Drawn as a bare control, not a card (FreeControl): its usual size, for drop previews. With a
   * `minSize` too (the sources with no card from Intermediate — BareSource), that is its Beginner
   * face's size.
   */
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
   * route — but a Digital Interface's cable, which carries its channels' hidden wires (D40).
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
}

// Graph edge — connects an output port of one node to an input port of another.
export type SignalEdge = {
  id: string
  source: string       // node id
  sourceHandle: string // port id, e.g. 'out' | 'out-l' | 'mix'
  target: string
  targetHandle: string // port id, e.g. 'in' | 'in-a'
  // Into an input that takes several wires (`many`): which of its ports it is drawn on, 0 … — the
  // signal is the same on each (graph/slots.ts)
  slot?: number
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

/**
 * The Computer's digital output at Advanced (its first, 'out', is analog: after its own DAC): the
 * WAV file it plays, as numbers (D40)
 */
export const PC_DIGITAL_PORT = 'digital'

/**
 * A Digital Interface (D40) packs PCM wires into one cable of a protocol — AES/EBU (AES3: 2 channels)
 * or AES50 (48 each way at 48 kHz, 24 at 96 kHz) — or unpacks such a cable back into its wires. The
 * numbers are not changed. Its card's In and Out columns choose from these: one side is always PCM
 * (protocol to protocol is a format converter's job, not in the app). Its params: the protocol of its
 * cable (`protocol`: LINK_PROTOCOLS) and which way it works (`packs`: PCM in, the cable out).
 */
export const PROTOCOLS = ['pcm', 'aes3', 'aes50'] as const
export type Protocol = typeof PROTOCOLS[number]
export const LINK_PROTOCOLS = ['aes3', 'aes50'] as const
export type LinkProtocol = typeof LINK_PROTOCOLS[number]

/** Where a Digital Interface takes its clock (param `clock`): its own, or from the cable (D40) */
export const CLOCKS = ['internal', 'external'] as const
export type ClockSource = typeof CLOCKS[number]

/** A Digital Interface's cable: the output of one that packs, the input of one that unpacks */
export const LINK_PORT = 'link'

/** The most channel wires a Digital Interface packs into one cable (one per port, as a bus's inputs) */
export const LINK_WIRES = 8

/** A Digital Interface's channel k (0 …): the input it is packed from, the output it is unpacked on */
export const channelIn  = (k: number) => (k === 0 ? 'in' : `in${k + 1}`)
export const channelOut = (k: number) => (k === 0 ? 'out' : `out${k + 1}`)
/**
 * Its hidden wire along the cable, from the packing interface to the unpacking one (the store keeps
 * one per channel with every cable: graph/interfaceLink.ts) — on both, the port of that name
 */
export const channelLink = (k: number) => `ch${k + 1}`

const LINK_RANGE = Array.from({ length: LINK_WIRES }, (_, k) => k)

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
 * An Amplifier's input B (its input A is 'in'): a mono wire here plays on channel B, out of R (D27).
 */
export const AMP_B_PORT = 'in-b'

/**
 * Sound in the air — a Vocal's, a Drum Kit's, an Acoustic Instrument's, a Guitar Amp's: a wire of waves
 * that only a microphone can take (D21).
 */
export const SOUND_PORT = 'sound'

/** Their output: Sound, halfway down the card's side */
const SOUND_OUT: NodePort[] = [{ id: SOUND_PORT, middle: true }]
/** The Drum Kit's and the Acoustic's: halfway down their Beginner face, on their icon's port line from Intermediate (no card) */
const SOUND_OUT_BARE: NodePort[] = [{ id: SOUND_PORT, middle: true, middleLevels: ['beginner'] }]

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
 * What a Codec squeezes the sound into for a stream, or unpacks (param `codec`, D41): the three most
 * used — MP3 (MPEG-1/2 Audio Layer III: plays everywhere), AAC (MPEG-2/4: phones, video, most
 * streaming), Opus (live talk, least delay). Each keeps the level; what they change is how much
 * detail the listener gets.
 */
export const CODECS = ['mp3', 'aac', 'opus'] as const
export type Codec = typeof CODECS[number]

/** The easiest level whose Vocals and Microphones show their choices (Speech | Singing, Dynamic | Condenser). */
export const CHOICE_LEVEL: ComplexityLevel = 'intermediate'

/** What the Generator plays (param `sound`): a steady tone, hiss, short pulses. */
export const GENERATOR_SOUNDS = ['sine', 'noise', 'click'] as const
export type GeneratorSound = typeof GENERATOR_SOUNDS[number]

/** One of the Generator's sounds (made in code, audio/sounds.ts) — not a loop of real sound. */
export function isGeneratorSound(kind: string): kind is GeneratorSound {
  return (GENERATOR_SOUNDS as readonly string[]).includes(kind)
}

/** The Delay knob's longest delay (ms): sound travels about 3.4 m in 10 ms — mics on one source, a few metres apart at most */
export const DELAY_MAX_MS = 20

/** The Effects processor's programs, by index (fxProgram): their names in the locales' nodes.effects.programs */
export const EFFECT_PROGRAMS = ['hall', 'room', 'plate', 'echo', 'chorus'] as const

const IN: NodePort[]    = [{ id: 'in' }]
// A bus's input: several wires, one port each (graph/slots.ts)
const MANY_IN: NodePort[] = [{ id: 'in', many: true }]
const OUT: NodePort[]   = [{ id: 'out' }]
// The cards' sizes (minSize): what they were with the readings under them at Intermediate, now the
// same at every level, their content grown into the room (2026-10-08). The mixing buses are big
// enough that their long names stay big in overview — wide enough for the Peak, RMS and Noise beside
// their meter (D31).
const BUS_SIZE: Size  = { w: 618, h: 361 }
const FACE_SIZE: Size = { w: 320, h: 328 }
// The Keyboard's
const SOURCE_SIZE: Size = { w: 320, h: 350 }
// The Microphone's: half a face's each way (the user's call, 2026-10-11) — a small thing on a stand
const MIC_SIZE: Size = { w: 160, h: 164 }
const DYNAMICS_SIZE: Size = { w: 618, h: 366 }
// The Graphic and the Parametric equalizer: one size, room for their names zoomed out (D31)
const EQ_SIZE: Size = { w: 862, h: 471 }
// The speakers' and the Headphones' with no card around them (D28: BareOutput), at Intermediate
// (taller with a note under the icon) — the Active Speaker's and Studio Monitor's with their Volume
// knob beside the icon
const BARE_OUTPUT_SIZE: Size = { w: 292, h: 412 }
const BARE_VOLUME_SIZE: Size = { w: 458, h: 412 }
// The sources with no card around them from Intermediate (BareSource, the Computer): their icon and
// name, no meter (D34) — taller with a note under the icon; the Acoustic Instrument's long name
// wider, the Keyboard's octave twice as wide
const BARE_SOURCE_SIZE: Size   = { w: 292, h: 272 }
const BARE_ACOUSTIC_SIZE: Size = { w: 336, h: 272 }
const BARE_KEYBOARD_SIZE: Size = { w: 532, h: 272 }
// Stream / Broadcast: its icon with its upright meter before it (UprightFace)
const BARE_BROADCAST_SIZE: Size = { w: 384, h: 433 }

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
    category: 'source', inputs: [], outputs: SOUND_OUT_BARE, stereo: 'never',
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE, freeSize: BARE_SOURCE_SIZE,
    defaultParams: {},
  },
  acoustic: {
    // An acoustic instrument (a trumpet on its icon; it plays the guitar loop): at Beginner too
    category: 'source', inputs: [], outputs: SOUND_OUT_BARE, stereo: 'never',
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE, freeSize: BARE_ACOUSTIC_SIZE,
    defaultParams: {},
  },
  mic: {
    // Turns the sound it hears (its input: a Sound output, nothing else) into a weak signal (D21):
    // not a source — the chain's colour comes from the sound before it
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'never',
    levels: EVERY_LEVEL, bypass: false, minSize: MIC_SIZE,
    defaultParams: { micType: 'dynamic' },
  },
  // Line-level sources, always stereo (Left and Right on one wire): their level is their own.
  // minSize: their Beginner face's (BeginnerInput); freeSize: from Intermediate, no card (BareSource)
  keyboard: {
    category: 'source', inputs: [], outputs: OUT, stereo: 'always',
    levels: EVERY_LEVEL, bypass: false, minSize: SOURCE_SIZE, freeSize: BARE_KEYBOARD_SIZE,
    defaultParams: { levelDb: -10 },
  },
  pc: {
    // At Advanced two outputs (D40): Analog — through its own DAC — and Digital, the file as numbers
    category: 'source', inputs: [], stereo: 'always',
    outputs: [
      { id: 'out', label: 'analog', labelLevels: ADVANCED_ONLY },
      { id: PC_DIGITAL_PORT, label: 'digital', labelLevels: ADVANCED_ONLY, levels: ADVANCED_ONLY },
    ],
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE, freeSize: BARE_SOURCE_SIZE,
    defaultParams: { levelDb: 0 },
  },
  instrument: {
    category: 'source', inputs: [], outputs: OUT, stereo: 'never',
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE, freeSize: BARE_SOURCE_SIZE,
    defaultParams: { levelDb: -30 },
  },
  generator: {
    // A test sound of its own, at the level its knob sets (0 dBu: unity); Stereo: the same on both sides
    category: 'source', inputs: [], outputs: OUT, stereo: 'optional',
    levels: ADVANCED_ONLY, bypass: false, minSize: { w: 320, h: 285 },
    defaultParams: { sound: 'sine', levelDb: 0, stereo: false },
  },
  phantom: {
    // 48V phantom power: a bare button like the Pad (D21). It passes the signal on unchanged; a
    // condenser microphone before it, ahead of the Preamp, gets its power (graph/queries.ts phantomPowered)
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: FROM_INTERMEDIATE, bypass: false, freeSize: { w: 197, h: 178 },
    defaultParams: { on: true },
  },
  gain: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: FROM_INTERMEDIATE, bypass: false, freeSize: { w: 302, h: 367 },
    // The first Gain after a microphone is its Preamp (preampDb, 0…+60 dB);
    // anywhere else it is a plain gain stage (gainDb, −∞…+20 dB). Each mode keeps its own setting.
    defaultParams: { preampDb: 40, gainDb: 0 },
  },
  hpf: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    // Below Advanced one button at 80 Hz (its On / Off: bypass); zoomed out that button at Advanced too
    levels: FROM_INTERMEDIATE, bypass: true, minSize: { w: 320, h: 268 }, bareSize: { w: 196, h: 206 }, bareZoomedOut: true,
    defaultParams: { cutoffHz: 80 },
  },
  eq: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    // Below Advanced three bare knobs, Low · Mid · High (see initialParams)
    levels: FROM_INTERMEDIATE, bypass: true, minSize: EQ_SIZE, bareSize: { w: 540, h: 280 },
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
    levels: ADVANCED_ONLY, bypass: true, minSize: EQ_SIZE,
    // b0..b30 = gain of each of the 31 one-third-octave bands, 20 Hz … 20 kHz (eqMath GEQ_CENTERS)
    defaultParams: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`b${i}`, 0])),
  },
  comp: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: FROM_INTERMEDIATE, bypass: true, minSize: DYNAMICS_SIZE, dynamics: true, bareSize: { w: 273, h: 288 },
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
    levels: ADVANCED_ONLY, bypass: true, minSize: { w: 618, h: 361 }, dynamics: true,
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
    levels: FROM_INTERMEDIATE, bypass: false, freeSize: { w: 162, h: 178 },
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
    // (Its DI Out's name is printed on its panel — GuitarAmpNode)
    outputs: [SOUND_OUT[0], { id: AMP_DI_PORT, row: 0 }],
    // Drawn as a combo amp, no card (GuitarAmpNode): its usual size, for drop previews
    levels: EVERY_LEVEL, bypass: false, freeSize: { w: 352, h: 371 },
    // Its Volume knob goes to 11 (signal/gains.ts guitarAmpGainDb); Ground Lift on its DI Out (D26);
    // its power switch (D27: off, it sends nothing — not its DI Out either)
    defaultParams: { volume: 5, groundLift: false, on: true },
  },
  amp: {
    // A two-channel power amp in a rack (D27): input A ('in') feeds output L, input B feeds R, each
    // channel its own Volume. A mono wire plays on the channel it is plugged into; one stereo wire
    // goes into both (its left side into A, its right into B — drawn split at the inputs). Its
    // outputs are always L and R, on the inputs' lines. Drawn as the rack, no card (AmpNode), twice
    // its drawing's size: B's line four port lines below A's
    category: 'processor', stereo: 'follow',
    inputs: [{ id: 'in', row: 0 }, { id: AMP_B_PORT, row: 4 }],
    outputs: [{ id: 'out-l', row: 0 }, { id: 'out-r', row: 4 }],
    levels: EVERY_LEVEL, bypass: false, freeSize: { w: 692, h: 342 },
    defaultParams: { gainDb: 0, on: true },
  },
  effects: {
    // An effects unit in a rack, 1U (a destination for an Aux Bus): it passes its signal on as it
    // is — its Program and knobs are part of the picture, no effect is made. In and Out meters, a
    // power switch (switched off: silent, as an Amplifier — D27). Drawn as the rack (EffectsNode)
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: ADVANCED_ONLY, bypass: false, freeSize: { w: 972, h: 186 },
    defaultParams: { on: true, fxProgram: 0, fxTime: 50, fxTone: 50, fxDepth: 50 },
  },
  fader: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: FROM_INTERMEDIATE, bypass: false, freeSize: { w: 249, h: 718 },
    defaultParams: { faderDb: 0 },
  },
  switch: {
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: FROM_INTERMEDIATE, bypass: false, freeSize: { w: 162, h: 161 },
    defaultParams: { on: true },
  },
  phase: {
    // Polarity: pressed, the signal leaves upside down (every sample its opposite). Alone it changes
    // nothing you hear; added to the same signal the right way up, the two cancel out (the render
    // adds real samples — the number engine does not know which signals are the same). From
    // Intermediate, where real sound is measured (the Delay at Advanced)
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: FROM_INTERMEDIATE, bypass: false, freeSize: { w: 162, h: 161 },
    defaultParams: { inverted: false },
  },
  delay: {
    // Holds the signal back by delayMs (0 … DELAY_MAX_MS): its level unchanged — two copies of one
    // signal a little apart in time no longer line up (with the Phase switch: phase alignment)
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'follow',
    levels: ADVANCED_ONLY, bypass: false, freeSize: { w: 237, h: 248 },
    defaultParams: { delayMs: 0 },
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
    levels: FROM_INTERMEDIATE, bypass: false, freeSize: { w: 232, h: 271 },
    defaultParams: { panPosition: 50 },
  },
  adc: {
    category: 'processor', stereo: 'follow',
    inputs: [{ id: 'in' }],
    outputs: [{ id: 'out' }],
    levels: ADVANCED_ONLY, bypass: false, minSize: { w: 320, h: 280 },
    // alignmentDb: how far below the digital ceiling unity sits (EBU R68: 0 dBu = −18 dBFS,
    // so 0 dBFS = +18 dBu). dBFS = dBu − alignmentDb. Its sample rate and bit depth: the format it
    // writes (D36: signal/formats.ts) — the bit depth sets its noise floor (ownNoiseOf)
    defaultParams: { alignmentDb: 18, sampleRate: 48000, bitDepth: 24 },
  },
  dac: {
    category: 'processor', stereo: 'follow',
    inputs: [{ id: 'in' }],
    outputs: [{ id: 'out' }],
    levels: ADVANCED_ONLY, bypass: false, minSize: { w: 320, h: 259 },
    defaultParams: { alignmentDb: 18 },
  },
  codec: {
    // D41: between the rest of the chain and Stream / Broadcast. PCM in and a codec out (MP3, AAC,
    // Opus — CODECS), it squeezes the digital mix into a stream at its bitrate, its level kept; its
    // output goes only into Stream / Broadcast (graph/connectionRules.ts). A codec in and PCM out, it
    // unpacks the stream Stream / Broadcast sends (the listener's end, D37) — of its codec only — into
    // 32-bit float. It works on numbers only: fed an analog signal it sends nothing (D23 — squeezing is
    // more than converting). Always stereo, like what it feeds. As a route's job it is a file played (the DAW's playback below Advanced)
    category: 'processor', inputs: IN, outputs: OUT, stereo: 'always',
    levels: ADVANCED_ONLY, bypass: false, minSize: { w: 320, h: 420 },
    defaultParams: { codec: 'mp3', encodes: true, bitrate: 128 },
  },
  'digital-interface': {
    // D40: packs PCM wires into one cable (AES/EBU, AES50) or, set to PCM, unpacks one. Every channel
    // a path of its own (`routes`): packing, wire k → its hidden output k → along the cable (a hidden
    // wire, graph/interfaceLink.ts) → the unpacking interface's hidden input k → its output k. The ports
    // it shows depend on what it sends and on its wires (graph/interfaceLink.ts interfacePorts)
    category: 'processor', stereo: 'follow',
    inputs: [
      ...LINK_RANGE.map((k): NodePort => ({ id: channelIn(k), row: k })),
      { id: LINK_PORT, row: 0 },
      ...LINK_RANGE.map((k): NodePort => ({ id: channelLink(k), hidden: true })),
    ],
    outputs: [
      { id: LINK_PORT, row: 0 },
      ...LINK_RANGE.map((k): NodePort => ({ id: channelOut(k), row: k })),
      ...LINK_RANGE.map((k): NodePort => ({ id: channelLink(k), hidden: true })),
    ],
    routes: [
      ...LINK_RANGE.map((k): Route => ({ from: channelIn(k), to: [channelLink(k)], as: 'digital-interface', ifWired: true })),
      ...LINK_RANGE.map((k): Route => ({ from: channelLink(k), to: [channelOut(k)], as: 'digital-interface', ifWired: true })),
    ],
    // Tall enough for its longest warning, in Bulgarian too: it never grows when one shows
    levels: ADVANCED_ONLY, bypass: false, minSize: { w: 320, h: 420 },
    defaultParams: { protocol: 'aes50', packs: true, clock: 'internal' },
  },
  'master-bus': {
    // Always stereo. Its input takes up to 8 wires, one port each; they are added together.
    // The mix leaves on one stereo wire — on L and R into speakers (D43: graph/sides.ts).
    category: 'merge', inputs: MANY_IN, outputs: OUT, stereo: 'always', bus: 'mix',
    levels: FROM_INTERMEDIATE, bypass: false, minSize: BUS_SIZE,
    defaultParams: { faderDb: 0 },
  },
  'aux-bus': {
    // Its input takes up to 8 wires, one port each; they are added together.
    // Mono: one channel out. Stereo: one stereo wire — on L and R into speakers (D43).
    category: 'merge', inputs: MANY_IN, outputs: OUT, stereo: 'optional', bus: 'mix',
    levels: FROM_INTERMEDIATE, bypass: true, minSize: { w: 618, h: 397 },
    defaultParams: { faderDb: 0, stereo: false },
  },
  'matrix-bus': {
    // A bus of buses, always stereo: only whole mixes go in, a Master or Aux Bus's, before its
    // fader or after it (D42). One send knob per bus (params `send-<busId>`, audio taper, 75 = full
    // level). A mono bus lands on both sides at full level. Its mix leaves on one stereo wire (D43).
    category: 'merge', inputs: MANY_IN, outputs: OUT, stereo: 'always', bus: 'matrix',
    levels: ADVANCED_ONLY, bypass: false, minSize: BUS_SIZE,
    defaultParams: { faderDb: 0 },
  },
  'pfl-bus': {
    // PFL (Pre-Fade Listen): what the engineer hears in the headphones — the channels whose PFL
    // button is down (a Switch wired into it). Always stereo, a mono wire on both sides at full
    // level (no Pan); one stereo output and no fader: the Gain before the headphones sets how loud.
    // Never a Main Fader's or a Matrix Bus's
    category: 'merge', inputs: MANY_IN, outputs: OUT, stereo: 'always', bus: 'pfl',
    levels: FROM_INTERMEDIATE, bypass: true, minSize: { w: 618, h: 397 },
    defaultParams: {},
  },
  speaker: {
    // Passive speaker — requires a power amplifier (amp node) upstream to produce sound. No card
    // around it (D28): its size is its drawing's (SpeakerNode)
    category: 'sink', inputs: IN, outputs: [], stereo: 'never',
    levels: EVERY_LEVEL, bypass: false, freeSize: BARE_OUTPUT_SIZE,
    defaultParams: { outputTrimDb: 0 },
  },
  'active-speaker': {
    // Active/powered speaker — has built-in amplification, works directly from line level. No card
    // around it (D28): its size is its drawing's (ActiveSpeakerNode)
    category: 'sink', inputs: IN, outputs: [], stereo: 'never',
    levels: EVERY_LEVEL, bypass: false, freeSize: BARE_VOLUME_SIZE,
    defaultParams: { volumeDb: 0 },
  },
  'studio-monitor': {
    // Works as an Active Speaker does (amplifier built in): the speakers a studio mixes on. Advanced
    // has the Active Speaker for both
    category: 'sink', inputs: IN, outputs: [], stereo: 'never',
    levels: ['beginner', 'intermediate'], bypass: false, freeSize: BARE_VOLUME_SIZE,
    defaultParams: { volumeDb: 0 },
  },
  headphones: {
    // There to show where a listener plugs in: no knob of their own — a Gain right before them sets
    // how loud (the desk's Phones knob); fed by anything else they are silent. A stereo wire whole:
    // left ear L, right ear R (D43). No card around them (D28): their size is their drawing's (HeadphonesNode)
    category: 'sink', inputs: IN, outputs: [], stereo: 'follow',
    levels: EVERY_LEVEL, bypass: false, freeSize: BARE_OUTPUT_SIZE,
    defaultParams: {},
  },
  recorder: {
    // Records what reaches it, as it is: a stereo wire in two channels, a mono one in one. Not at
    // Advanced, where the DAW records the tracks wired into it (D35)
    category: 'sink', inputs: IN, outputs: [], stereo: 'follow',
    levels: ['beginner', 'intermediate'], bypass: false, minSize: FACE_SIZE,
    defaultParams: {},
  },
  broadcast: {
    // Stream / Broadcast: the mix sent out to listeners far away, always in stereo (a mono wire goes
    // out on both sides). At Advanced it takes only an encoding Codec's output (graph/connectionRules.ts).
    // No card from Intermediate (BroadcastNode, as the Computer): minSize is its Beginner face's
    // At Advanced its output is what the listeners receive, into a decoding Codec (D37: the round trip)
    category: 'sink', inputs: IN, outputs: [{ id: 'out', levels: ADVANCED_ONLY }], stereo: 'always',
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE, freeSize: BARE_BROADCAST_SIZE,
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
    // Its inputs one port per wire, as a bus's; its two outputs named on the card (InterfaceNode):
    // Line out three lines under To computer. At Beginner its face has a line across for each path
    // (BeginnerInterface): Line out on the second line, the extra inputs below it
    inputs: [{ id: 'in', many: true, atLevels: { beginner: { skipRows: [1] } } }, { id: FROM_PC_PORT, hidden: true }],
    outputs: [{ id: TO_PC_PORT }, { id: 'out', row: 3, atLevels: { beginner: { row: 1 } } }],
    routes: [{ from: 'in', to: [TO_PC_PORT], as: 'adc' }, { from: FROM_PC_PORT, to: ['out'], as: 'dac' }],
    // Advanced has its parts instead: the converters and the Codec
    // minSize: its Beginner face's; freeSize: its card's at Intermediate (the USB sign, the outputs' names)
    levels: ['beginner', 'intermediate'], bypass: false, minSize: FACE_SIZE, freeSize: { w: 320, h: 240 },
    defaultParams: {},
  },
  daw: {
    // The computer's recording program. Below Advanced: it records what the Interface sends it, over
    // the USB wire, and plays back a song of its own (−18 dBFS on average: unity on the desk after
    // the Interface; a file played — a Codec's job), back along that wire (a hidden port). At
    // Advanced there is no Interface (D23): a digital summing bus (the user's call, 2026-10-11) —
    // digital signals in, as many as you like, added up in stereo; its mix leaves on an output of
    // its own, into any input (D35). Nothing in: silent
    category: 'source', stereo: 'always',
    inputs: [{ id: 'in', many: true }],
    outputs: [{ id: PLAYBACK_PORT, hidden: true }, { id: 'out', levels: ADVANCED_ONLY }],
    routes: [{ from: 'in', to: ['out'], as: 'daw' }, { from: null, to: [PLAYBACK_PORT], as: 'codec' }],
    // minSize: its Beginner face's; freeSize: from Intermediate, a bus's face (D39: BUS_SIZE)
    levels: EVERY_LEVEL, bypass: false, minSize: FACE_SIZE, freeSize: BUS_SIZE,
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
  /**
   * Codec (D41): its codec (CODECS), which way it works (`encodes`: PCM in, the stream out; else the
   * stream in, PCM out) and the stream's size it squeezes into, kb/s (signal/formats.ts BITRATES)
   */
  codec: Codec
  encodes: boolean
  bitrate: number
  /**
   * Digital Interface (D40): its cable's protocol (LINK_PROTOCOLS), which way it works (`packs`: PCM
   * in, the cable out; else the cable in, PCM out) and where its clock comes from (CLOCKS)
   */
  protocol: LinkProtocol
  packs: boolean
  clock: ClockSource
  /** ADC: how often it measures (Hz — SAMPLE_RATES) and how finely (bits — BIT_DEPTHS): D36 */
  sampleRate: number
  bitDepth: number
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
  /** Phase switch: pressed — the signal upside down */
  inverted: boolean
  /** Delay: how long it holds the signal back (ms, 0 … DELAY_MAX_MS) */
  delayMs: number
  /**
   * Effects processor: its program (EFFECT_PROGRAMS, an index) and its knobs (0 … 100) — part of
   * the picture, they change nothing
   */
  fxProgram: number
  fxTime: number
  fxTone: number
  fxDepth: number
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
  /** On Off Switch (FREE_SIDES): the side of it its signal comes in by, and leaves by — set by its wires */
  inSide: Facing | undefined
  outSide: Facing | undefined
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
  phase:            ['h', 'v'],
  'active-speaker': ['h'],
  headphones:       ['h'],
  relay:            ['h'],
}

/**
 * The cards with no input or output side (the user's call, 2026-11-05: "The app does not care about
 * direction of the button, only possible connections"): an On Off Switch has a point on each of its
 * four sides, each taking a wire in or sending one out; once it has a wire in and a wire out, only
 * those two points are left (graph/freeSides.ts). Where its signal comes in and leaves is kept in
 * `inSide` / `outSide`, set by the wires; one saved before that keeps its flips. No flip in its menu.
 */
export const FREE_SIDES: ReadonlySet<TypeKey> = new Set(['switch'])

/** Is this card flipped that way (a type that can't be never is)? */
export function isFlipped(node: Pick<SignalNode, 'typeKey' | 'params'>, flip: Flip): boolean {
  return (FLIPS[node.typeKey]?.includes(flip) ?? false) && param(node, flip === 'h' ? 'flipH' : 'flipV') === true
}

/** The side of its card a port sits on and its wire leaves or enters by */
export type Facing = 'left' | 'right' | 'top' | 'bottom'
export const FACINGS: readonly Facing[] = ['left', 'top', 'right', 'bottom']

/**
 * Where a card's inputs (`target`) and outputs (`source`) sit: inputs left, outputs right — flipped
 * horizontally the other way round; flipped vertically, the input on top and the output at the
 * bottom (both ways: the input at the bottom, the output on top).
 */
export function portFacing(node: Pick<SignalNode, 'typeKey' | 'params'>, type: 'source' | 'target'): Facing {
  // An On Off Switch: where its wires put its input and output (FREE_SIDES)
  const set = FREE_SIDES.has(node.typeKey) ? param(node, type === 'target' ? 'inSide' : 'outSide') : undefined
  if (set) return set
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
  codec:         CODECS,
  protocol:      LINK_PROTOCOLS,
  clock:         CLOCKS,
  sound:         GENERATOR_SOUNDS,
  selectedInput: ['a', 'b'],
  inSide:        FACINGS,
  outSide:       FACINGS,
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
 * A bus whose mix is stereo, with a Main Fader: the Master, the Matrix, an Aux set to Stereo (not
 * the PFL Bus, for listening only).
 */
export function isStereoBus(node: Pick<SignalNode, 'typeKey' | 'params'>): boolean {
  const bus = NODE_REGISTRY[node.typeKey].bus
  return bus !== undefined && bus !== 'pfl' && isNodeStereo(node)
}

/** Which side an output carries: 'l' / 'r' for Left / Right outputs, null otherwise. */
export function portSide(portId: string): 'l' | 'r' | null {
  if (portId.endsWith('-l')) return 'l'
  if (portId.endsWith('-r')) return 'r'
  return null
}

/**
 * Speakers: a stereo output wired to one turns into Left and Right (D43, graph/sides.ts) — the
 * first speaker on L, the next on R, as a desk's Main L / R jacks. Anything else takes a stereo
 * wire whole (headphones too: two ears).
 */
export const TAKES_ONE_SIDE: ReadonlySet<TypeKey> = new Set<TypeKey>(['active-speaker', 'studio-monitor', 'speaker'])

/** The output that splits into L and R toward speakers (D43): a card's `out`. */
export const SPLIT_PORT = 'out'

/** The output a port is part of: `out` for its L and R (an output split toward speakers), else the port itself. */
export function wholeOutput(portId: string): string {
  return portId === 'out-l' || portId === 'out-r' ? SPLIT_PORT : portId
}

/** Param key of a Matrix Bus send knob (`key`: the bus it is for, graph/queries.ts matrixSendKey). */
export function matrixSendParam(key: string): `send-${string}` {
  return `send-${key}`
}
