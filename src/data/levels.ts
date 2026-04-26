import type { ComplexityLevel } from '../store/signalStore'
import type { SignalNode, SignalEdge } from './nodeRegistry'
import { H_SPACING, V_SPACING } from './nodeRegistry'
export { H_SPACING, V_SPACING }

export type BusType = 'aux' | 'fx' | 'pfl' | 'matrix'

export interface LevelLimits {
  maxInputChannels: number
  maxAuxBuses: number
  maxFxEngines: number
  maxPflBuses: number
  hasMatrixBuses: boolean
  hasUsbInterface: boolean
}

export const LEVEL_LIMITS: Record<ComplexityLevel, LevelLimits> = {
  beginner:          { maxInputChannels: 1, maxAuxBuses: 1,  maxFxEngines: 0, maxPflBuses: 1, hasMatrixBuses: false, hasUsbInterface: false },
  intermediate:      { maxInputChannels: 2, maxAuxBuses: 2,  maxFxEngines: 1, maxPflBuses: 1, hasMatrixBuses: false, hasUsbInterface: false },
  advanced:          { maxInputChannels: 8, maxAuxBuses: 6,  maxFxEngines: 4, maxPflBuses: 1, hasMatrixBuses: true,  hasUsbInterface: true  },
  'routing-madness': { maxInputChannels: 8, maxAuxBuses: 6,  maxFxEngines: 4, maxPflBuses: 1, hasMatrixBuses: true,  hasUsbInterface: true  },
}

export const CHANNEL_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#84cc16',
]

// Canonical order of insertable node type-keys within a channel
export const CHANNEL_NODE_ORDER = ['source', 'preamp', 'hpf', 'eq', 'comp', 'fader']

// Canonical order of master section node IDs
export const MASTER_NODE_ORDER = ['master-bus', 'master-fader', 'graphic-eq', 'speaker']

// Used by ChainEdge for insertable-node ordering within a channel
export const CHAIN_ORDER = ['mic', 'preamp', 'hpf', 'eq', 'comp', 'fader', 'master-bus', 'master-fader', 'graphic-eq', 'speaker']

// ── Default graph per level ───────────────────────────────────────────────────

export function buildDefaultGraph(level: ComplexityLevel): { nodes: SignalNode[]; edges: SignalEdge[] } {
  if (level === 'beginner') {
    return {
      nodes: [
        {
          id: 'mic-1',
          typeKey: 'mic',
          position: { x: 0, y: 0 },
          params: { sensitivityDb: -60 },
          bypassed: false,
          draggable: true,
          label: 'Microphone',
          color: CHANNEL_COLORS[0],
        },
        {
          id: 'speaker-1',
          typeKey: 'speaker',
          position: { x: H_SPACING, y: 0 },
          params: { outputTrimDb: 0 },
          bypassed: false,
          draggable: true,
          label: 'Speaker',
        },
      ],
      edges: [
        { id: 'e-mic1-spk1', source: 'mic-1', sourceHandle: 'out', target: 'speaker-1', targetHandle: 'in' },
      ],
    }
  }

  // intermediate / advanced / routing-madness
  // mic-1 → gain-1 → fader-ch → master-bus → fader-master → amp-1 → speaker-1
  const y = 0
  const nodes: SignalNode[] = [
    {
      id: 'mic-1',
      typeKey: 'mic',
      position: { x: 0, y },
      params: { sensitivityDb: -60 },
      bypassed: false,
      draggable: true,
      label: 'Microphone',
      color: CHANNEL_COLORS[0],
    },
    {
      id: 'gain-1',
      typeKey: 'gain',
      position: { x: H_SPACING, y },
      params: { gainDb: 40 },
      bypassed: false,
      draggable: false,
      label: 'Preamp',
      color: CHANNEL_COLORS[0],
    },
    {
      id: 'fader-ch',
      typeKey: 'fader',
      position: { x: H_SPACING * 2, y },
      params: { faderDb: 0 },
      bypassed: false,
      draggable: false,
      label: 'Channel Fader',
      color: CHANNEL_COLORS[0],
    },
    {
      id: 'master-bus',
      typeKey: 'master-bus',
      position: { x: H_SPACING * 3, y },
      params: {},
      bypassed: false,
      draggable: false,
      label: 'Master Bus',
    },
    {
      id: 'fader-master',
      typeKey: 'fader',
      position: { x: H_SPACING * 4, y },
      params: { faderDb: 0 },
      bypassed: false,
      draggable: false,
      label: 'Master Fader',
    },
    {
      id: 'amp-1',
      typeKey: 'amp',
      position: { x: H_SPACING * 5, y },
      params: { gainDb: 20 },
      bypassed: false,
      draggable: false,
      label: 'Amplifier',
    },
    {
      id: 'speaker-1',
      typeKey: 'speaker',
      position: { x: H_SPACING * 6, y },
      params: { outputTrimDb: 0 },
      bypassed: false,
      draggable: true,
      label: 'Speaker',
    },
  ]

  const edges: SignalEdge[] = [
    { id: 'e-mic1-gain1',       source: 'mic-1',       sourceHandle: 'out', target: 'gain-1',       targetHandle: 'in' },
    { id: 'e-gain1-faderch',    source: 'gain-1',      sourceHandle: 'out', target: 'fader-ch',     targetHandle: 'in' },
    { id: 'e-faderch-mbus',     source: 'fader-ch',    sourceHandle: 'out', target: 'master-bus',   targetHandle: 'in-1' },
    { id: 'e-mbus-faderm',      source: 'master-bus',  sourceHandle: 'out', target: 'fader-master', targetHandle: 'in' },
    { id: 'e-faderm-amp1',      source: 'fader-master',sourceHandle: 'out', target: 'amp-1',        targetHandle: 'in' },
    { id: 'e-amp1-spk1',        source: 'amp-1',       sourceHandle: 'out', target: 'speaker-1',   targetHandle: 'in' },
  ]

  return { nodes, edges }
}
