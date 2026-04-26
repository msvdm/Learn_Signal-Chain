import { create } from 'zustand'
import type { Lang } from '../i18n/translations'
import { LEVEL_LIMITS, CHANNEL_COLORS } from '../data/levels'
import type { BusType } from '../data/levels'

export type ComplexityLevel = 'beginner' | 'intermediate' | 'advanced' | 'routing-madness'
export type SourceType = 'mic' | 'line' | 'instrument'
export { type BusType }

function getInitialLanguage(): Lang {
  const stored = localStorage.getItem('lsc-language')
  if (stored === 'en' || stored === 'bg') return stored
  return navigator.language.startsWith('bg') ? 'bg' : 'en'
}

function getInitialComplexityLevel(): ComplexityLevel {
  const stored = localStorage.getItem('lsc-complexity-level')
  if (stored === 'beginner' || stored === 'intermediate' ||
      stored === 'advanced' || stored === 'routing-madness') return stored
  return 'beginner'
}

export interface EQBand {
  freqHz: number
  gainDb: number
  type?: 'bell' | 'high-shelf' | 'low-shelf'
  Q?: number
}

// Per-channel slider state
export interface ChannelNodeState {
  sourceType: SourceType
  micSensitivityDb: number
  lineInputDb: number
  instrumentInputDb: number
  preampGainDb: number
  eqHpfHz: number
  eqBands: EQBand[]  // 4 bands: [Low(200Hz), LoMid(500Hz), Mid(1kHz), High(8kHz)]
  compThresholdDb: number
  compRatio: 2 | 4 | 8 | 100
  compMakeupGainDb: number
  faderDb: number
}

export const DEFAULT_CHANNEL_NODE_STATE: ChannelNodeState = {
  sourceType: 'mic',
  micSensitivityDb: -60,
  lineInputDb: -10,
  instrumentInputDb: -30,
  preampGainDb: 40,
  eqHpfHz: 80,
  eqBands: [
    { freqHz: 200,  gainDb: 0 },   // Low
    { freqHz: 500,  gainDb: 0 },   // Lo-Mid (advanced only)
    { freqHz: 1000, gainDb: 0 },   // Mid
    { freqHz: 8000, gainDb: 0 },   // High
  ],
  compThresholdDb: 0,
  compRatio: 2,
  compMakeupGainDb: 0,
  faderDb: 0,
}

// Master-section state (shared across all channels)
export interface MasterState {
  masterFaderDb: number
  outputGainDb: number
  graphicEqBands: EQBand[]  // 10-band graphic EQ at standard 1-octave frequencies
}

const GRAPHIC_EQ_FREQS = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

export const DEFAULT_MASTER_STATE: MasterState = {
  masterFaderDb: 0,
  outputGainDb: 0,
  graphicEqBands: GRAPHIC_EQ_FREQS.map((freqHz) => ({ freqHz, gainDb: 0 })),
}

// A single input channel with its own signal chain
export interface Channel {
  id: string
  sourceType: SourceType
  label: string
  color: string
  chainOrder: string[]       // node type-keys: e.g. ['source','preamp','fader']
  bypassedNodes: Set<string> // node type-keys
  nodeState: ChannelNodeState
}

// A shared bus node (aux, fx, pfl, matrix) placed on the canvas
export interface Bus {
  id: string
  busType: BusType
  label: string
  position: { x: number; y: number }
  faderDb: number
  isStereo: boolean
}

// A tap connection from a chain node to a Bus
export interface Send {
  id: string
  fromNodeId: string   // '{channelId}:{typeKey}' — the tap point
  busId: string        // references Bus.id
  sendLevelDb: number  // per-send level (0 = unity)
}

function makeChannel(index: number, sourceType: SourceType = 'mic'): Channel {
  return {
    id: `ch-${index + 1}`,
    sourceType,
    label: `CH ${index + 1}`,
    color: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
    chainOrder: ['source', 'preamp', 'fader'],
    bypassedNodes: new Set(),
    nodeState: { ...DEFAULT_CHANNEL_NODE_STATE, sourceType },
  }
}

function getInitialChannels(): Channel[] {
  return [makeChannel(0, 'mic')]
}

interface SignalChainStore {
  language: Lang
  complexityLevel: ComplexityLevel
  activeTooltipId: string | null

  channels: Channel[]
  masterState: MasterState
  masterChainOrder: string[]  // dynamic master node sequence
  buses: Bus[]
  sends: Send[]

  setLanguage: (lang: Lang) => void
  setActiveTooltip: (id: string | null) => void
  setComplexityLevel: (level: ComplexityLevel) => void
  resetAll: () => void

  // Channel management
  addChannel: (sourceType: SourceType) => void
  removeChannel: (channelId: string) => void

