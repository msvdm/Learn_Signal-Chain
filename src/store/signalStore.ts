import { create } from 'zustand'
import type { Lang } from '../i18n/translations'
import { LOCALES, DEFAULT_LANG } from '../i18n/locales/index'
import { buildDefaultGraph } from '../data/levels'
import type { NodeParamValue, SignalEdge } from '../data/nodeRegistry'
import { NODE_REGISTRY, MATRIX_PORT, MIX_PORT, getPorts } from '../data/nodeRegistry'
import { pickChainColor } from '../utils/chainColors'
import { attachMainFaders, reconcileMainFaders } from '../utils/mainFader'
import type { ToolMode, LeftTool } from '../types'
import type { NodeGroup } from '../utils/nodeGroup'

export type { SignalNode, SignalEdge, NodeParamValue, EQBand } from '../data/nodeRegistry'
export type { ToolMode, LeftTool } from '../types'

export type ComplexityLevel = 'beginner' | 'intermediate' | 'advanced'
export type Theme = 'dark' | 'light'

/** The whole graph, as one undo step remembers it. */
interface GraphSnapshot {
  nodes: import('../data/nodeRegistry').SignalNode[]
  edges: import('../data/nodeRegistry').SignalEdge[]
}

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

function getInitialPaletteOpen(): boolean {
  return localStorage.getItem('lsc-palette-open') !== 'false'
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
  /** The element palette on the left is shown (persisted); collapsed = more room for the canvas. */
  paletteOpen: boolean
  complexityLevel: ComplexityLevel
  activeTooltipId: string | null
  activeTooltipTypeKey: string | null
  /** Selected elements (several with the Select tool, Ctrl+click or Shift+drag) */
  selectedNodeIds: string[]
  toolMode: ToolMode
  /** What a left-click does: drag (move and pan), select (pick several) or remove */
  leftTool: LeftTool
  /** Elements copied or cut, ready to paste (not persisted) */
  clipboard: NodeGroup | null
  /** Undo / redo steps: the graph before each change (see the history section at the bottom) */
  past: GraphSnapshot[]
  future: GraphSnapshot[]
  wireSource: WireSource | null
  /** Wires whose chains are highlighted (hovered in the unplug list or a Matrix Bus row); everything else is dimmed. */
  highlightEdgeIds: string[]
  /** Zoomed out far enough that cards show only their name and output level (set by SignalChain, not persisted). */
  overview: boolean

  nodes: import('../data/nodeRegistry').SignalNode[]
  edges: import('../data/nodeRegistry').SignalEdge[]

  setLanguage: (lang: Lang) => void
  setTheme: (theme: Theme) => void
  setSnapToGrid: (on: boolean) => void
  setPaletteOpen: (open: boolean) => void
  setActiveTooltip: (id: string | null, typeKey?: string | null) => void
  setSelectedNode: (id: string | null) => void
  setSelection: (ids: string[]) => void
  setLeftTool: (tool: LeftTool) => void
  setClipboard: (group: NodeGroup | null) => void
  undo: () => void
  redo: () => void
  setComplexityLevel: (level: ComplexityLevel) => void
  setToolMode: (mode: ToolMode) => void
  setWireSource: (source: WireSource | null) => void
  setHighlightEdges: (edgeIds: string[]) => void
  setOverview: (on: boolean) => void
  resetAll: () => void

  addNode: (node: import('../data/nodeRegistry').SignalNode) => void
  removeNode: (nodeId: string) => void
  /** Remove several elements at once (no bridging wire, unlike removing one) */
  removeNodes: (nodeIds: string[]) => void
  /** Add pasted / duplicated elements with their wires, and select them */
  addGroup: (nodes: import('../data/nodeRegistry').SignalNode[], edges: import('../data/nodeRegistry').SignalEdge[]) => void
  updateNodeParams: (nodeId: string, patch: Record<string, NodeParamValue>) => void
  toggleBypassNode: (nodeId: string) => void
  setNodeStereo: (nodeId: string, on: boolean) => void
  addEdge: (edge: import('../data/nodeRegistry').SignalEdge) => void
  removeEdge: (edgeId: string) => void
  /** Swap one wire for others in one step (a card dropped onto a wire). */
  replaceEdge: (edgeId: string, replacements: import('../data/nodeRegistry').SignalEdge[]) => void
  updateEdgeWaypoints: (edgeId: string, waypoints: { x: number; y: number }[]) => void
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void
  /** Move several elements by the same distance; wires between them take their bends along */
  moveNodes: (nodeIds: string[], delta: { x: number; y: number }) => void
}

const initialTheme = getInitialTheme()
applyTheme(initialTheme)

