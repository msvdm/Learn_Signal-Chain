import { create } from 'zustand'
import type { Lang } from '../i18n/translations'
import { LOCALES, DEFAULT_LANG } from '../i18n/locales/index'
import type { ComplexityLevel } from '../data/levels'
import { LEVELS } from '../data/levels'
import type { NodeParamValue, SignalNode, SignalEdge } from '../data/nodeRegistry'
import type { GraphView } from '../graph/graph'
import { reconcileMainFaders } from '../utils/mainFader'
import {
  withNodes, withoutNode, withoutNodes, withNodeOnWire, withPositions, withStereo,
} from '../graph/edits'
import type { ToolMode, LeftTool } from '../types'
import type { NodeGroup } from '../utils/nodeGroup'
import type { Pt } from '../utils/geometry'
import type { ChainFile, ParsedChain } from '../utils/chainFile'
import { parseChainFile, toChainFile } from '../utils/chainFile'

export type { SignalNode, SignalEdge, NodeParamValue, EQBand } from '../data/nodeRegistry'
export type { ToolMode, LeftTool } from '../types'

export type Theme = 'dark' | 'light'

/** The whole graph, as one undo step remembers it. */
type GraphSnapshot = GraphView

const EMPTY_GRAPH: GraphSnapshot = { nodes: [], edges: [] }

/** The output port a wire is drawn from. */
export interface WireSource {
  nodeId: string
  handleId: string
}

/**
 * A wire being drawn: the output it starts from, where that port is and the corners clicked so far
 * (flow coordinates). Its loose end follows the cursor (useWireDrawing), which is not kept here.
 */
export interface WireDraft {
  source: WireSource
  start: Pt
  waypoints: Pt[]
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
  return LEVELS.find((l) => l === stored) ?? 'beginner'
}

/** The autosaved canvas (see the autosave section at the bottom) */
const CANVAS_KEY = 'lsc-canvas'

/** The canvas as it was left, at the level it was made at (blank when there is none). */
function getInitialCanvas() {
  try {
    const saved = parseChainFile(JSON.parse(localStorage.getItem(CANVAS_KEY) ?? 'null'))
    if (saved && saved.chain.nodes.length > 0) {
      const { nodes, edges, name, level } = saved.chain
      return { nodes, edges, chainName: name, complexityLevel: level }
    }
  } catch { /* a broken save: start blank */ }
  return { nodes: [], edges: [], chainName: '', complexityLevel: getInitialComplexityLevel() }
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
  /** The wire being drawn (null when idle); cards read its `source` to highlight the inputs that take it */
  wire: WireDraft | null
  /** Wires whose chains are highlighted (hovered in the unplug list or a Matrix Bus row); everything else is dimmed. */
  highlightEdgeIds: string[]
  /** Zoomed out far enough that cards show only their name and output level (set by SignalChain, not persisted). */
  overview: boolean
  /** A picture of the canvas is being taken: cards show their controls whatever the zoom */
  capturing: boolean
  /** The name the chain was last saved or opened as (autosaved; suggested when saving) */
  chainName: string
  /** An opened chain waiting for the learner to choose: replace the canvas or add it beside */
  chainOffer: ParsedChain | null
  /** A short message at the bottom of the screen ("Link copied"); `id` restarts its timer */
  notice: { text: string; error: boolean; id: number } | null

  nodes: SignalNode[]
  edges: SignalEdge[]

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
  startWire: (source: WireSource, start: Pt) => void
  /** A click in empty space while drawing: the wire turns a corner there */
  addWireCorner: (at: Pt) => void
  cancelWire: () => void
  setHighlightEdges: (edgeIds: string[]) => void
  setOverview: (on: boolean) => void
  setCapturing: (on: boolean) => void
  setChainName: (name: string) => void
  offerChain: (offer: ParsedChain | null) => void
  /** Replace the canvas with a chain, at the level it was made at */
  loadChain: (chain: ChainFile) => void
  /** Go up to `level` if it is harder than the current one, keeping the canvas (a chain added from a file) */
  raiseLevel: (level: ComplexityLevel) => void
  showNotice: (text: string, error?: boolean) => void
  clearNotice: () => void
  resetAll: () => void

  addNode: (node: SignalNode) => void
  /** Remove one element; if it had one wire in and one out, they are joined */
  removeNode: (nodeId: string) => void
  /** Remove several elements at once (no bridging wire, unlike removing one) */
  removeNodes: (nodeIds: string[]) => void
  /** Add pasted / duplicated elements with their wires, and select them */
  addGroup: (nodes: SignalNode[], edges: SignalEdge[]) => void
  /** Add an element in the middle of a wire, in one step (a card dropped onto a wire) */
  insertOnWire: (node: SignalNode, edgeId: string) => void
  updateNodeParams: (nodeId: string, patch: Record<string, NodeParamValue>) => void
  toggleBypassNode: (nodeId: string) => void
  setNodeStereo: (nodeId: string, on: boolean) => void
  addEdge: (edge: SignalEdge) => void
  removeEdge: (edgeId: string) => void
  updateEdgeWaypoints: (edgeId: string, waypoints: Pt[]) => void
  /** Move elements to new positions, in one step (cards making room for a new wire or card) */
  setPositions: (moves: Map<string, Pt>) => void
  /** Move several elements by the same distance; wires between them take their bends along */
  moveNodes: (nodeIds: string[], delta: Pt) => void
}

