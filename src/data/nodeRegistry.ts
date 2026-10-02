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
 * Mono / stereo support:
 * - 'never'    — always one channel (default)
 * - 'optional' — the card has a Mono | Stereo switch, stored in params.stereo
 * - 'always'   — always two channels, Left and Right
 */
export type StereoSupport = 'never' | 'optional' | 'always'

export type NodeTypeDef = {
  typeKey: string
  label: string
  inputs: NodePort[]
  outputs: NodePort[]
  category: NodeCategory
  stereo?: StereoSupport
  /** Stereo ports when they are not simply each mono port split into -l / -r. */
  stereoInputs?: NodePort[]
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
    defaultParams: { gainDb: 40 },
  },
  hpf: {
    typeKey: 'hpf',
    label: 'High-Pass Filter',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    defaultParams: { cutoffHz: 80 },
  },
  eq: {
    typeKey: 'eq',
    label: 'Parametric EQ',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'optional',
    defaultParams: {
      bands: [
        { freqHz: 200,  gainDb: 0, Q: 1.4, type: 'bell' },
        { freqHz: 500,  gainDb: 0, Q: 1.4, type: 'bell' },
        { freqHz: 1000, gainDb: 0, Q: 1.4, type: 'bell' },
        { freqHz: 8000, gainDb: 0, Q: 1.4, type: 'bell' },
      ] as EQBand[],
      stereo: false,
    },
  },
  comp: {
    typeKey: 'comp',
    label: 'Compressor',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'optional',
    defaultParams: { thresholdDb: -20, ratio: 2, makeupGainDb: 0, stereo: false },
  },
  fader: {
    typeKey: 'fader',
    label: 'Fader',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'optional',
    defaultParams: { faderDb: 0, stereo: false },
  },
  switch: {
    typeKey: 'switch',
    label: 'Switch',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'optional',
    defaultParams: { on: true, stereo: false },
  },
  potentiometer: {
    typeKey: 'potentiometer',
    label: 'Potentiometer',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'optional',
    // position: 0–100 knob position. 0 = fully CCW (−∞), 75 = unity (0 dB), 100 = fully CW (+10 dB)
    defaultParams: { position: 75, stereo: false },
  },
  amp: {
    typeKey: 'amp',
    label: 'Amplifier',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'optional',
    defaultParams: { gainDb: 20, stereo: false },
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
    stereo: 'optional',
    defaultParams: { groundLift: false, stereo: false },
  },
  'noise-gate': {
    typeKey: 'noise-gate',
    label: 'Noise Gate',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'optional',
    defaultParams: { thresholdDb: -40, stereo: false },
  },
  limiter: {
    typeKey: 'limiter',
    label: 'Limiter',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'optional',
    defaultParams: { thresholdDb: -3, makeupGainDb: 0, stereo: false },
  },
  pad: {
    typeKey: 'pad',
    label: 'Pad',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    defaultParams: { engaged: true },
  },
  deesser: {
    typeKey: 'deesser',
    label: 'De-esser',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'optional',
    defaultParams: { thresholdDb: -20, frequencyHz: 6000, stereo: false },
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
    stereo: 'optional',
    defaultParams: { selectedInput: 'a', stereo: false },
  },
  pan: {
    typeKey: 'pan',
    label: 'Pan',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [
      { id: 'out-l', label: 'Left', side: 'right' },
      { id: 'out-r', label: 'Right', side: 'right' },
    ],
    category: 'processor',
    // Mono = Pan knob (one input spread over L/R). Stereo = Balance knob (L/R in → L/R out).
    stereo: 'optional',
    stereoInputs: [
      { id: 'in-l', label: 'L In', side: 'left' },
      { id: 'in-r', label: 'R In', side: 'left' },
    ],
    stereoOutputs: [
      { id: 'out-l', label: 'Left', side: 'right' },
      { id: 'out-r', label: 'Right', side: 'right' },
    ],
    defaultParams: { panPosition: 50, stereo: false },
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
    stereo: 'optional',
    // alignmentDb: offset between analog reference level and digital full scale
    // Standard: -18 dBu = 0 dBFS (EBU R68). So a -18 dBu signal becomes 0 dBFS.
    defaultParams: { alignmentDb: 18, stereo: false },
  },
  dac: {
    typeKey: 'dac',
    label: 'DAC',
    inputs: [{ id: 'in', label: 'Digital In', side: 'left' }],
    outputs: [{ id: 'out', label: 'Analog Out', side: 'right' }],
    category: 'processor',
    stereo: 'optional',
    defaultParams: { alignmentDb: 18, stereo: false },
  },
  'master-bus': {
    typeKey: 'master-bus',
    label: 'Master Bus',
    // Always stereo. Each input accepts any number of wires; they are added together.
    inputs: [
      { id: 'in-l', label: 'L In', side: 'left' },
      { id: 'in-r', label: 'R In', side: 'left' },
    ],
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
    // Each input accepts any number of wires; they are added together.
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'merge',
    stereo: 'optional',
    defaultParams: { faderDb: 0, stereo: false },
  },
  'graphic-eq': {
    typeKey: 'graphic-eq',
    label: 'Graphic EQ',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    stereo: 'optional',
    // b0..b9 = gain for each of the 10 standard octave bands
    defaultParams: { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0, b7: 0, b8: 0, b9: 0, stereo: false },
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

/** True when this node currently carries two channels (Left and Right). */
export function isNodeStereo(node: Pick<SignalNode, 'typeKey' | 'params'>): boolean {
  const support = NODE_REGISTRY[node.typeKey]?.stereo ?? 'never'
  if (support === 'always') return true
  return support === 'optional' && node.params.stereo === true
}

/** Which side a port carries: 'l' / 'r' for stereo ports, null for mono ports. */
export function portSide(portId: string): 'l' | 'r' | null {
  if (portId.endsWith('-l')) return 'l'
  if (portId.endsWith('-r')) return 'r'
  return null
}

/** The mono port id a stereo port was made from ('in-l' → 'in'). */
export function basePortId(portId: string): string {
  return portSide(portId) ? portId.slice(0, -2) : portId
}

function splitPorts(ports: NodePort[]): NodePort[] {
  return ports.flatMap((p) => [
    { ...p, id: `${p.id}-l`, label: `L ${p.label}` },
    { ...p, id: `${p.id}-r`, label: `R ${p.label}` },
  ])
}

/**
 * The ports a node shows right now. In stereo mode every mono port becomes an
 * L / R pair ('in' → 'in-l' + 'in-r'), unless the type lists its own stereo ports.
 */
export function getPorts(node: Pick<SignalNode, 'typeKey' | 'params'>): {
  inputs: NodePort[]
  outputs: NodePort[]
  isStereo: boolean
} {
  const def = NODE_REGISTRY[node.typeKey]
  if (!def) return { inputs: [], outputs: [], isStereo: false }
  const stereo = isNodeStereo(node)
  if (!stereo || def.stereo === 'always') {
    return { inputs: def.inputs, outputs: def.outputs, isStereo: stereo }
  }
  return {
    inputs:  def.stereoInputs  ?? splitPorts(def.inputs),
    outputs: def.stereoOutputs ?? splitPorts(def.outputs),
    isStereo: true,
  }
}

/** Which help text a node opens: the Pan node in stereo mode is a Balance knob. */
export function helpKeyOf(node: Pick<SignalNode, 'typeKey' | 'params'>): string {
  return node.typeKey === 'pan' && isNodeStereo(node) ? 'balance' : node.typeKey
}
