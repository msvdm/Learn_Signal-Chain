import { create } from 'zustand'
import type { Lang } from '../i18n/translations'
import { LOCALES, DEFAULT_LANG } from '../i18n/locales/index'
import { buildDefaultGraph } from '../data/levels'
import type { NodeParamValue, SignalEdge } from '../data/nodeRegistry'
import { NODE_REGISTRY, MULTI_WIRE_TYPES, getPorts, portSide, basePortId } from '../data/nodeRegistry'
import { pickChainColor } from '../utils/chainColors'
import type { ToolMode } from '../types'

export type { SignalNode, SignalEdge, NodeParamValue, EQBand } from '../data/nodeRegistry'
export type { ToolMode } from '../types'

export type ComplexityLevel = 'beginner' | 'intermediate' | 'advanced'
export type Theme = 'dark' | 'light'

/** The output port a wire is currently being drawn from (null when idle). */
export interface WireSource {
  nodeId: string
  handleId: string
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('lsc-theme')
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

function getInitialSnapToGrid(): boolean {
  return localStorage.getItem('lsc-snap-to-grid') !== 'false'
}

function getInitialLanguage(): Lang {
  const stored = localStorage.getItem('lsc-language')
  if (stored && stored in LOCALES) return stored
  const browserLang = navigator.language.split('-')[0]
  return browserLang in LOCALES ? browserLang : DEFAULT_LANG
}

function getInitialComplexityLevel(): ComplexityLevel {
  const stored = localStorage.getItem('lsc-complexity-level')
  if (stored === 'beginner' || stored === 'intermediate' ||
      stored === 'advanced') return stored
  return 'beginner'
}

interface SignalChainStore {
  language: Lang
  theme: Theme
  snapToGrid: boolean
  complexityLevel: ComplexityLevel
  activeTooltipId: string | null
  activeTooltipTypeKey: string | null
  selectedNodeId: string | null
  toolMode: ToolMode
  wireSource: WireSource | null
  /** Wire whose chain is highlighted (hovered in the unplug list); everything else is dimmed. */
  highlightEdgeId: string | null

  nodes: import('../data/nodeRegistry').SignalNode[]
  edges: import('../data/nodeRegistry').SignalEdge[]

  setLanguage: (lang: Lang) => void
  setTheme: (theme: Theme) => void
  setSnapToGrid: (on: boolean) => void
  setActiveTooltip: (id: string | null, typeKey?: string | null) => void
  setSelectedNode: (id: string | null) => void
  setComplexityLevel: (level: ComplexityLevel) => void
  setToolMode: (mode: ToolMode) => void
  setWireSource: (source: WireSource | null) => void
  setHighlightEdge: (edgeId: string | null) => void
  resetAll: () => void