const initialTheme = getInitialTheme()
applyTheme(initialTheme)
const initialCanvas = getInitialCanvas()

export const useSignalStore = create<SignalChainStore>((set, get) => ({
  language: getInitialLanguage(),
  theme: initialTheme,
  snapToGrid: getInitialSnapToGrid(),
  paletteOpen: getInitialPaletteOpen(),
  activeTooltipId: null,
  activeTooltipTypeKey: null,
  selectedNodeIds: [],
  toolMode: 'select',
  leftTool: 'drag',
  clipboard: null,
  past: [],
  future: [],
  wire: null,
  highlightEdgeIds: [],
  overview: false,
  capturing: false,
  chainOffer: null,
  notice: null,

  ...initialCanvas,

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
    withoutHistory(() => set((s) => ({
      ...commitGraph(s, EMPTY_GRAPH, { newCanvas: true }),
      complexityLevel: level, past: [], future: [], chainName: '',
    })))
  },

  // Back in Select mode nothing is being wired (a new canvas and undo / redo drop the wire too: NO_WIRE)
  setToolMode: (mode) => set(mode === 'select' ? { toolMode: mode, wire: null } : { toolMode: mode }),

  startWire: (source, start) => set({ wire: { source, start, waypoints: [] } }),

  // The source stays the same object, so the cards watching it do not re-render
  addWireCorner: (at) => set((s) => (s.wire ? { wire: { ...s.wire, waypoints: [...s.wire.waypoints, at] } } : {})),

  cancelWire: () => set({ wire: null }),

  setHighlightEdges: (edgeIds) => set({ highlightEdgeIds: edgeIds }),

  setOverview: (on) => set({ overview: on }),

  setCapturing: (on) => set(on ? { capturing: true, overview: false } : { capturing: false }),

  setChainName: (name) => set({ chainName: name }),

  offerChain: (offer) => set({ chainOffer: offer }),

  loadChain: (chain) => {
    const apply = () => set((s) => ({
      ...commitGraph(s, chain, { newCanvas: true }),
      chainName: chain.name, complexityLevel: chain.level, chainOffer: null,
    }))
    if (chain.level === get().complexityLevel) { apply(); return }   // one undo step
    // Another level starts a new history, like switching level in the header
    localStorage.setItem('lsc-complexity-level', chain.level)
    withoutHistory(() => { apply(); set({ past: [], future: [] }) })
  },

  raiseLevel: (level) => {
    if (LEVELS.indexOf(level) <= LEVELS.indexOf(get().complexityLevel)) return
    localStorage.setItem('lsc-complexity-level', level)
    set({ complexityLevel: level })
  },

  showNotice: (text, error = false) => set({ notice: { text, error, id: Date.now() } }),

  clearNotice: () => set({ notice: null }),

  resetAll: () =>
    set((s) => ({ ...commitGraph(s, EMPTY_GRAPH, { newCanvas: true }), chainName: '' })),

  // ── Graph mutations ───────────────────────────────────────────────────────
  // Every one goes through commitGraph (below)

  // Each source starts a chain — tagged with its own colour
  addNode: (node) => set((s) => commitGraph(s, withNodes(s, [node]))),

  // Removing a Main Fader (or what fed it) hands the L / R wires back to the bus
  removeNode: (nodeId) => set((s) => commitGraph(s, withoutNode(s, nodeId))),

  removeNodes: (nodeIds) => set((s) => commitGraph(s, withoutNodes(s, nodeIds))),

  // Each copied source starts a chain of its own colour
  addGroup: (added, addedEdges) =>
    set((s) => ({ ...commitGraph(s, withNodes(s, added, addedEdges)), selectedNodeIds: added.map((n) => n.id) })),

  // One step, so a card dropped onto a Mix wire does not unplug the Main Fader on the way
  insertOnWire: (node, edgeId) => set((s) => commitGraph(s, withNodeOnWire(s, node, edgeId))),

  // A Relay switching input can change what reaches a Graphic EQ / Amplifier after it (Mono ↔ Stereo)
  updateNodeParams: (nodeId, patch) =>
    set((s) => commitGraph(s, {
      nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, ...patch } } : n)),
      edges: s.edges,
    })),

  toggleBypassNode: (nodeId) =>
    set((s) => commitGraph(s, {
      nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, bypassed: !n.bypassed } : n)),
      edges: s.edges,
    })),

  // A fader on the new L output becomes the Main Fader; one that lost its Mix wire is plain again
  setNodeStereo: (nodeId, on) =>
    set((s) => {
      const next = withStereo(s, nodeId, on)
      return next ? commitGraph(s, next) : {}
    }),

  // A Fader wired to a stereo bus's L or R becomes its Main Fader (see utils/mainFader.ts)
  addEdge: (edge) => set((s) => commitGraph(s, { nodes: s.nodes, edges: [...s.edges, edge] })),

  // Unplugging a Main Fader hands the bus's L / R wires back to the bus
  removeEdge: (edgeId) =>
    set((s) => commitGraph(s, { nodes: s.nodes, edges: s.edges.filter((e) => e.id !== edgeId) })),

  updateEdgeWaypoints: (edgeId, waypoints) =>
    set((s) => commitGraph(s, {
      nodes: s.nodes,
      edges: s.edges.map((e) => (e.id === edgeId ? { ...e, waypoints } : e)),
    })),

  setPositions: (moves) => set((s) => (moves.size === 0 ? {} : commitGraph(s, withPositions(s, moves)))),

  moveNodes: (nodeIds, delta) =>
    set((s) => {
      const moving = new Set(nodeIds)
      const move   = (p: Pt) => ({ x: p.x + delta.x, y: p.y + delta.y })
      return commitGraph(s, {
        nodes: s.nodes.map((n) => (moving.has(n.id) ? { ...n, position: move(n.position) } : n)),
        edges: s.edges.map((e) => (moving.has(e.source) && moving.has(e.target) && e.waypoints
          ? { ...e, waypoints: e.waypoints.map(move) }
          : e)),
      })
    }),
}))

