// Node type registry — single source of truth for port definitions and defaults.
// No imports from the rest of the app; safe to import from anywhere.

export type NodePort = {
  id: string
  label: string
  side: 'left' | 'right'
}

export type NodeCategory = 'source' | 'processor' | 'merge' | 'split' | 'sink'

export type EQBand = {
  freqHz: number
  gainDb: number
  Q?: number
  type?: 'bell' | 'low-shelf' | 'high-shelf'
}

export type NodeParamValue = number | string | boolean | EQBand[]

export type NodeTypeDef = {
  typeKey: string
  label: string
  inputs: NodePort[]
  outputs: NodePort[]
  category: NodeCategory
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
}

export const H_SPACING = 278
export const V_SPACING = 200

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
    defaultParams: { levelDb: -10 },
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
    defaultParams: { thresholdDb: 0, ratio: 2, makeupGainDb: 0 },
  },
  fader: {
    typeKey: 'fader',
    label: 'Fader',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    defaultParams: { faderDb: 0 },
  },
  switch: {
    typeKey: 'switch',
    label: 'Switch',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    defaultParams: { on: true },
  },
  splitter: {
    typeKey: 'splitter',
    label: 'Splitter',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [
      { id: 'out-1', label: 'Out A', side: 'right' },
      { id: 'out-2', label: 'Out B', side: 'right' },
    ],
    category: 'split',
    defaultParams: {},
  },
  potentiometer: {
    typeKey: 'potentiometer',
    label: 'Potentiometer',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    // position: 0–100 knob position. 0 = fully CCW (−∞), 75 = unity (0 dB), 100 = fully CW (+10 dB)
    defaultParams: { position: 75 },
  },
  amp: {
    typeKey: 'amp',
    label: 'Amplifier',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    defaultParams: { gainDb: 20 },
  },
  'master-bus': {
    typeKey: 'master-bus',
    label: 'Master Bus',
    inputs: [], // dynamic at runtime — one per connected channel
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'merge',
    defaultParams: {},
  },
  bus: {
    typeKey: 'bus',
    label: 'Bus',
    inputs: [], // dynamic at runtime
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'merge',
    defaultParams: { faderDb: 0, isStereo: true, busType: 'aux' },
  },
  'graphic-eq': {
    typeKey: 'graphic-eq',
    label: 'Graphic EQ',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    // b0..b9 = gain for each of the 10 standard octave bands
    defaultParams: { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0, b7: 0, b8: 0, b9: 0 },
  },
  speaker: {
    typeKey: 'speaker',
    label: 'Speaker',
    inputs: [{ id: 'in', label: 'Input', side: 'left' }],
    outputs: [],
    category: 'sink',
    defaultParams: { outputTrimDb: 0 },
  },
  'conn-point': {
    typeKey: 'conn-point',
    label: 'Connection Point',
    inputs:  [{ id: 'in',  label: 'Input',  side: 'left'  }],
    outputs: [{ id: 'out', label: 'Output', side: 'right' }],
    category: 'processor',
    defaultParams: {},
  },
}