  addNode: (node: import('../data/nodeRegistry').SignalNode) => void
  removeNode: (nodeId: string) => void
  updateNodeParams: (nodeId: string, patch: Record<string, NodeParamValue>) => void
  toggleBypassNode: (nodeId: string) => void
  setNodeStereo: (nodeId: string, on: boolean) => void
  addEdge: (edge: import('../data/nodeRegistry').SignalEdge) => void
  removeEdge: (edgeId: string) => void
  updateEdgeWaypoints: (edgeId: string, waypoints: { x: number; y: number }[]) => void
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void
}

const initialTheme = getInitialTheme()
applyTheme(initialTheme)

export const useSignalStore = create<SignalChainStore>((set) => ({
  language: getInitialLanguage(),
  theme: initialTheme,
  snapToGrid: getInitialSnapToGrid(),
  complexityLevel: getInitialComplexityLevel(),
  activeTooltipId: null,
  activeTooltipTypeKey: null,
  selectedNodeId: null,
  toolMode: 'select',
  wireSource: null,
  highlightEdgeId: null,

  ...buildDefaultGraph(),

  setLanguage: (lang) => {
    localStorage.setItem('lsc-language', lang)
    set({ language: lang })
  },

  setTheme: (theme) => {
    localStorage.setItem('lsc-theme', theme)
    applyTheme(theme)
    set({ theme })
  },

  setSnapToGrid: (on) => {
    localStorage.setItem('lsc-snap-to-grid', String(on))
    set({ snapToGrid: on })
  },

  setActiveTooltip: (id, typeKey = null) => set({ activeTooltipId: id, activeTooltipTypeKey: typeKey }),

  setSelectedNode: (id) => set({ selectedNodeId: id }),

  setComplexityLevel: (level) => {
    localStorage.setItem('lsc-complexity-level', level)
    set({
      complexityLevel: level, activeTooltipId: null, activeTooltipTypeKey: null,
      selectedNodeId: null, toolMode: 'select', wireSource: null, ...buildDefaultGraph(),
    })
  },

  setToolMode: (mode) => set(mode === 'select' ? { toolMode: mode, wireSource: null } : { toolMode: mode }),

  setWireSource: (source) => set({ wireSource: source }),

  setHighlightEdge: (edgeId) => set({ highlightEdgeId: edgeId }),

  resetAll: () =>
    set((s) => ({
      activeTooltipId: null,
      activeTooltipTypeKey: null,
      selectedNodeId: null,
      complexityLevel: s.complexityLevel,
      toolMode: 'select',
      wireSource: null,
      ...buildDefaultGraph(),
    })),

  // ── Graph mutations ───────────────────────────────────────────────────────

  addNode: (node) =>
    set((s) => {
      // Each source starts a chain — tag it with its own colour
      const isSource = NODE_REGISTRY[node.typeKey]?.category === 'source'
      const tagged   = isSource && !node.color ? { ...node, color: pickChainColor(s.nodes) } : node
      return { nodes: [...s.nodes, tagged] }
    }),

  removeNode: (nodeId) =>
    set((s) => {
      const inEdges  = s.edges.filter((e) => e.target === nodeId)
      const outEdges = s.edges.filter((e) => e.source === nodeId)
      const filteredEdges = s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId)

      // Drop help / selection that pointed at the removed node
      const cleared = {
        ...(s.activeTooltipId === nodeId ? { activeTooltipId: null, activeTooltipTypeKey: null } : {}),
        ...(s.selectedNodeId === nodeId ? { selectedNodeId: null } : {}),
      }

      // Bridge: if exactly one in and one out, reconnect them directly
      if (inEdges.length === 1 && outEdges.length === 1) {
        const bridge = {
          id: `e-${inEdges[0].source}-${outEdges[0].target}`,
          source: inEdges[0].source,
          sourceHandle: inEdges[0].sourceHandle,
          target: outEdges[0].target,
          targetHandle: outEdges[0].targetHandle,
        }
        return { ...cleared, nodes: s.nodes.filter((n) => n.id !== nodeId), edges: [...filteredEdges, bridge] }
      }

      return { ...cleared, nodes: s.nodes.filter((n) => n.id !== nodeId), edges: filteredEdges }
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

  setNodeStereo: (nodeId, on) =>
    set((s) => {
      const node = s.nodes.find((n) => n.id === nodeId)
      if (!node || NODE_REGISTRY[node.typeKey]?.stereo !== 'optional') return {}
      if ((node.params.stereo === true) === on) return {}

      const updated  = { ...node, params: { ...node.params, stereo: on } }
      const after    = getPorts(updated)
      const inputIds = new Set(after.inputs.map((p) => p.id))
      const outIds   = new Set(after.outputs.map((p) => p.id))
      const multi    = MULTI_WIRE_TYPES.has(node.typeKey)

      // Move each wire to the matching port of the new layout, or drop it.
      // Mono → Stereo: 'in' → 'in-l'. Stereo → Mono: 'in-l' → 'in', 'in-r' is dropped —
      // except on a bus, whose single mono input keeps both sides (they are added together).
      function remap(portId: string, valid: Set<string>, isInput: boolean): string | null {
        if (valid.has(portId)) return portId
        if (on) return valid.has(`${portId}-l`) ? `${portId}-l` : null
        const side = portSide(portId)
        const base = basePortId(portId)
        if (!side || !valid.has(base)) return null
        return side === 'l' || (isInput && multi) ? base : null
      }

      const edges: SignalEdge[] = []
      for (const e of s.edges) {
        let next = e
        if (e.target === nodeId) {
          const h = remap(e.targetHandle, inputIds, true)
          if (!h) continue
          next = { ...next, targetHandle: h }
        }
        if (e.source === nodeId) {
          const h = remap(e.sourceHandle, outIds, false)
          if (!h) continue
          next = { ...next, sourceHandle: h }
        }
        // Two wires can collapse onto the same pair of ports — keep one
        const dup = edges.some((x) =>
          x.source === next.source && x.sourceHandle === next.sourceHandle &&
          x.target === next.target && x.targetHandle === next.targetHandle)
        if (!dup) edges.push(next)
      }

      return { nodes: s.nodes.map((n) => (n.id === nodeId ? updated : n)), edges }
    }),

  addEdge: (edge) =>
    set((s) => ({ edges: [...s.edges, edge] })),

  removeEdge: (edgeId) =>
    set((s) => ({
      edges: s.edges.filter((e) => e.id !== edgeId),
      ...(s.highlightEdgeId === edgeId ? { highlightEdgeId: null } : {}),
    })),

  updateEdgeWaypoints: (edgeId, waypoints) =>
    set((s) => ({
      edges: s.edges.map((e) => e.id === edgeId ? { ...e, waypoints } : e),
    })),

  updateNodePosition: (nodeId, position) =>
    set((s) => ({
      nodes: s.nodes.map((n) => n.id === nodeId ? { ...n, position } : n),
    })),
}))
