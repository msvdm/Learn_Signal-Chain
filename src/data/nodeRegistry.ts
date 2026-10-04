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

/**
 * A stereo bus's (or its Main Fader's) send to Matrix Buses: Left and Right together on one wire,
 * after the fader. It shows below the R output once a wire uses it.
 */
export const MATRIX_PORT = 'send'

const MIX_OUTPUTS: NodePort[] = [{ id: MIX_PORT, label: 'Mix' }]
const MATRIX_SEND_OUTPUT: NodePort = { id: MATRIX_PORT, label: 'Matrix send (L + R, after the fader)' }
const SIDE_OUTPUTS: NodePort[] = [
  { id: 'out-l', label: 'Left Out' },
  { id: 'out-r', label: 'Right Out' },
]

/**
 * Cards that take a stereo mix's Left / Right outputs over when wired to one of them, and send
 * L and R out separately: the Fader after a bus (Main Fader), the Graphic EQ and the Amplifier
 * (a two-channel amp). The Graphic EQ and the Amplifier do it for any stereo wire; fed one
 * channel they stay single-channel.
 */
export const SPLIT_TYPES = new Set(['fader', 'graphic-eq', 'amp'])

/** What a wire carries: one channel, both sides, or one side of a stereo mix. */
export type WireKind = 'mono' | 'stereo' | 'left' | 'right'

/**
 * What output `handleId` of a card carries, read from the wires (the signal maths gives the
 * same answer): L / R outputs carry one side, a Mix or Matrix send both; a Pan, a stereo source or
 * bus sends stereo; an effect passes on what reaches it; everything else is one channel.
 */
export function outputKind(nodeId: string, handleId: string, graph: GraphView, seen = new Set<string>()): WireKind {
  const side = portSide(handleId)
  if (side) return side === 'l' ? 'left' : 'right'
  if (handleId === MIX_PORT || handleId === MATRIX_PORT) return 'stereo'
  const node = graph.nodes.find((n) => n.id === nodeId)
  if (!node || seen.has(nodeId)) return 'mono'
  seen.add(nodeId)
  if (node.typeKey === 'pan') return 'stereo'
  if (NODE_REGISTRY[node.typeKey]?.stereo !== 'follow') return isNodeStereo(node) ? 'stereo' : 'mono'
  // The Relay passes on its selected input
  const selected = (node.params.selectedInput as string) ?? 'a'
  const wire = graph.edges.find((e) => e.target === nodeId && (node.typeKey !== 'relay' || e.targetHandle === `in-${selected}`))
  return wire ? outputKind(wire.source, wire.sourceHandle, graph, seen) : 'mono'
}

/**
 * True when this card splits a stereo signal into Left and Right: a Fader fed a bus's mix (the
 * Main Fader), or a Graphic EQ / Amplifier fed a stereo wire. A Graphic EQ / Amplifier with
 * nothing plugged in keeps the layout its wires show, so plugging it back in restores L and R.
 */
export function splitsStereo(node: Pick<SignalNode, 'id' | 'typeKey'>, graph: GraphView): boolean {
  if (!SPLIT_TYPES.has(node.typeKey)) return false
  if (node.typeKey === 'fader') return mixBusOf(node.id, graph) !== null
  const wire = graph.edges.find((e) => e.target === node.id)
  if (!wire) {
    return graph.edges.some((e) => e.source === node.id && (portSide(e.sourceHandle) !== null || e.sourceHandle === MIX_PORT))
  }
  return outputKind(wire.source, wire.sourceHandle, graph) === 'stereo'
}

/** A bus that sends its mix out as Left and Right: the Master, or an Aux set to Stereo. */
export function isStereoBus(node: Pick<SignalNode, 'typeKey' | 'params'>): boolean {
  return MULTI_WIRE_TYPES.has(node.typeKey) && isNodeStereo(node)
}

/** The wires and cards a node's port layout is read from. */
export type GraphView = { nodes: SignalNode[]; edges: SignalEdge[] }

/**
 * The ports a node shows right now. Inputs never change. Outputs:
 * - a bus switched to Stereo splits its output into Left and Right;
 * - a Fader fed from a bus's Mix output is the Main Fader, with Left and Right outputs; a Graphic EQ
 *   or Amplifier fed a stereo wire has Left and Right outputs too (splitsStereo);
 * - any of these whose L / R were taken over by the next card (a Main Fader, an EQ, an amp) has
 *   one Mix output instead;
 * - a Matrix send output below R while a wire uses it.
 * Pass the graph so the layout can be read from the wires.
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
    const id      = node.id
    const passing = graph.edges.some((e) => e.source === id && e.sourceHandle === MIX_PORT)
    if (isStereoBus(node) && passing) {
      outputs = MIX_OUTPUTS
    } else if (splitsStereo({ id, typeKey: node.typeKey }, graph)) {
      outputs = passing ? MIX_OUTPUTS : SIDE_OUTPUTS
    }
    if (graph.edges.some((e) => e.source === node.id && e.sourceHandle === MATRIX_PORT)) {
      outputs = [...outputs, MATRIX_SEND_OUTPUT]
    }
  }
  return { inputs: def.inputs, outputs }
}

/**
 * Walks back from a card through one-input effects (EQ, comp, pad …) and returns the first
 * match. Stops at another card of the same type — that one would take the role itself.
 */