export const useSignalStore = create<SignalChainStore>((set, get) => ({
  language: getInitialLanguage(),
  theme: initialTheme,
  snapToGrid: getInitialSnapToGrid(),
  paletteOpen: getInitialPaletteOpen(),
  complexityLevel: getInitialComplexityLevel(),
  activeTooltipId: null,
  activeTooltipTypeKey: null,
  selectedNodeIds: [],
  toolMode: 'select',
  leftTool: 'drag',
  clipboard: null,
  past: [],
  future: [],
  wireSource: null,
  highlightEdgeIds: [],
  overview: false,

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

  setPaletteOpen: (open) => {
    localStorage.setItem('lsc-palette-open', String(open))
    set({ paletteOpen: open })
  },

  setActiveTooltip: (id, typeKey = null) => set({ activeTooltipId: id, activeTooltipTypeKey: typeKey }),

  setSelectedNode: (id) => set({ selectedNodeIds: id ? [id] : [] }),

  setSelection: (ids) => set({ selectedNodeIds: ids }),

  setLeftTool: (tool) => set({ leftTool: tool }),

  setClipboard: (group) => set({ clipboard: group }),

  undo: () => {
    const { past, nodes, edges } = get()
    const step = past[past.length - 1]
    if (!step) return
    withoutHistory(() => set((s) => ({
      ...restore(s, step),
      past:   past.slice(0, -1),
      future: [...s.future, { nodes, edges }],
    })))
  },

  redo: () => {
    const { future, nodes, edges } = get()
    const step = future[future.length - 1]
    if (!step) return
    withoutHistory(() => set((s) => ({
      ...restore(s, step),
      past:   [...s.past, { nodes, edges }].slice(-HISTORY_LIMIT),
      future: future.slice(0, -1),
    })))
  },

  setComplexityLevel: (level) => {
    localStorage.setItem('lsc-complexity-level', level)
    // A new level starts a new history: its palette has other elements
    withoutHistory(() => set({
      complexityLevel: level, activeTooltipId: null, activeTooltipTypeKey: null,
      selectedNodeIds: [], toolMode: 'select', wireSource: null, past: [], future: [], ...buildDefaultGraph(),
    }))
  },

  setToolMode: (mode) => set(mode === 'select' ? { toolMode: mode, wireSource: null } : { toolMode: mode }),

  setWireSource: (source) => set({ wireSource: source }),

  setHighlightEdges: (edgeIds) => set({ highlightEdgeIds: edgeIds }),

  setOverview: (on) => set({ overview: on }),

  resetAll: () =>
    set((s) => ({
      activeTooltipId: null,
      activeTooltipTypeKey: null,
      selectedNodeIds: [],
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
        ...(s.selectedNodeIds.includes(nodeId) ? { selectedNodeIds: s.selectedNodeIds.filter((id) => id !== nodeId) } : {}),
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

  removeNodes: (nodeIds) =>
    set((s) => {
      const gone  = new Set(nodeIds)
      const nodes = s.nodes.filter((n) => !gone.has(n.id))
      const edges = s.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target))
      return {
        nodes,
        edges: reconcileMainFaders(s, { nodes, edges }),
        selectedNodeIds: s.selectedNodeIds.filter((id) => !gone.has(id)),
        highlightEdgeIds: [],
        ...(s.activeTooltipId && gone.has(s.activeTooltipId) ? { activeTooltipId: null, activeTooltipTypeKey: null } : {}),
      }
    }),

  addGroup: (added, addedEdges) =>
    set((s) => {
      // Each copied source starts a chain of its own colour
      let nodes = s.nodes
      for (const n of added) {
        const isSource = NODE_REGISTRY[n.typeKey]?.category === 'source'
        nodes = [...nodes, isSource && !n.color ? { ...n, color: pickChainColor(nodes) } : n]
      }
      return {
        nodes,
        edges: attachMainFaders(nodes, [...s.edges, ...addedEdges]),
        selectedNodeIds: added.map((n) => n.id),
      }
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

  moveNodes: (nodeIds, delta) =>
    set((s) => {
      const moving = new Set(nodeIds)
      const move   = (p: { x: number; y: number }) => ({ x: p.x + delta.x, y: p.y + delta.y })
      return {
        nodes: s.nodes.map((n) => (moving.has(n.id) ? { ...n, position: move(n.position) } : n)),
        edges: s.edges.map((e) => (moving.has(e.source) && moving.has(e.target) && e.waypoints
          ? { ...e, waypoints: e.waypoints.map(move) }
          : e)),
      }
    }),
}))

// ── History (undo / redo) ───────────────────────────────────────────────────
// Every change to the graph is remembered, wherever it comes from. Changes that follow each
// other closely (a knob being turned, the cards that slide aside after a drop) make one step.

const HISTORY_LIMIT = 100
const STEP_QUIET_MS = 400

let recording = true
let inStep    = false
let stepTimer: ReturnType<typeof setTimeout> | undefined

/** Change the store without it becoming an undo step (undo / redo themselves, a level change). */
function withoutHistory(fn: () => void) {
  recording = false
  try { fn() } finally { recording = true }
  inStep = false
}

/** The graph back as it was in `step`; selection and help that point at missing elements are dropped. */
function restore(s: SignalChainStore, step: GraphSnapshot): Partial<SignalChainStore> {
  const ids = new Set(step.nodes.map((n) => n.id))
  return {
    nodes: step.nodes,
    edges: step.edges,
    selectedNodeIds: s.selectedNodeIds.filter((id) => ids.has(id)),
    highlightEdgeIds: [],
    // A wire being drawn may start from an element that is gone
    toolMode: 'select',
    wireSource: null,
    ...(s.activeTooltipId && !ids.has(s.activeTooltipId) ? { activeTooltipId: null, activeTooltipTypeKey: null } : {}),
  }
}

useSignalStore.subscribe((s, prev) => {
  if (!recording || (s.nodes === prev.nodes && s.edges === prev.edges)) return
  clearTimeout(stepTimer)
  stepTimer = setTimeout(() => { inStep = false }, STEP_QUIET_MS)
  if (inStep) return
  inStep = true
  // A new change: the steps that were undone can no longer be redone
  useSignalStore.setState({
    past: [...prev.past, { nodes: prev.nodes, edges: prev.edges }].slice(-HISTORY_LIMIT),
    future: [],
  })
})
