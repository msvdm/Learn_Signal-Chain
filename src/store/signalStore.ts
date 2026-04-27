import { create } from 'zustand'
import type { Lang } from '../i18n/translations'
import { LEVEL_LIMITS, CHANNEL_COLORS, buildDefaultGraph, H_SPACING, V_SPACING } from '../data/levels'
import type { BusType } from '../data/levels'
import type { NodeParamValue } from '../data/nodeRegistry'
import { NODE_REGISTRY } from '../data/nodeRegistry'

// Re-export graph types so components only need one import location.
export type { SignalNode, SignalEdge, NodeParamValue } from '../data/nodeRegistry'

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

  // ── Phase 2+ graph model ──────────────────────────────────────────────────
  // Flat nodes[] + edges[] — the authoritative model for the new architecture.
  // Coexists with the old model during migration; replaces it in Phase 3.

  nodes: import('../data/nodeRegistry').SignalNode[]
  edges: import('../data/nodeRegistry').SignalEdge[]

  // Basic graph mutations
  addNode: (node: import('../data/nodeRegistry').SignalNode) => void
  removeNode: (nodeId: string) => void
  updateNodeParams: (nodeId: string, patch: Record<string, NodeParamValue>) => void
  toggleBypassNode: (nodeId: string) => void
  addEdge: (edge: import('../data/nodeRegistry').SignalEdge) => void
  removeEdge: (edgeId: string) => void

  // Compound: insert a new node on an existing edge (splits the edge in two).
  // Shifts all nodes at x >= target.x rightward by H_SPACING to make room.
  insertNodeOnEdge: (edgeId: string, typeKey: string, extraParams?: Record<string, NodeParamValue>) => void

  // High-level helpers (used by AddSourcePanel / InsertBusPanel in Phase 3)
  addInputChannel: (sourceType: SourceType) => void
  addBusNode: (busType: BusType) => void
}

// Protected node type-keys within a channel — source cannot be removed, only the channel itself
const CHANNEL_PROTECTED = new Set(['source'])
// Globally protected master node IDs — speaker is always the final output, never removable
const MASTER_PROTECTED = new Set(['master-bus', 'master-fader', 'speaker'])

function getInitialGraph() {
  return buildDefaultGraph(getInitialComplexityLevel())
}