function findUpstream(
  nodeId: string,
  graph: GraphView,
  match: (wire: SignalEdge, source: SignalNode | undefined) => string | null,
): string | null {
  const own  = graph.nodes.find((n) => n.id === nodeId)?.typeKey
  const seen = new Set<string>()
  let cur = nodeId
  for (;;) {
    const wire = graph.edges.find((e) => e.target === cur)
    if (!wire) return null
    const src = graph.nodes.find((n) => n.id === wire.source)
    const found = match(wire, src)
    if (found) return found
    const def = src && NODE_REGISTRY[src.typeKey]
    if (!src || !def || seen.has(src.id) || src.typeKey === own ||
        def.stereo !== 'follow' || def.inputs.length !== 1) return null
    seen.add(src.id)
    cur = src.id
  }
}

/**
 * The card whose Mix output feeds this one — straight in, or through effects on the way.
 * Null when no mix reaches it.
 */
export function mixSourceOf(nodeId: string, graph: GraphView): string | null {
  return findUpstream(nodeId, graph, (wire) => (wire.sourceHandle === MIX_PORT ? wire.source : null))
}

/**
 * The bus whose mix feeds this card — through effects on the way (a limiter on the master, say)
 * and through cards that passed it on (a Main Fader, a Graphic EQ). For a Fader: null when it is
 * not a Main Fader.
 */
export function mixBusOf(nodeId: string, graph: GraphView): string | null {
  const seen = new Set<string>()
  let cur: string | null = nodeId
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    const via = mixSourceOf(cur, graph)
    const src = via ? graph.nodes.find((n) => n.id === via) : undefined
    if (!src) return null
    if (isStereoBus(src)) return src.id
    cur = src.id
  }
  return null
}

/**
 * The Master or Aux Bus whose mix leaves this card: the bus itself, or the bus before
 * one-input effects (a limiter, an EQ, the Main Fader …). Null when the card carries no mix.
 */
export function sourceBusOf(nodeId: string, graph: GraphView): string | null {
  const seen = new Set<string>()
  let cur = graph.nodes.find((n) => n.id === nodeId)
  while (cur && !seen.has(cur.id)) {
    if (MIX_BUS_TYPES.has(cur.typeKey)) return cur.id
    const def = NODE_REGISTRY[cur.typeKey]
    if (!def || def.stereo !== 'follow' || def.inputs.length !== 1) return null
    seen.add(cur.id)
    const id   = cur.id
    const wire = graph.edges.find((e) => e.target === id)
    cur = wire && graph.nodes.find((n) => n.id === wire.source)
  }
  return null
}

/**
 * True when output `handleId` of this card may feed a Matrix Bus. Matrix sends are post-fader:
 * - the Matrix send, or the L / R of a stereo bus or of its Main Fader (that wire becomes the
 *   Matrix send);
 * - a mono Aux Bus's output, straight or through its fader / effects.
 * Never a bus's Mix output (that is before the Main Fader), a single source, or another Matrix Bus.
 */
export function isMatrixSource(nodeId: string, handleId: string, graph: GraphView): boolean {
  let cur: SignalNode | undefined = graph.nodes.find((n) => n.id === nodeId)
  if (!cur || cur.typeKey === 'matrix-bus' || handleId === MIX_PORT) return false
  if (handleId === MATRIX_PORT || portSide(handleId) !== null) {
    // L / R belong to a stereo bus or its Main Fader — but not a Matrix Bus's own Main Fader
    const bus = cur.typeKey === 'fader' ? mixBusOf(cur.id, graph) : cur.id
    return bus !== null && MIX_BUS_TYPES.has(graph.nodes.find((n) => n.id === bus)?.typeKey ?? '')
  }
  let port = handleId
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    if (MIX_BUS_TYPES.has(cur.typeKey)) return port === 'out'
    const def = NODE_REGISTRY[cur.typeKey]
    if (!def || def.stereo !== 'follow' || def.inputs.length !== 1) return false
    seen.add(cur.id)
    const id: string = cur.id
    const wire: SignalEdge | undefined = graph.edges.find((e) => e.target === id)
    if (!wire) return false
    port = wire.sourceHandle
    cur  = graph.nodes.find((n) => n.id === wire.source)
  }
  return false
}

/**
 * Which bus a wire into a Matrix Bus belongs to: one send knob per bus, so a bus's L and R
 * wires share it. A wire that no longer carries a mix keeps a knob of its own card.
 */
export function matrixSendKey(wire: SignalEdge, graph: GraphView): string {
  return sourceBusOf(wire.source, graph) ?? wire.source
}

/** Param key of a Matrix Bus send knob (`key` from matrixSendKey). */
export function matrixSendParam(key: string): string {
  return `send-${key}`
}

/**
 * The microphone this Gain is the Preamp of — straight after it, or with effects such as
 * a Pad in between. Null when it is a plain gain stage.
 */
export function preampMicOf(gainId: string, graph: GraphView): string | null {
  return findUpstream(gainId, graph, (_wire, src) => (src?.typeKey === 'mic' ? src.id : null))
}

/**
 * Which help text a node opens: the Pan node fed a stereo wire is a Balance knob,
 * a Fader on a bus's Mix output is the Main Fader, a Gain after a microphone is a Preamp.
 */
export function helpKeyOf(
  node: Pick<SignalNode, 'typeKey'>,
  stage?: { stereoIn?: boolean; mainFader?: boolean; preamp?: boolean },
): string {
  if (node.typeKey === 'pan' && stage?.stereoIn) return 'balance'
  if (node.typeKey === 'fader' && stage?.mainFader) return 'main-fader'
  if (node.typeKey === 'gain' && stage?.preamp) return 'preamp'
  return node.typeKey
}
