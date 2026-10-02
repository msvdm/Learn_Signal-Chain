import { create } from 'zustand'
import type { Lang } from '../i18n/translations'
import { LOCALES, DEFAULT_LANG } from '../i18n/locales/index'
import { buildDefaultGraph } from '../data/levels'
import type { NodeParamValue } from '../data/nodeRegistry'
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
  resetAll: () => void

  addNode: (node: import('../data/nodeRegistry').SignalNode) => void
  removeNode: (nodeId: string) => void
  updateNodeParams: (nodeId: string, patch: Record<string, NodeParamValue>) => void
  toggleBypassNode: (nodeId: string) => void
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
    set((s) => ({ nodes: [...s.nodes, node] })),

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

  addEdge: (edge) =>
    set((s) => ({ edges: [...s.edges, edge] })),

  removeEdge: (edgeId) =>
    set((s) => ({ edges: s.edges.filter((e) => e.id !== edgeId) })),

  updateEdgeWaypoints: (edgeId, waypoints) =>
    set((s) => ({
      edges: s.edges.map((e) => e.id === edgeId ? { ...e, waypoints } : e),
    })),

  updateNodePosition: (nodeId, position) =>
    set((s) => ({
      nodes: s.nodes.map((n) => n.id === nodeId ? { ...n, position } : n),
    })),
}))
