import type { ComplexityLevel } from '../store/signalStore'

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
export const CHANNEL_NODE_ORDER = ['source', 'preamp', 'eq', 'comp', 'fader']

// Canonical order of master section node IDs
export const MASTER_NODE_ORDER = ['master-bus', 'master-fader', 'output-eq', 'output-gain', 'speaker']

// Legacy — used by ChainEdge for insertable-node ordering within a channel
export const CHAIN_ORDER = ['mic', 'preamp', 'eq', 'comp', 'fader', 'master-bus', 'master-fader', 'output-eq', 'output-gain', 'speaker']
