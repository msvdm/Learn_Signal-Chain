// Node type registry — single source of truth for port definitions and defaults.
// No imports from the rest of the app; safe to import from anywhere.

export type NodePort = {
  id: string
  label: string
  side: 'left' | 'right'
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
  label: string
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

/** Matrix size: input numbers and output numbers. */
export const MATRIX_INPUTS  = [1, 2, 3, 4]
export const MATRIX_OUTPUTS = [1, 2]

/** Param key of one matrix knob: how much of input `i` goes to output `o`. */
export function matrixParam(i: number, o: number): string {
  return `x${i}${o}`
}

export const NODE_REGISTRY: Record<string, NodeTypeDef> = {
  mic: {
    typeKey: 'mic',
    label: 'Microphone',
    inputs: [],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'source',
    defaultParams: { sensitivityDb: -60 },
  },
  'line-in': {
    typeKey: 'line-in',
    label: 'Line Input',
    inputs: [],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'source',
    stereo: 'optional',
    defaultParams: { levelDb: -10, stereo: false },
  },
  instrument: {
    typeKey: 'instrument',
    label: 'Instrument',
    inputs: [],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'source',
    defaultParams: { levelDb: -30 },
  },
  gain: {
    typeKey: 'gain',
    label: 'Preamp / Gain',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { gainDb: 40 },
  },
  hpf: {
    typeKey: 'hpf',
    label: 'High-Pass Filter',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { cutoffHz: 80 },
  },
  eq: {
    typeKey: 'eq',
    label: 'Parametric EQ',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
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
    label: 'Compressor',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { thresholdDb: -20, ratio: 2, makeupGainDb: 0 },
  },
  fader: {
    typeKey: 'fader',
    label: 'Fader',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { faderDb: 0 },
  },
  switch: {
    typeKey: 'switch',
    label: 'Switch',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { on: true },
  },
  potentiometer: {
    typeKey: 'potentiometer',
    label: 'Potentiometer',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    // position: 0–100 knob position. 0 = fully CCW (−∞), 75 = unity (0 dB), 100 = fully CW (+10 dB)
    defaultParams: { position: 75 },
  },
  amp: {
    typeKey: 'amp',
    label: 'Amplifier',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { gainDb: 20 },
  },
  'di-box': {
    typeKey: 'di-box',
    label: 'DI Box',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [
      { id: 'out', label: 'XLR Out', side: 'right' },
      { id: 'direct', label: 'Direct Out', side: 'right' },
    ],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { groundLift: false },
  },
  'noise-gate': {
    typeKey: 'noise-gate',
    label: 'Noise Gate',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { thresholdDb: -40 },
  },
  limiter: {
    typeKey: 'limiter',
    label: 'Limiter',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { thresholdDb: -3, makeupGainDb: 0 },
  },
  pad: {
    typeKey: 'pad',
    label: 'Pad',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { engaged: true },
  },
  deesser: {
    typeKey: 'deesser',
    label: 'De-esser',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { thresholdDb: -20, frequencyHz: 6000 },
  },
  relay: {
    typeKey: 'relay',
    label: 'Relay',
    inputs: [
      { id: 'in-a', label: 'Input A', side: 'left' },
      { id: 'in-b', label: 'Input B', side: 'left' },
    ],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { selectedInput: 'a' },
  },
  pan: {
    typeKey: 'pan',
    label: 'Pan',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    // Always a stereo wire out. A mono wire in = Pan knob; a stereo wire in = Balance knob.
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { panPosition: 50 },
  },
  'audio-interface': {
    typeKey: 'audio-interface',
    label: 'Audio Interface',
    inputs: [], // dynamic at runtime — one per connected channel
    outputs: [],
    category: 'sink',
    defaultParams: {},
  },
  adc: {
    typeKey: 'adc',
    label: 'ADC',
    inputs: [{ id: 'in', label: 'Analog In', side: 'left' }],
    outputs: [{ id: 'out', label: 'Digital Out', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    // alignmentDb: offset between analog reference level and digital full scale
    // Standard: -18 dBu = 0 dBFS (EBU R68). So a -18 dBu signal becomes 0 dBFS.
    defaultParams: { alignmentDb: 18 },
  },
  dac: {
    typeKey: 'dac',
    label: 'DAC',
    inputs: [{ id: 'in', label: 'Digital In', side: 'left' }],
    outputs: [{ id: 'out', label: 'Analog Out', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    defaultParams: { alignmentDb: 18 },
  },
  'master-bus': {
    typeKey: 'master-bus',
    label: 'Master Bus',
    // Always stereo. The input accepts any number of wires; they are added together.
    // The mix leaves on two wires: Left and Right.
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [
      { id: 'out-l', label: 'Left Out',  side: 'right' },
      { id: 'out-r', label: 'Right Out', side: 'right' },
    ],
    category: 'merge',
    stereo: 'always',
    defaultParams: { faderDb: 0 },
  },
  'aux-bus': {
    typeKey: 'aux-bus',
    label: 'Aux Bus',
    // The input accepts any number of wires; they are added together.
    // Mono: one output. Stereo: Left and Right outputs.
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    stereoOutputs: [
      { id: 'out-l', label: 'Left Out',  side: 'right' },
      { id: 'out-r', label: 'Right Out', side: 'right' },
    ],
    category: 'merge',
    stereo: 'optional',
    defaultParams: { faderDb: 0, stereo: false },
  },
  matrix: {
    typeKey: 'matrix',
    label: 'Matrix',
    // Makes new mixes from finished mixes. One wire per input; each output is one channel.
    inputs: MATRIX_INPUTS.map((n) => ({ id: `in-${n}`, label: `In ${n}`, side: 'left' as const })),
    outputs: MATRIX_OUTPUTS.map((n) => ({ id: `out-${n}`, label: `Out ${n}`, side: 'right' as const })),
    category: 'merge',
    // x{input}{output}: how much of each input goes to each output, on the potentiometer
    // scale (0 = off, 75 = full level, 100 = +10 dB). Every knob starts at full level.
    defaultParams: Object.fromEntries(
      MATRIX_INPUTS.flatMap((i) => MATRIX_OUTPUTS.map((o) => [matrixParam(i, o), 75])),
    ),
  },
  'graphic-eq': {
    typeKey: 'graphic-eq',
    label: 'Graphic EQ',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'follow',
    // b0..b9 = gain for each of the 10 standard octave bands
    defaultParams: { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0, b7: 0, b8: 0, b9: 0 },
  },
  speaker: {
    typeKey: 'speaker',
    label: 'Speaker',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [],
    category: 'sink',
    // Passive speaker — requires a power amplifier (amp node) upstream to produce sound
    defaultParams: { outputTrimDb: 0 },
  },
  'active-speaker': {
    typeKey: 'active-speaker',
    label: 'Active Speaker',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [],
    category: 'sink',
    // Active/powered speaker — has built-in amplification, works directly from line level
    defaultParams: { volumeDb: 0 },
  },
}

// ── Mono / stereo ports ────────────────────────────────────────────────────────

/** Bus types whose inputs accept any number of wires (they are added together). */
export const MULTI_WIRE_TYPES = new Set(['master-bus', 'aux-bus'])

/** True when this node's own setting is stereo (Mono | Stereo switch on, or always stereo). */
export function isNodeStereo(node: Pick<SignalNode, 'typeKey' | 'params'>): boolean {
  const support = NODE_REGISTRY[node.typeKey]?.stereo ?? 'never'
  if (support === 'always') return true
  return support === 'optional' && node.params.stereo === true
}

/** Which side a bus output carries: 'l' / 'r' for Left / Right outputs, null otherwise. */
export function portSide(portId: string): 'l' | 'r' | null {
  if (portId.endsWith('-l')) return 'l'
  if (portId.endsWith('-r')) return 'r'
  return null
}

/** The bus output that carries the whole stereo mix while a Main Fader is attached. */
export const MIX_PORT = 'mix'

const MIX_OUTPUTS: NodePort[] = [{ id: MIX_PORT, label: 'Mix', side: 'right' }]
const MAIN_FADER_OUTPUTS: NodePort[] = [
  { id: 'out-l', label: 'Left Out',  side: 'right' },
  { id: 'out-r', label: 'Right Out', side: 'right' },
]

/** A bus that sends its mix out as Left and Right: the Master, or an Aux set to Stereo. */
export function isStereoBus(node: Pick<SignalNode, 'typeKey' | 'params'>): boolean {
  return MULTI_WIRE_TYPES.has(node.typeKey) && isNodeStereo(node)
}

/** The wires and cards a node's port layout is read from. */
export type GraphView = { nodes: SignalNode[]; edges: SignalEdge[] }

/**
 * The ports a node shows right now. Inputs never change. Outputs:
 * - a bus switched to Stereo splits its output into Left and Right;
 * - a stereo bus with a Main Fader attached has one Mix output instead
 *   (its L / R moved to the fader);
 * - a Fader fed from a bus's Mix output is the Main Fader, with Left and Right outputs.
 * Pass the graph so the Main Fader layout can be read from the wires.
 */
export function getPorts(
  node: Pick<SignalNode, 'typeKey' | 'params'> & { id?: string },
  graph?: GraphView,
): {
  inputs: NodePort[]
  outputs: NodePort[]
} {
  const def = NODE_REGISTRY[node.typeKey]
  if (!def) return { inputs: [], outputs: [] }
  let outputs = def.stereoOutputs && isNodeStereo(node) ? def.stereoOutputs : def.outputs
  if (graph && node.id) {
    if (isStereoBus(node) && graph.edges.some((e) => e.source === node.id && e.sourceHandle === MIX_PORT)) {
      outputs = MIX_OUTPUTS
    } else if (node.typeKey === 'fader' && mixBusOf(node.id, graph) !== null) {
      outputs = MAIN_FADER_OUTPUTS
    }
  }
  return { inputs: def.inputs, outputs }
}

/**
 * The bus whose Mix output feeds this Fader — straight in, or through effects on the way
 * (a limiter on the master, say). Null when it is not a Main Fader.
 */
export function mixBusOf(faderId: string, graph: GraphView): string | null {
  const seen = new Set<string>()
  let cur = faderId
  for (;;) {
    const wire = graph.edges.find((e) => e.target === cur)
    if (!wire) return null
    if (wire.sourceHandle === MIX_PORT) return wire.source
    const src = graph.nodes.find((n) => n.id === wire.source)
    const def = src && NODE_REGISTRY[src.typeKey]
    // Walk back through one-input effects only; another fader would be the Main Fader itself
    if (!src || !def || seen.has(src.id) || src.typeKey === 'fader' ||
        def.stereo !== 'follow' || def.inputs.length !== 1) return null
    seen.add(src.id)
    cur = src.id
  }
}

/**
 * Which help text a node opens: the Pan node fed a stereo wire is a Balance knob,
 * a Fader on a bus's Mix output is the Main Fader.
 */
export function helpKeyOf(
  node: Pick<SignalNode, 'typeKey'>,
  stage?: { stereoIn?: boolean; mainFader?: boolean },
): string {
  if (node.typeKey === 'pan' && stage?.stereoIn) return 'balance'
  if (node.typeKey === 'fader' && stage?.mainFader) return 'main-fader'
  return node.typeKey
}