  // Per-channel mutations
  updateChannelNodeState: (channelId: string, patch: Partial<ChannelNodeState>) => void
  updateChannelEQBand: (channelId: string, index: number, patch: Partial<EQBand>) => void
  insertChannelNode: (channelId: string, typeKey: string, afterTypeKey: string) => void
  removeChannelNode: (channelId: string, typeKey: string) => void
  toggleBypassChannelNode: (channelId: string, typeKey: string) => void

  // Master mutations
  updateMasterState: (patch: Partial<MasterState>) => void
  updateGraphicEQBand: (index: number, patch: Partial<EQBand>) => void
  insertMasterNode: (nodeId: string, afterNodeId: string) => void
  removeMasterNode: (nodeId: string) => void

  // Bus management
  addBus: (busType: BusType, defaultPosition: { x: number; y: number }) => void
  removeBus: (busId: string) => void
  updateBus: (busId: string, patch: Partial<Pick<Bus, 'faderDb' | 'isStereo' | 'position'>>) => void

  // Send management (tap-to-bus connections)
  addSend: (fromNodeId: string, busId: string) => void
  removeSend: (sendId: string) => void
  updateSendLevel: (sendId: string, sendLevelDb: number) => void
}

// Protected node type-keys within a channel — source cannot be removed, only the channel itself
const CHANNEL_PROTECTED = new Set(['source'])
// Globally protected master node IDs — speaker is always the final output, never removable
const MASTER_PROTECTED = new Set(['master-bus', 'master-fader', 'speaker'])

