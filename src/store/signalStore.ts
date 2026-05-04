import { create } from 'zustand'
import type { Lang } from '../i18n/translations'
import { LOCALES, DEFAULT_LANG } from '../i18n/locales/index'
import { buildDefaultGraph } from '../data/levels'
import type { NodeParamValue } from '../data/nodeRegistry'
import type { ToolMode } from '../types'

export type { SignalNode, SignalEdge, NodeParamValue, EQBand } from '../data/nodeRegistry'
export type { ToolMode } from '../types'

export type ComplexityLevel = 'beginner' | 'intermediate' | 'advanced'

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
  complexityLevel: ComplexityLevel
  activeTooltipId: string | null
  toolMode: ToolMode

  nodes: import('../data/nodeRegistry').SignalNode[]
  edges: import('../data/nodeRegistry').SignalEdge[]

  setLanguage: (lang: Lang) => void
  setActiveTooltip: (id: string | null) => void
  setComplexityLevel: (level: ComplexityLevel) => void
  setToolMode: (mode: ToolMode) => void
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

export const useSignalStore = create<SignalChainStore>((set) => ({
  language: getInitialLanguage(),
  complexityLevel: getInitialComplexityLevel(),
  activeTooltipId: null,
  toolMode: 'select',

  ...buildDefaultGraph(getInitialComplexityLevel()),

  setLanguage: (lang) => {
    localStorage.setItem('lsc-language', lang)
    set({ language: lang })
  },

  setActiveTooltip: (id) => set({ activeTooltipId: id }),

  setComplexityLevel: (level) => {
    localStorage.setItem('lsc-complexity-level', level)
    set({ complexityLevel: level, activeTooltipId: null, toolMode: 'select', ...buildDefaultGraph(level) })
  },

  setToolMode: (mode) => set({ toolMode: mode }),

  resetAll: () =>
    set((s) => ({
      activeTooltipId: null,
      complexityLevel: s.complexityLevel,
      toolMode: 'select',
      ...buildDefaultGraph(s.complexityLevel),
    })),

  // ── Graph mutations ───────────────────────────────────────────────────────

  addNode: (node) =>
    set((s) => ({ nodes: [...s.nodes, node] })),

  removeNode: (nodeId) =>
    set((s) => {
      const target = s.nodes.find((n) => n.id === nodeId)
      if (target?.typeKey === 'master-bus' && s.complexityLevel !== 'beginner') return {}

      const inEdges  = s.edges.filter((e) => e.target === nodeId)
      const outEdges = s.edges.filter((e) => e.source === nodeId)
      const filteredEdges = s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId)

      // Bridge: if exactly one in and one out, reconnect them directly
      if (inEdges.length === 1 && outEdges.length === 1) {
        const bridge = {
          id: `e-${inEdges[0].source}-${outEdges[0].target}`,
          source: inEdges[0].source,
          sourceHandle: inEdges[0].sourceHandle,
          target: outEdges[0].target,
          targetHandle: outEdges[0].targetHandle,
        }
        return { nodes: s.nodes.filter((n) => n.id !== nodeId), edges: [...filteredEdges, bridge] }
      }

      return { nodes: s.nodes.filter((n) => n.id !== nodeId), edges: filteredEdges }
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
