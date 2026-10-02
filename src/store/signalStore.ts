import { create } from 'zustand'
import type { Lang } from '../i18n/translations'
import { LOCALES, DEFAULT_LANG } from '../i18n/locales/index'
import { buildDefaultGraph } from '../data/levels'
import type { NodeParamValue, SignalEdge } from '../data/nodeRegistry'
import { NODE_REGISTRY, MATRIX_PORT, MIX_PORT, getPorts } from '../data/nodeRegistry'
import { pickChainColor } from '../utils/chainColors'
import { attachMainFaders, reconcileMainFaders } from '../utils/mainFader'
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
  /** Wires whose chains are highlighted (hovered in the unplug list or a Matrix Bus row); everything else is dimmed. */
  highlightEdgeIds: string[]

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
  setHighlightEdges: (edgeIds: string[]) => void
  resetAll: () => void

  addNode: (node: import('../data/nodeRegistry').SignalNode) => void
  removeNode: (nodeId: string) => void
  updateNodeParams: (nodeId: string, patch: Record<string, NodeParamValue>) => void
  toggleBypassNode: (nodeId: string) => void
  setNodeStereo: (nodeId: string, on: boolean) => void
  addEdge: (edge: import('../data/nodeRegistry').SignalEdge) => void
  removeEdge: (edgeId: string) => void
  /** Swap one wire for others in one step (a card dropped onto a wire). */
  replaceEdge: (edgeId: string, replacements: import('../data/nodeRegistry').SignalEdge[]) => void
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
  highlightEdgeIds: [],

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

  setHighlightEdges: (edgeIds) => set({ highlightEdgeIds: edgeIds }),

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
      const nodes    = s.nodes.filter((n) => n.id !== nodeId)
      const inEdges  = s.edges.filter((e) => e.target === nodeId)
      const outEdges = s.edges.filter((e) => e.source === nodeId)
      const filteredEdges = s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId)
      // Removing a Main Fader (or what fed it) hands the L / R wires back to the bus
      const settle = (edges: SignalEdge[]) => reconcileMainFaders(s, { nodes, edges })

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
        return { ...cleared, nodes, edges: settle([...filteredEdges, bridge]) }
      }

      return { ...cleared, nodes, edges: settle(filteredEdges) }
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

      const updated = { ...node, params: { ...node.params, stereo: on } }
      const outIds  = new Set(getPorts(updated).outputs.map((p) => p.id))

      // Inputs never change. Only a bus splits its output: Mono → Stereo moves 'out' to 'out-l'
      // (into a Matrix Bus it then becomes the Matrix send); Stereo → Mono moves 'out-l', 'out-r',
      // the Matrix send and a Main Fader's 'mix' back to 'out'.
      function remap(portId: string): string | null {
        if (outIds.has(portId)) return portId
        if (on) return outIds.has(`${portId}-l`) ? `${portId}-l` : null
        const base = portId === MIX_PORT || portId === MATRIX_PORT ? 'out' : portId.replace(/-[lr]$/, '')
        return outIds.has(base) ? base : null
      }

      const edges: SignalEdge[] = []
      for (const e of s.edges) {
        let next = e
        if (e.source === nodeId) {
          const h = remap(e.sourceHandle)
          if (!h) continue
          next = { ...next, sourceHandle: h }
        }
        // Left and right wires to the same input collapse into one — keep one
        const dup = edges.some((x) =>
          x.source === next.source && x.sourceHandle === next.sourceHandle &&
          x.target === next.target && x.targetHandle === next.targetHandle)
        if (!dup) edges.push(next)
      }

      // A fader on the new L output becomes the Main Fader; one that lost its Mix wire is plain again
      const nodes = s.nodes.map((n) => (n.id === nodeId ? updated : n))
      return { nodes, edges: attachMainFaders(nodes, edges) }
    }),

  // A Fader wired to a stereo bus's L or R becomes its Main Fader (see utils/mainFader.ts)
  addEdge: (edge) =>
    set((s) => ({ edges: attachMainFaders(s.nodes, [...s.edges, edge]) })),

  // Unplugging a Main Fader hands the bus's L / R wires back to the bus
  removeEdge: (edgeId) =>
    set((s) => ({
      edges: reconcileMainFaders(s, { nodes: s.nodes, edges: s.edges.filter((e) => e.id !== edgeId) }),
      ...(s.highlightEdgeIds.includes(edgeId) ? { highlightEdgeIds: [] } : {}),
    })),

  // One step, so a card dropped onto a Mix wire does not unplug the Main Fader on the way
  replaceEdge: (edgeId, replacements) =>
    set((s) => ({
      edges: reconcileMainFaders(s, { nodes: s.nodes, edges: [...s.edges.filter((e) => e.id !== edgeId), ...replacements] }),
      ...(s.highlightEdgeIds.includes(edgeId) ? { highlightEdgeIds: [] } : {}),
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
