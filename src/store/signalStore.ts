import { create } from 'zustand'
import type { Lang } from '../i18n/translations'
import { LEVEL_LIMITS, CHANNEL_COLORS, buildDefaultGraph, H_SPACING, V_SPACING } from '../data/levels'
import type { BusType } from '../data/levels'
import type { NodeParamValue } from '../data/nodeRegistry'
import { NODE_REGISTRY } from '../data/nodeRegistry'

export type { SignalNode, SignalEdge, NodeParamValue, EQBand } from '../data/nodeRegistry'

export interface SplitDrawState {
  sourceNodeId: string   // the node whose output port the branch starts from
  sourceHandle: string   // e.g. 'out'
}

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

interface SignalChainStore {
  language: Lang
  complexityLevel: ComplexityLevel
  activeTooltipId: string | null
  splitDraw: SplitDrawState | null

  nodes: import('../data/nodeRegistry').SignalNode[]
  edges: import('../data/nodeRegistry').SignalEdge[]

  setLanguage: (lang: Lang) => void
  setActiveTooltip: (id: string | null) => void
  setComplexityLevel: (level: ComplexityLevel) => void
  resetAll: () => void

  addNode: (node: import('../data/nodeRegistry').SignalNode) => void
  removeNode: (nodeId: string) => void
  updateNodeParams: (nodeId: string, patch: Record<string, NodeParamValue>) => void
  toggleBypassNode: (nodeId: string) => void
  addEdge: (edge: import('../data/nodeRegistry').SignalEdge) => void
  removeEdge: (edgeId: string) => void

  insertNodeOnEdge: (edgeId: string, typeKey: string, extraParams?: Record<string, NodeParamValue>) => void

  // Split-draw actions
  startSplitDraw: (sourceEdgeId: string) => void
  cancelSplitDraw: () => void
  // Add a new edge from the split source to an existing node input
  commitSplitToNode: (targetNodeId: string, targetHandle: string) => void
  // Drop a conn-point node at a flow-space position and wire the split to it
  commitSplitToCanvas: (flowX: number, flowY: number) => void

  addInputChannel: (sourceType: SourceType) => void
  addBusNode: (busType: BusType) => void
}

export const useSignalStore = create<SignalChainStore>((set) => ({
  language: getInitialLanguage(),
  complexityLevel: getInitialComplexityLevel(),
  activeTooltipId: null,
  splitDraw: null,

  ...buildDefaultGraph(getInitialComplexityLevel()),

  setLanguage: (lang) => {
    localStorage.setItem('lsc-language', lang)
    set({ language: lang })
  },

  setActiveTooltip: (id) => set({ activeTooltipId: id }),

  setComplexityLevel: (level) => {
    localStorage.setItem('lsc-complexity-level', level)
    set({ complexityLevel: level, activeTooltipId: null, ...buildDefaultGraph(level) })
  },

  resetAll: () =>
    set((s) => ({
      activeTooltipId: null,
      complexityLevel: s.complexityLevel,
      ...buildDefaultGraph(s.complexityLevel),
    })),

  // ── Graph mutations ───────────────────────────────────────────────────────

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

      const remainingNodes = s.nodes
        .filter((n) => n.id !== nodeId)
        .map((n) => {
          if (isLeftSide && n.position.x < removedX)
            return { ...n, position: { ...n.position, x: n.position.x + H_SPACING } }
          if (!isLeftSide && n.position.x > removedX)
            return { ...n, position: { ...n.position, x: n.position.x - H_SPACING } }
          return n
        })

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

  // ── Split-draw ────────────────────────────────────────────────────────────

  startSplitDraw: (sourceEdgeId) =>
    set((s) => {
      const edge = s.edges.find((e) => e.id === sourceEdgeId)
      if (!edge) return {}
      return { splitDraw: { sourceNodeId: edge.source, sourceHandle: edge.sourceHandle } }
    }),

  cancelSplitDraw: () => set({ splitDraw: null }),

  // Original edge is UNTOUCHED. Just add a new edge from the same source port.
  commitSplitToNode: (targetNodeId, targetHandle) =>
    set((s) => {
      const sd = s.splitDraw
      if (!sd) return {}
      const newEdge: import('../data/nodeRegistry').SignalEdge = {
        id: `e-split-${sd.sourceNodeId}-${targetNodeId}-${Date.now()}`,
        source: sd.sourceNodeId,
        sourceHandle: sd.sourceHandle,
        target: targetNodeId,
        targetHandle,
      }
      return { edges: [...s.edges, newEdge], splitDraw: null }
    }),

  // Original edge is UNTOUCHED. Create a conn-point node where user clicked,
  // add a new edge from the same source port to that node.
  commitSplitToCanvas: (flowX, flowY) =>
    set((s) => {
      const sd = s.splitDraw
      if (!sd) return {}
      const sourceNode = s.nodes.find((n) => n.id === sd.sourceNodeId)
      if (!sourceNode) return { splitDraw: null }

      const ts = Date.now()
      const connPointId = `conn-point-${ts}`

      const connPoint: import('../data/nodeRegistry').SignalNode = {
        id: connPointId,
        typeKey: 'conn-point',
        position: { x: flowX, y: flowY },
        params: {},
        bypassed: false,
        label: 'Connection Point',
        color: sourceNode.color,
      }
      const newEdge: import('../data/nodeRegistry').SignalEdge = {
        id: `e-split-${sd.sourceNodeId}-${connPointId}`,
        source: sd.sourceNodeId,
        sourceHandle: sd.sourceHandle,
        target: connPointId,
        targetHandle: 'in',
      }

      return {
        nodes: [...s.nodes, connPoint],
        edges: [...s.edges, newEdge],
        splitDraw: null,
      }
    }),

  addInputChannel: (sourceType) =>
    set((s) => {
      const limits = LEVEL_LIMITS[s.complexityLevel]
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

      const newSource: import('../data/nodeRegistry').SignalNode = {
        id: `${typeKey}-${channelIdx + 1}`,
        typeKey,
        position: { x: 0, y },
        params: sourceType === 'mic' ? { sensitivityDb: defaultSensitivity } : { levelDb: defaultSensitivity },
        bypassed: false,
        label: typeKey === 'mic' ? 'Microphone' : typeKey === 'line-in' ? 'Line Input' : 'Instrument',
        color,
      }

      const newNodes: import('../data/nodeRegistry').SignalNode[] = [newSource]
      const newEdges: import('../data/nodeRegistry').SignalEdge[] = []

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
          { id: `e-${newSource.id}-${gainId}`, source: newSource.id, sourceHandle: 'out', target: gainId, targetHandle: 'in' },
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