// ── One way into the graph ──────────────────────────────────────────────────

/** No wire is being drawn (a new canvas, undo / redo: the wire's start may be gone or have moved). */
const NO_WIRE = { toolMode: 'select', wire: null } as const

/**
 * Every change to the graph goes through here. Settles who holds each stereo mix's Left / Right —
 * plugging or unplugging a wire, removing an element, switching a bus to Mono or a Relay to its
 * other input can each change it (utils/mainFader.ts) — and drops what pointed at elements or
 * wires that are gone. A new canvas (New, a level change, an opened chain) comes from nothing:
 * nothing is handed back to it, and nothing that pointed at the old canvas is kept, even where
 * the new one reuses its ids.
 */
function commitGraph(
  s: SignalChainStore,
  graph: GraphView,
  { newCanvas = false } = {},
): Partial<SignalChainStore> {
  const prev    = newCanvas ? EMPTY_GRAPH : s
  const settled = reconcileMainFaders(prev, graph)
  // Unchanged wires keep the same array, so what watches only the wires does not re-render
  const edges   = settled.length === graph.edges.length && settled.every((e, i) => e === graph.edges[i])
    ? graph.edges
    : settled
  const next = { nodes: graph.nodes, edges }
  return { ...next, ...pruneRefs(s, newCanvas ? EMPTY_GRAPH : next), ...(newCanvas ? NO_WIRE : {}) }
}