export const useSignalStore = create<SignalChainStore>((set) => ({
  language: getInitialLanguage(),
  complexityLevel: getInitialComplexityLevel(),
  activeTooltipId: null,

  channels: getInitialChannels(),
  masterState: { ...DEFAULT_MASTER_STATE },
  masterChainOrder: ['master-bus', 'master-fader', 'speaker'],
  buses: [],
  sends: [],

  setLanguage: (lang) => {
    localStorage.setItem('lsc-language', lang)
    set({ language: lang })
  },

  setActiveTooltip: (id) => set({ activeTooltipId: id }),

  setComplexityLevel: (level) => {
    localStorage.setItem('lsc-complexity-level', level)
    set({
      complexityLevel: level,
      channels: getInitialChannels(),
      masterState: { ...DEFAULT_MASTER_STATE },
      masterChainOrder: ['master-bus', 'master-fader', 'speaker'],
      buses: [],
      sends: [],
      activeTooltipId: null,
    })
  },

  resetAll: () =>
    set((s) => ({
      channels: getInitialChannels(),
      masterState: { ...DEFAULT_MASTER_STATE },
      masterChainOrder: ['master-bus', 'master-fader', 'speaker'],
      buses: [],
      sends: [],
      activeTooltipId: null,
      complexityLevel: s.complexityLevel,
    })),

  // ── Channel management ────────────────────────────────────────────────────

  addChannel: (sourceType) =>
    set((s) => {
      const limits = LEVEL_LIMITS[s.complexityLevel]
      if (s.channels.length >= limits.maxInputChannels) return {}
      const idx = s.channels.length
      return { channels: [...s.channels, makeChannel(idx, sourceType)] }
    }),

  removeChannel: (channelId) =>
    set((s) => {
      if (s.channels.length <= 1) return {}
      const channels = s.channels.filter((c) => c.id !== channelId)
      // Remove sends that originated from this channel
      const sends = s.sends.filter((send) => !send.fromNodeId.startsWith(`${channelId}:`))
      return { channels, sends }
    }),

  // ── Per-channel mutations ─────────────────────────────────────────────────

  updateChannelNodeState: (channelId, patch) =>
    set((s) => ({
      channels: s.channels.map((c) =>
        c.id === channelId
          ? { ...c, nodeState: { ...c.nodeState, ...patch } }
          : c
      ),
    })),

  updateChannelEQBand: (channelId, index, patch) =>
    set((s) => ({
      channels: s.channels.map((c) => {
        if (c.id !== channelId) return c
        const bands = [...c.nodeState.eqBands]
        bands[index] = { ...bands[index], ...patch }
        return { ...c, nodeState: { ...c.nodeState, eqBands: bands } }
      }),
    })),

  insertChannelNode: (channelId, typeKey, afterTypeKey) =>
    set((s) => ({
      channels: s.channels.map((c) => {
        if (c.id !== channelId) return c
        if (c.chainOrder.includes(typeKey)) return c
        const idx = c.chainOrder.indexOf(afterTypeKey)
        if (idx === -1) return c
        const next = [...c.chainOrder]
        next.splice(idx + 1, 0, typeKey)
        return { ...c, chainOrder: next }
      }),
    })),

  removeChannelNode: (channelId, typeKey) =>
    set((s) => ({
      channels: s.channels.map((c) => {
        if (c.id !== channelId) return c
        if (CHANNEL_PROTECTED.has(typeKey)) return c
        const chainOrder = c.chainOrder.filter((k) => k !== typeKey)
        const bypassedNodes = new Set(c.bypassedNodes)
        bypassedNodes.delete(typeKey)
        // Remove sends originating from this node
        return { ...c, chainOrder, bypassedNodes }
      }),
      sends: s.sends.filter((send) => send.fromNodeId !== `${channelId}:${typeKey}`),
    })),

  toggleBypassChannelNode: (channelId, typeKey) =>
    set((s) => ({
      channels: s.channels.map((c) => {
        if (c.id !== channelId) return c
        if (CHANNEL_PROTECTED.has(typeKey)) return c
        const bypassedNodes = new Set(c.bypassedNodes)
        if (bypassedNodes.has(typeKey)) bypassedNodes.delete(typeKey)
        else bypassedNodes.add(typeKey)
        return { ...c, bypassedNodes }
      }),
    })),

  // ── Master mutations ──────────────────────────────────────────────────────

  updateMasterState: (patch) =>
    set((s) => ({ masterState: { ...s.masterState, ...patch } })),

  updateGraphicEQBand: (index, patch) =>
    set((s) => {
      const bands = [...s.masterState.graphicEqBands]
      bands[index] = { ...bands[index], ...patch }
      return { masterState: { ...s.masterState, graphicEqBands: bands } }
    }),

  insertMasterNode: (nodeId, afterNodeId) =>
    set((s) => {
      if (s.masterChainOrder.includes(nodeId)) return {}
      const idx = s.masterChainOrder.indexOf(afterNodeId)
      if (idx === -1) return {}
      const next = [...s.masterChainOrder]
      next.splice(idx + 1, 0, nodeId)
      return { masterChainOrder: next }
    }),

  removeMasterNode: (nodeId) =>
    set((s) => ({
      masterChainOrder: s.masterChainOrder.filter((id) => id !== nodeId),
    })),

  // ── Bus management ────────────────────────────────────────────────────────

  addBus: (busType, defaultPosition) =>
    set((s) => {
      const limits = LEVEL_LIMITS[s.complexityLevel]
      const existing = s.buses.filter((b) => b.busType === busType)

      if (busType === 'aux' && existing.length >= limits.maxAuxBuses) return {}
      if (busType === 'fx' && existing.length >= limits.maxFxEngines) return {}
      if (busType === 'pfl' && existing.length >= limits.maxPflBuses) return {}
      if (busType === 'matrix' && !limits.hasMatrixBuses) return {}

      const num = existing.length + 1
      const labels: Record<BusType, string> = {
        aux:    `Aux ${num}`,
        fx:     `FX ${num}`,
        pfl:    'PFL',
        matrix: `Matrix ${num}`,
      }

      const bus: Bus = {
        id: `bus-${Date.now()}`,
        busType,
        label: labels[busType],
        position: defaultPosition,
        faderDb: 0,
        isStereo: busType !== 'pfl',
      }
      return { buses: [...s.buses, bus] }
    }),

  removeBus: (busId) =>
    set((s) => ({
      buses: s.buses.filter((b) => b.id !== busId),
      sends: s.sends.filter((send) => send.busId !== busId),
    })),

  updateBus: (busId, patch) =>
    set((s) => ({
      buses: s.buses.map((b) => (b.id === busId ? { ...b, ...patch } : b)),
    })),

  // ── Send management ───────────────────────────────────────────────────────

  addSend: (fromNodeId, busId) =>
    set((s) => {
      // Prevent duplicate sends from same node to same bus
      if (s.sends.some((send) => send.fromNodeId === fromNodeId && send.busId === busId)) return {}
      const send: Send = {
        id: `send-${Date.now()}`,
        fromNodeId,
        busId,
        sendLevelDb: 0,
      }
      return { sends: [...s.sends, send] }
    }),

  removeSend: (sendId) =>
    set((s) => ({ sends: s.sends.filter((send) => send.id !== sendId) })),

  updateSendLevel: (sendId, sendLevelDb) =>
    set((s) => ({
      sends: s.sends.map((send) =>
        send.id === sendId ? { ...send, sendLevelDb } : send
      ),
    })),
}))

// ── Backward-compat exports (used by some components during migration) ────────
// These allow gradual migration without breaking all components at once.

// MASTER_PROTECTED is used by NodeWrapper for the global protected check
export { MASTER_PROTECTED }