export const useSignalStore = create<SignalChainStore>((set) => ({
  language: getInitialLanguage(),
  complexityLevel: getInitialComplexityLevel(),
  activeTooltipId: null,

  channels: getInitialChannels(),
  masterState: { ...DEFAULT_MASTER_STATE },
  masterChainOrder: ['master-bus', 'master-fader', 'speaker'],
  buses: [],
  sends: [],

  ...getInitialGraph(),

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
      ...buildDefaultGraph(level),
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
      ...buildDefaultGraph(s.complexityLevel),
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

  // ── Graph actions ─────────────────────────────────────────────────────────

  addNode: (node) =>
    set((s) => ({ nodes: [...s.nodes, node] })),

  removeNode: (nodeId) =>
    set((s) => {
      const node = s.nodes.find((n) => n.id === nodeId)
      if (!node) return {}

      const masterBus = s.nodes.find((n) => n.typeKey === 'master-bus')
      const masterBusX = masterBus ? masterBus.position.x : Infinity
      const isLeftSide = node.position.x < masterBusX
      const removedX = node.position.x

      // Close the gap: shift the shorter side back toward master-bus
      const remainingNodes = s.nodes
        .filter((n) => n.id !== nodeId)
        .map((n) => {
          if (isLeftSide && n.position.x < removedX)
            return { ...n, position: { ...n.position, x: n.position.x + H_SPACING } }
          if (!isLeftSide && n.position.x > removedX)
            return { ...n, position: { ...n.position, x: n.position.x - H_SPACING } }
          return n
        })

      // Reconnect predecessor → successor (only for simple 1-in 1-out nodes)
      const inEdges  = s.edges.filter((e) => e.target === nodeId)
      const outEdges = s.edges.filter((e) => e.source === nodeId)
      const filteredEdges = s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId)

      if (inEdges.length === 1 && outEdges.length === 1) {
        const bridge = {
          id: `e-${inEdges[0].source}-${outEdges[0].target}`,
          source: inEdges[0].source,
          sourceHandle: inEdges[0].sourceHandle,
          target: outEdges[0].target,
          targetHandle: outEdges[0].targetHandle,
        }
        return { nodes: remainingNodes, edges: [...filteredEdges, bridge] }
      }

      return { nodes: remainingNodes, edges: filteredEdges }
    }),

  updateNodeParams: (nodeId, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, params: { ...n.params, ...patch } } : n
      ),
    })),

  toggleBypassNode: (nodeId) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, bypassed: !n.bypassed } : n
      ),
    })),

  addEdge: (edge) =>
    set((s) => ({ edges: [...s.edges, edge] })),

  removeEdge: (edgeId) =>
    set((s) => ({ edges: s.edges.filter((e) => e.id !== edgeId) })),

  insertNodeOnEdge: (edgeId, typeKey, extraParams = {}) =>
    set((s) => {
      const edge = s.edges.find((e) => e.id === edgeId)
      if (!edge) return {}

      const sourceNode = s.nodes.find((n) => n.id === edge.source)
      const targetNode = s.nodes.find((n) => n.id === edge.target)
      if (!sourceNode || !targetNode) return {}

      const def = NODE_REGISTRY[typeKey]
      if (!def) return {}

      const masterBus = s.nodes.find((n) => n.typeKey === 'master-bus')
      const masterBusX = masterBus ? masterBus.position.x : Infinity

      // Left side of master-bus: new node takes source's x, source+left grow further left.
      // Right side (or no master-bus): new node goes right of source, target+right shift right.
      const isLeftSide = sourceNode.position.x < masterBusX
      const newX = isLeftSide ? sourceNode.position.x : sourceNode.position.x + H_SPACING
      const newY = sourceNode.position.y

      const shiftedNodes = s.nodes.map((n) => {
        if (isLeftSide && n.position.x <= sourceNode.position.x)
          return { ...n, position: { ...n.position, x: n.position.x - H_SPACING } }
        if (!isLeftSide && n.position.x >= newX && n.id !== sourceNode.id)
          return { ...n, position: { ...n.position, x: n.position.x + H_SPACING } }
        return n
      })

      const newId = `${typeKey}-${Date.now()}`
      const newNode = {
        id: newId,
        typeKey,
        position: { x: newX, y: newY },
        params: { ...def.defaultParams, ...extraParams },
        bypassed: false,
        label: def.label,
        color: sourceNode.color,
      }

      const inPortId  = def.inputs[0]?.id  ?? 'in'
      const outPortId = def.outputs[0]?.id ?? 'out'

      const filteredEdges = s.edges.filter((e) => e.id !== edgeId)
      const edgeA = {
        id: `e-${edge.source}-${newId}`,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: newId,
        targetHandle: inPortId,
      }
      const edgeB = {
        id: `e-${newId}-${edge.target}`,
        source: newId,
        sourceHandle: outPortId,
        target: edge.target,
        targetHandle: edge.targetHandle,
      }

      return {
        nodes: [...shiftedNodes, newNode],
        edges: [...filteredEdges, edgeA, edgeB],
      }
    }),

  addInputChannel: (sourceType) =>
    set((s) => {
      const limits = LEVEL_LIMITS[s.complexityLevel]
      // Count existing source nodes
      const existingSources = s.nodes.filter((n) =>
        n.typeKey === 'mic' || n.typeKey === 'line-in' || n.typeKey === 'instrument'
      )
      if (existingSources.length >= limits.maxInputChannels) return {}

      const channelIdx = existingSources.length
      const color = CHANNEL_COLORS[channelIdx % CHANNEL_COLORS.length]
      const y = channelIdx * V_SPACING
      const ts = Date.now()

      const typeKey = sourceType === 'mic' ? 'mic' : sourceType === 'line' ? 'line-in' : 'instrument'
      const defaultSensitivity = sourceType === 'mic' ? -60 : sourceType === 'line' ? -10 : -30

      const newMic: import('../data/nodeRegistry').SignalNode = {
        id: `${typeKey}-${channelIdx + 1}`,
        typeKey,
        position: { x: 0, y },
        params: sourceType === 'mic' ? { sensitivityDb: defaultSensitivity } : { levelDb: defaultSensitivity },
        bypassed: false,
        label: typeKey === 'mic' ? 'Microphone' : typeKey === 'line-in' ? 'Line Input' : 'Instrument',
        color,
      }

      const newNodes: import('../data/nodeRegistry').SignalNode[] = [newMic]
      const newEdges: import('../data/nodeRegistry').SignalEdge[] = []

      // In intermediate+, connect mic → gain → fader → master-bus
      const masterBus = s.nodes.find((n) => n.id === 'master-bus')
      if (masterBus) {
        const gainId = `gain-${ts}`
        const faderId = `fader-ch-${ts}`
        newNodes.push(
          {
            id: gainId,
            typeKey: 'gain',
            position: { x: H_SPACING, y },
            params: { gainDb: 40 },
            bypassed: false,
            label: 'Preamp',
            color,
          },
          {
            id: faderId,
            typeKey: 'fader',
            position: { x: H_SPACING * 2, y },
            params: { faderDb: 0 },
            bypassed: false,
            label: 'Channel Fader',
            color,
          }
        )
        const channelHandleId = `in-${channelIdx + 1}`
        newEdges.push(
          { id: `e-${newMic.id}-${gainId}`, source: newMic.id, sourceHandle: 'out', target: gainId, targetHandle: 'in' },
          { id: `e-${gainId}-${faderId}`, source: gainId, sourceHandle: 'out', target: faderId, targetHandle: 'in' },
          { id: `e-${faderId}-mbus`, source: faderId, sourceHandle: 'out', target: 'master-bus', targetHandle: channelHandleId }
        )
      }

      return {
        nodes: [...s.nodes, ...newNodes],
        edges: [...s.edges, ...newEdges],
      }
    }),

  addBusNode: (busType) =>
    set((s) => {
      const limits = LEVEL_LIMITS[s.complexityLevel]
      const existingBuses = s.nodes.filter((n) => n.typeKey === 'bus' && n.params.busType === busType)

      if (busType === 'aux' && existingBuses.length >= limits.maxAuxBuses) return {}
      if (busType === 'fx' && existingBuses.length >= limits.maxFxEngines) return {}
      if (busType === 'pfl' && existingBuses.length >= limits.maxPflBuses) return {}
      if (busType === 'matrix' && !limits.hasMatrixBuses) return {}

      const masterBus = s.nodes.find((n) => n.id === 'master-bus')
      const refX = masterBus ? masterBus.position.x : H_SPACING * 3
      const refY = masterBus ? masterBus.position.y : 0

      const busNum = existingBuses.length + 1
      const labels: Record<BusType, string> = {
        aux: `Aux ${busNum}`, fx: `FX ${busNum}`, pfl: 'PFL', matrix: `Matrix ${busNum}`,
      }

      // Aux/FX below master-bus, matrix above
      const yOffset = busType === 'matrix'
        ? -(existingBuses.length + 1) * V_SPACING
        : (existingBuses.length + 1) * V_SPACING

      const newBus: import('../data/nodeRegistry').SignalNode = {
        id: `bus-${Date.now()}`,
        typeKey: 'bus',
        position: { x: refX, y: refY + yOffset },
        params: { faderDb: 0, isStereo: busType !== 'pfl', busType },
        bypassed: false,
        label: labels[busType],
      }

      return { nodes: [...s.nodes, newBus] }
    }),
}))

// ── Backward-compat exports (used by some components during migration) ────────
// These allow gradual migration without breaking all components at once.

// MASTER_PROTECTED is used by NodeWrapper for the global protected check
export { MASTER_PROTECTED }