/**
 * The selection, the help popover, highlighted wires and a wire being drawn, kept only where
 * they still point at an element or wire of `graph`. Only what changes is returned.
 */
function pruneRefs(s: SignalChainStore, graph: GraphView): Partial<SignalChainStore> {
  const nodeIds   = new Set(graph.nodes.map((n) => n.id))
  const edgeIds   = new Set(graph.edges.map((e) => e.id))
  const selected  = s.selectedNodeIds.filter((id) => nodeIds.has(id))
  const highlight = s.highlightEdgeIds.filter((id) => edgeIds.has(id))
  return {
    ...(selected.length < s.selectedNodeIds.length ? { selectedNodeIds: selected } : {}),
    ...(highlight.length < s.highlightEdgeIds.length ? { highlightEdgeIds: highlight } : {}),
    ...(s.activeTooltipId && !nodeIds.has(s.activeTooltipId) ? { activeTooltipId: null, activeTooltipTypeKey: null } : {}),
    ...(s.wire && !nodeIds.has(s.wire.source.nodeId) ? NO_WIRE : {}),
  }
}

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

/**
 * The graph back as it was in `step`; what pointed at missing elements is dropped. Not through
 * commitGraph: a step was settled when it was made, and the takeover rules would hand wires back
 * across the jump.
 */
function restore(s: SignalChainStore, step: GraphSnapshot): Partial<SignalChainStore> {
  return { nodes: step.nodes, edges: step.edges, ...pruneRefs(s, step), ...NO_WIRE }
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

// ── Autosave ────────────────────────────────────────────────────────────────
// The canvas is kept in the browser, so a refresh or reopening the tab brings it back. Written
// shortly after the last change (a knob being turned writes once), and when the page is left.

const SAVE_QUIET_MS = 300
let saveTimer: ReturnType<typeof setTimeout> | undefined

function saveCanvas() {
  clearTimeout(saveTimer)
  saveTimer = undefined
  const { nodes, edges, chainName, complexityLevel } = useSignalStore.getState()
  const chain = toChainFile({ nodes, edges, outEdges: [], sizes: {} }, chainName, complexityLevel)
  try { localStorage.setItem(CANVAS_KEY, JSON.stringify(chain)) } catch { /* storage full or blocked */ }
}

useSignalStore.subscribe((s, prev) => {
  if (s.nodes === prev.nodes && s.edges === prev.edges &&
      s.chainName === prev.chainName && s.complexityLevel === prev.complexityLevel) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveCanvas, SAVE_QUIET_MS)
})

window.addEventListener('pagehide', () => { if (saveTimer) saveCanvas() })
