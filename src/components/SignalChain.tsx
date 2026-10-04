import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Edge,
  type Node as FlowNode,
  type NodeChange,
  BackgroundVariant,
  SelectionMode,
  useReactFlow,
  useStoreApi,
  useViewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { MicNode }             from './nodes/MicNode'
import { GainNode }            from './nodes/GainNode'
import { FaderNode }           from './nodes/FaderNode'
import { MasterBusNode }       from './nodes/MasterBusNode'
import { AmpNode }             from './nodes/AmpNode'
import { SpeakerNode }         from './nodes/SpeakerNode'
import { ActiveSpeakerNode }   from './nodes/ActiveSpeakerNode'
import { SwitchNode }          from './nodes/SwitchNode'
import { CompressorNode }      from './nodes/CompressorNode'
import { HpfNode }             from './nodes/HpfNode'
import { EQNode }              from './nodes/EQNode'
import { GraphicEQNode }       from './nodes/GraphicEQNode'
import { DIBoxNode }           from './nodes/DIBoxNode'
import { NoiseGateNode }       from './nodes/NoiseGateNode'
import { LimiterNode }         from './nodes/LimiterNode'
import { PadNode }             from './nodes/PadNode'
import { DeesserNode }         from './nodes/DeesserNode'
import { RelayNode }           from './nodes/RelayNode'
import { PanNode }             from './nodes/PanNode'
import { AudioInterfaceNode }  from './nodes/AudioInterfaceNode'
import { AdcDacNode }          from './nodes/AdcDacNode'
import { ChainEdge }           from './ChainEdge'
import type { ChainEdgeData }  from './ChainEdge'
import { ConnectingToast }     from './ConnectingToast'
import { HelpPopover }         from './Tooltip'
import { NodeMenu, CanvasMenu } from './NodeMenu'
import { CanvasTools }         from './CanvasTools'
import { ConfirmDialog }       from './ConfirmDialog'
import { DirectionArrows }     from './DirectionArrows'

import { useSignalStore } from '../store/signalStore'
import { LEVELS } from '../data/levels'
import { useGraphSignal }     from '../hooks/useGraphSignal'
import { getHealth, healthColor } from '../signal/levels'
import { levelOf }            from '../signal/engine'
import { useEdgeReshape }     from '../hooks/useEdgeReshape'
import { useLatestRef }       from '../hooks/useLatestRef'
import { useChainEmpty }      from '../hooks/useChainEmpty'
import { useChainFile }       from '../hooks/useChainFile'
import { useMediaQuery, TABLET_QUERY } from '../hooks/useMediaQuery'
import { NODE_REGISTRY, initialParams } from '../data/nodeRegistry'
import { getPorts, isMatrixSource } from '../graph/queries'
import type { SignalNode, SignalEdge } from '../data/nodeRegistry'
import { newEdge } from '../graph/edits'
import { activeDragTypeKey }  from '../utils/dragState'
import {
  GRID, MIN_NODE_GAP, PORT_TOP,
  nodeDims, recordMeasuredSize, resolveOverlap,
  enforceGap, makeRoomForInsert, findEdgeAtPoint, canInsertMidChain,
} from '../utils/layoutHelpers'
import type { Pt } from '../utils/layoutHelpers'
import { buildWirePath } from '../utils/wirePath'
import { wirePassesThroughNode } from '../utils/wireValidation'
import { chainOfEdge } from '../utils/chainColors'
import { nodeAcceptsWire, portAcceptsWire } from '../utils/connectionRules'
import { useTranslation } from '../i18n/useTranslation'
import { takeGroup, cloneGroup, groupBox, duplicateOffset, pasteOffset, besideOffset } from '../utils/nodeGroup'
import type { Direction, NodeGroup, Placed } from '../utils/nodeGroup'
import { chainToGroup, readLink, LINK_PREFIX } from '../utils/chainFile'
import type { ParsedChain } from '../utils/chainFile'

// nodeTypes must be defined outside the component to avoid re-registration on every render
const nodeTypes = {
  mic:                MicNode,
  'line-in':          MicNode,
  instrument:         MicNode,
  'di-box':           DIBoxNode,
  gain:               GainNode,
  amp:                AmpNode,
  fader:              FaderNode,
  'noise-gate':       NoiseGateNode,
  limiter:            LimiterNode,
  pad:                PadNode,
  deesser:            DeesserNode,
  'master-bus':       MasterBusNode,
  'aux-bus':          MasterBusNode,
  'matrix-bus':       MasterBusNode,
  'audio-interface':  AudioInterfaceNode,
  hpf:                HpfNode,
  eq:                 EQNode,
  comp:               CompressorNode,
  switch:             SwitchNode,
  relay:              RelayNode,
  pan:                PanNode,
  'graphic-eq':       GraphicEQNode,
  speaker:            SpeakerNode,
  'active-speaker':   ActiveSpeakerNode,
  adc:                AdcDacNode,
  dac:                AdcDacNode,
}

const edgeTypes = { chain: ChainEdge }

// Overview: zoomed out this far, cards show only their name and output level. Two thresholds
// (hysteresis), so a zoom resting near the boundary never flips the cards back and forth.
const OVERVIEW_ENTER_ZOOM = 0.42
const OVERVIEW_LEAVE_ZOOM = 0.5
// Wire width in overview (normal: 3), so wires stay visible when the whole chain fits on screen
const OVERVIEW_WIRE_WIDTH = 8

// ── Wire drawing types ─────────────────────────────────────────────────────────

type WireDrawing =
  | { active: false }
  | {
      active: true
      sourceNodeId: string
      sourceHandleId: string
      startPos: Pt
      waypoints: Pt[]   // committed intermediate corners
      cursorPos: Pt
    }

// ── Pure DOM helpers ───────────────────────────────────────────────────────────

/** Find the react-flow handle element at a screen point. */
function handleUnder(clientX: number, clientY: number): HTMLElement | null {
  return (
    document.elementsFromPoint(clientX, clientY)
      .find((el) => el.classList.contains('react-flow__handle')) as HTMLElement
  ) ?? null
}

/** What is used, not selected, when clicked inside a card: its controls and ports. */
const INTERACTIVE = '.nodrag, button, input, select, textarea, a, [role="slider"], .react-flow__handle'

/** The element (card or control) or wire a Remove-tool click lands on, if any. */
function removeTargetOf(target: EventTarget | null): { node?: string; edge?: string } | null {
  const el = target as Element | null
  if (!el?.closest || el.closest('.lsc-overlay, .react-flow__panel')) return null
  const node = el.closest('.react-flow__node')?.getAttribute('data-id')
  if (node) return { node }
  const edge = el.closest('.react-flow__edge')?.getAttribute('data-id')
  return edge ? { edge } : null
}

/** Get flow-coordinate center of a handle DOM element. */
function handleFlowPos(el: HTMLElement, toFlow: (p: Pt) => Pt): Pt {
  const r = el.getBoundingClientRect()
  return toFlow({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
}

/**
 * What a card's ports depend on: its port layout (a stereo Aux's L / R, a bus or fader taken
 * over by a Main Fader) and the wires plugged into it (the audio interface grows an input per wire).
 * When this changes, React Flow must re-read the ports.
 */
function portLayoutKey(node: SignalNode, nodes: SignalNode[], edges: SignalEdge[]): string {
  const { inputs, outputs } = getPorts(node, { nodes, edges })
  const plugged = edges.filter((e) => e.target === node.id).map((e) => e.targetHandle).sort()
  return `${[...inputs, ...outputs].map((p) => p.id).join(',')}|${plugged.join(',')}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SignalChain() {
  const graphNodes            = useSignalStore((s) => s.nodes)
  const graphEdges            = useSignalStore((s) => s.edges)
  const complexityLevel       = useSignalStore((s) => s.complexityLevel)
  const toolMode              = useSignalStore((s) => s.toolMode)
  const snapToGrid            = useSignalStore((s) => s.snapToGrid)
  const selectedNodeIds       = useSignalStore((s) => s.selectedNodeIds)
  const leftTool              = useSignalStore((s) => s.leftTool)
  const paletteOpen           = useSignalStore((s) => s.paletteOpen)
  const clipboard             = useSignalStore((s) => s.clipboard)
  const setToolMode           = useSignalStore((s) => s.setToolMode)
  const setWireSource         = useSignalStore((s) => s.setWireSource)
  const setSelectedNode       = useSignalStore((s) => s.setSelectedNode)
  const setSelection          = useSignalStore((s) => s.setSelection)
  const setClipboard          = useSignalStore((s) => s.setClipboard)
  const addGroup              = useSignalStore((s) => s.addGroup)
  const removeNode            = useSignalStore((s) => s.removeNode)
  const removeNodes           = useSignalStore((s) => s.removeNodes)
  const moveNodes             = useSignalStore((s) => s.moveNodes)
  const setActiveTooltip      = useSignalStore((s) => s.setActiveTooltip)
  const addNode               = useSignalStore((s) => s.addNode)
  const addEdge               = useSignalStore((s) => s.addEdge)
  const removeEdge            = useSignalStore((s) => s.removeEdge)
  const insertOnWire          = useSignalStore((s) => s.insertOnWire)
  const highlightEdgeIds      = useSignalStore((s) => s.highlightEdgeIds)
  const overview              = useSignalStore((s) => s.overview)
  const setOverview           = useSignalStore((s) => s.setOverview)
  const setPositions          = useSignalStore((s) => s.setPositions)
  const updateEdgeWaypoints   = useSignalStore((s) => s.updateEdgeWaypoints)
  const capturing             = useSignalStore((s) => s.capturing)
  const chainOffer            = useSignalStore((s) => s.chainOffer)
  const offerChain            = useSignalStore((s) => s.offerChain)
  const loadChain             = useSignalStore((s) => s.loadChain)
  const raiseLevel            = useSignalStore((s) => s.raiseLevel)
  const { stages, wires }     = useGraphSignal()
  const { t, fmt }            = useTranslation()
  const chainFile             = useChainFile()
  // An autosaved canvas is brought on screen once it is measured (a blank one stays at 100%)
  const [startsFilled]        = useState(() => useSignalStore.getState().nodes.length > 0)
  const chainEmpty            = useChainEmpty()
  const { screenToFlowPosition, flowToScreenPosition, getNodes, getInternalNode, fitView, setViewport } = useReactFlow()
  const flowStore             = useStoreApi()
  const isTablet              = useMediaQuery(TABLET_QUERY)
  // The palette slides over the canvas: "show everything" keeps clear of it
  const paletteWidth          = paletteOpen ? (isTablet ? 64 : 240) : 0
  const { x: vpX, y: vpY, zoom: vpZoom } = useViewport()
  const vpZoomRef             = useLatestRef(vpZoom)

  const [drawing, setDrawing]               = useState<WireDrawing>({ active: false })
  const [snapPos, setSnapPos]               = useState<Pt | null>(null)
  const [wireWarning, setWireWarning]       = useState(false)
  const [dropPreview, setDropPreview]       = useState<{ typeKey: string; pos: Pt } | null>(null)
  // Where the dragged elements will land (several when a selection is dragged)
  const [dragGhosts, setDragGhosts]         = useState<{ pos: Pt; w: number; h: number }[]>([])
  // Right-click menu of an element (Help, Bypass, Cut, Copy, Duplicate, Remove) — `targets` are
  // what its actions apply to: the element, or the whole selection it belongs to
  const [nodeMenu, setNodeMenu]             = useState<{ nodeId: string; targets: string[]; x: number; y: number } | null>(null)
  // Right-click menu of the empty canvas (Paste here, Select everything); `at` in flow coordinates
  const [canvasMenu, setCanvasMenu]         = useState<{ x: number; y: number; at: Pt } | null>(null)
  // React Flow's measured card sizes, handed back with the nodes (see displayNodes)
  const [measuredSizes, setMeasuredSizes]   = useState<Record<string, { width: number; height: number; ports: string }>>({})

  // Mutable refs so document-level handlers always see current state
  const wrapperRef      = useRef<HTMLDivElement>(null)
  const drawingRef      = useLatestRef(drawing)
  const toolModeRef     = useLatestRef(toolMode)
  const leftToolRef     = useLatestRef(leftTool)
  // Last mouse position on screen — Ctrl+V pastes there when it is over the canvas
  const lastMouseRef    = useRef<Pt | null>(null)
  // Where the last press started and whether it was on a control (see onNodeClick)
  const pressRef        = useRef<{ x: number; y: number; onControl: boolean } | null>(null)
  const edgesRef        = useLatestRef(graphEdges)
  const graphNodesRef   = useLatestRef(graphNodes)
  const revertTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set when a press on a port was used for wiring — the click that follows it is swallowed
  const swallowClickRef = useRef(false)
  // A card just dropped onto a wire: the cards around it make room once its real size is known
  const pendingInsertRef = useRef<string | null>(null)

  const { reshaping, setReshaping } = useEdgeReshape(screenToFlowPosition, edgesRef, updateEdgeWaypoints)

  /** React Flow nodes with their real rendered size (cards size themselves to content). */
  function measuredNodes(): FlowNode[] {
    return getNodes().map((n) => ({ ...n, measured: getInternalNode(n.id)?.measured ?? n.measured }))
  }

  /** Store nodes (always current) with React Flow's measured card sizes, for the layout helpers. */
  function layoutNodes(nodes: SignalNode[] = graphNodesRef.current): FlowNode[] {
    return nodes.map((n) => ({
      id: n.id, type: n.typeKey, position: n.position, data: {},
      measured: getInternalNode(n.id)?.measured,
    }))
  }

  function snap(p: Pt): Pt {
    return snapToGrid
      ? { x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID }
      : { x: Math.round(p.x), y: Math.round(p.y) }
  }

  /** Top-left of a node dropped at the cursor: the cursor sits on its port line. */
  function dropOrigin(raw: Pt): Pt {
    return snap({ x: raw.x, y: raw.y - PORT_TOP })
  }

  // ── Wire state ──────────────────────────────────────────────────────────────

  const cancelWire = useCallback(() => {
    setDrawing({ active: false })
    setSnapPos(null)
    setWireWarning(false)
  }, [])

  // Share the wire's source with node cards so valid inputs can highlight themselves
  const wireSourceNodeId   = drawing.active ? drawing.sourceNodeId : null
  const wireSourceHandleId = drawing.active ? drawing.sourceHandleId : null
  useEffect(() => {
    setWireSource(wireSourceNodeId && wireSourceHandleId
      ? { nodeId: wireSourceNodeId, handleId: wireSourceHandleId }
      : null)
  }, [wireSourceNodeId, wireSourceHandleId, setWireSource])

  // Cancel drawing when leaving connect mode (e.g. Reset or a level change mid-wire)
  useEffect(() => useSignalStore.subscribe((s, prev) => {
    if (prev.toolMode === 'connect' && s.toolMode !== 'connect') cancelWire()
  }), [cancelWire])

  // Esc cancels the wire being drawn, otherwise closes the help popover
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      const { activeTooltipId } = useSignalStore.getState()
      if (drawingRef.current.active) cancelWire()
      else if (activeTooltipId) setActiveTooltip(null, null)
      else setSelection([])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setActiveTooltip, setSelection, cancelWire, drawingRef])

  // The canvas follows the mouse: hovering a port switches to connect mode, moving
  // away switches back to select mode after a short delay (never while a wire is drawn).
  // While a wire is drawn, the cursor is tracked for the live preview instead.
  useEffect(() => {
    function followMouse(e: MouseEvent) {
      // A button is held: a node, slider or the canvas is being dragged — don't switch mid-drag
      if (e.buttons !== 0) return
      // The Remove tool never wires: a click on a port removes its element
      if (leftToolRef.current === 'remove') {
        if (toolModeRef.current === 'connect') setToolMode('select')
        return
      }
      if (handleUnder(e.clientX, e.clientY)) {
        if (revertTimerRef.current) { clearTimeout(revertTimerRef.current); revertTimerRef.current = null }
        if (toolModeRef.current === 'select') setToolMode('connect')
      } else if (toolModeRef.current === 'connect' && !revertTimerRef.current) {
        revertTimerRef.current = setTimeout(() => {
          revertTimerRef.current = null
          if (!drawingRef.current.active) setToolMode('select')
        }, 200)
      }
    }

    function onMove(e: MouseEvent) {
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
      const d = drawingRef.current
      if (!d.active) { followMouse(e); return }
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setDrawing((prev) => (prev.active ? { ...prev, cursorPos: flowPos } : prev))
      const hEl  = handleUnder(e.clientX, e.clientY)
      const onTarget = hEl?.classList.contains('target') ? hEl : null
      const snapTo = onTarget ? handleFlowPos(onTarget, screenToFlowPosition) : null
      setSnapPos(snapTo)
      const allPts = [d.startPos, ...d.waypoints, snapTo ?? flowPos]
      const nodesForValidation = graphNodesRef.current.map((n) => {
        const m = getInternalNode(n.id)?.measured
        return { id: n.id, position: n.position, width: m?.width, height: m?.height }
      })
      // The wire ends on its target's edge — only other cards in the way count as crossing
      const exclude = onTarget ? [d.sourceNodeId, onTarget.dataset.nodeid!] : [d.sourceNodeId]
      setWireWarning(wirePassesThroughNode(allPts, nodesForValidation, exclude))
    }
    document.addEventListener('mousemove', onMove)
    return () => {
      document.removeEventListener('mousemove', onMove)
      if (revertTimerRef.current) { clearTimeout(revertTimerRef.current); revertTimerRef.current = null }
    }
  }, [screenToFlowPosition, getInternalNode, setToolMode, drawingRef, toolModeRef, leftToolRef, graphNodesRef])

  // Click interception — capture phase fires before React Flow's own handlers
  useEffect(() => {
    // Remove tool: a press on an element or wire removes it. Pointer events come first —
    // knobs and faders listen to them — so nothing inside the card reacts to the press.
    function onPointerDown(e: PointerEvent) {
      pressRef.current = { x: e.clientX, y: e.clientY, onControl: Boolean((e.target as Element).closest?.(INTERACTIVE)) }
      if (e.button !== 0 || leftToolRef.current !== 'remove') return
      // A removed element takes its click with it — a flag left from that press must not eat this one
      swallowClickRef.current = false
      if (!wrapperRef.current?.contains(e.target as Element)) return
      const hit = removeTargetOf(e.target)
      if (!hit) return
      e.preventDefault()
      e.stopPropagation()
      swallowClickRef.current = true
      if (hit.node) removeNode(hit.node)
      else if (hit.edge) removeEdge(hit.edge)
    }

    function onDown(e: MouseEvent) {
      if (e.button !== 0) return
      // (The press was already handled by onPointerDown; keep its click swallowed)
      if (leftToolRef.current === 'remove' && swallowClickRef.current) { e.stopPropagation(); return }
      swallowClickRef.current = false
      const targetEl = e.target as Element
      // Only clicks on the canvas itself — not the palette, header or popovers
      if (!wrapperRef.current?.contains(targetEl)) return
      if (targetEl.closest('.lsc-overlay')) return

      // A reshape handle (waypoint drag circle) under the cursor — in either mode
      const reshapeEl = document.elementsFromPoint(e.clientX, e.clientY)
        .find((el) => el.classList.contains('lsc-reshape-handle')) as Element | null
      if (reshapeEl) {
        e.stopPropagation()
        const edgeId        = reshapeEl.getAttribute('data-edgeid')!
        const waypointIndex = parseInt(reshapeEl.getAttribute('data-wpidx') ?? '-1')
        const segmentIndex  = parseInt(reshapeEl.getAttribute('data-segidx') ?? '0')
        const inserting     = reshapeEl.getAttribute('data-inserting') === 'true'
        const fp = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        setReshaping({ edgeId, waypointIndex, segmentIndex, inserting, livePos: fp })
        return
      }

      if (toolModeRef.current !== 'connect') return

      const d       = drawingRef.current
      const hEl     = handleUnder(e.clientX, e.clientY)
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })

      if (!d.active) {
        if (hEl?.classList.contains('source')) {
          e.stopPropagation()
          swallowClickRef.current = true
          setDrawing({
            active: true,
            sourceNodeId:   hEl.dataset.nodeid!,
            sourceHandleId: hEl.dataset.handleid!,
            startPos:  handleFlowPos(hEl, screenToFlowPosition),
            waypoints: [],
            cursorPos: flowPos,
          })
        } else if (hEl?.classList.contains('target')) {
          // An input's click unplugs its wire (NodePort) — keep React Flow from starting a drag-connection
          e.stopPropagation()
        }
        return
      }

      // Wire is being drawn — intercept ALL left-clicks on the canvas
      e.stopPropagation()
      // A press on a port also eats its click: on the input just plugged, that click would unplug it again
      if (hEl) swallowClickRef.current = true

      if (hEl?.classList.contains('target')) {
        const targetNodeId   = hEl.dataset.nodeid!
        const targetHandleId = hEl.dataset.handleid!
        const targetNode     = graphNodesRef.current.find((n) => n.id === targetNodeId)
        const source         = { nodeId: d.sourceNodeId, handleId: d.sourceHandleId }

        const allowed = targetNode !== undefined &&
          nodeAcceptsWire(targetNode, source, edgesRef.current, graphNodesRef.current) &&
          portAcceptsWire(targetNode, targetHandleId, edgesRef.current, source)

        if (!allowed) {
          if (targetNodeId !== d.sourceNodeId) {
            hEl.classList.add('lsc-handle-rejected')
            setTimeout(() => hEl.classList.remove('lsc-handle-rejected'), 600)
          }
          return
        }

        addEdge(newEdge({
          source:       d.sourceNodeId,
          sourceHandle: d.sourceHandleId,
          target:       targetNodeId,
          targetHandle: targetHandleId,
          waypoints:    d.waypoints.length > 0 ? d.waypoints : undefined,
        }))
        setPositions(enforceGap(d.sourceNodeId, targetNodeId, measuredNodes(), edgesRef.current))
        cancelWire()
        return
      }

      if (hEl?.classList.contains('source')) {
        setDrawing({
          active: true,
          sourceNodeId:   hEl.dataset.nodeid!,
          sourceHandleId: hEl.dataset.handleid!,
          startPos:  handleFlowPos(hEl, screenToFlowPosition),
          waypoints: [],
          cursorPos: flowPos,
        })
        return
      }

      // Click in empty space → commit a corner waypoint
      setDrawing((prev) =>
        prev.active ? { ...prev, waypoints: [...prev.waypoints, flowPos] } : prev
      )
    }

    // The click that ends a wiring press must not reach the cards: it would land on the
    // input that was just plugged in, and NodePort's click unplugs it again.
    function onClick(e: MouseEvent) {
      if (!swallowClickRef.current) return
      swallowClickRef.current = false
      e.stopPropagation()
    }

    function onContext(e: MouseEvent) {
      if (toolModeRef.current !== 'connect') return
      if (!drawingRef.current.active) return
      e.preventDefault()
      // The right-click only cancels the wire: it must not open the element's menu too
      e.stopPropagation()
      cancelWire()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('contextmenu', onContext, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('contextmenu', onContext, true)
    }
  // measuredNodes reads React Flow's live state each call
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenToFlowPosition, addEdge, removeNode, removeEdge, setPositions, setReshaping])

  // ── Selection, copy and paste ───────────────────────────────────────────────

  /**
   * A click on an element selects it — only on its empty parts: using a knob, slider, button or
   * port is not selecting the card. The Select tool (or Ctrl / ⌘ / Shift) adds it to the
   * selection, or drops it again.
   */
  function onNodeClick(e: React.MouseEvent, node: FlowNode) {
    // Judged by where the press started: a knob drag that ends off the knob clicks the card itself
    const press = pressRef.current
    const moved = press ? Math.hypot(e.clientX - press.x, e.clientY - press.y) > 4 : false
    if (!canEdit || press?.onControl || moved || (e.target as Element).closest(INTERACTIVE)) return
    const selected = useSignalStore.getState().selectedNodeIds
    const toggle   = leftTool === 'select' || e.ctrlKey || e.metaKey || e.shiftKey
    if (!toggle) setSelection([node.id])
    else setSelection(selected.includes(node.id) ? selected.filter((id) => id !== node.id) : [...selected, node.id])
  }

  /**
   * Dragging an element of the selection moves the whole selection; dragging any other element
   * moves just that one (React Flow drags it alone) and does not select it — the old selection is dropped.
   */
  function onNodeDragStart(e: React.MouseEvent, node: FlowNode) {
    const selected = useSignalStore.getState().selectedNodeIds
    if (selected.includes(node.id)) return
    // Ctrl-drag: React Flow takes the selection along with it
    if (e.ctrlKey || e.metaKey) setSelection([...selected, node.id])
    else if (selected.length > 0) setSelection([])
  }

  /** An element's real size (cards size to content). */
  function sizeOf(n: SignalNode) {
    const m = getInternalNode(n.id)?.measured
    return nodeDims(n.typeKey, m?.width, m?.height)
  }

  function placedNodes(): Placed[] {
    return graphNodesRef.current.map((n) => ({ position: n.position, size: sizeOf(n) }))
  }

  function groupOf(ids: string[]) {
    const { nodes, edges } = useSignalStore.getState()
    return takeGroup(ids, nodes, edges, sizeOf)
  }

  /**
   * Add a copy of `group` moved by `offset`, select it and bring it on screen (`showAll`: the
   * whole canvas, for a chain added beside everything).
   */
  function placeCopy(group: NodeGroup, offset: Pt, showAll = false) {
    const { nodes, edges } = useSignalStore.getState()
    const copy = cloneGroup(group, offset, { nodes, edges })
    addGroup(copy.nodes, copy.edges)
    if (showAll) {
      setTimeout(() => fitView({ ...fitViewOptions, maxZoom: Math.min(1, vpZoomRef.current) }), 50)
      return
    }
    // Only move the camera when the copy is (partly) off screen; never zoom in
    const box    = groupBox(group)
    const tl     = flowToScreenPosition({ x: box.left + offset.x, y: box.top + offset.y })
    const br     = flowToScreenPosition({ x: box.right + offset.x, y: box.bottom + offset.y })
    const bounds = wrapperRef.current?.getBoundingClientRect()
    if (bounds && (tl.x < bounds.left + paletteWidth || tl.y < bounds.top || br.x > bounds.right || br.y > bounds.bottom)) {
      const ids = [...group.nodes.map((n) => n.id), ...copy.nodes.map((n) => n.id)]
      setTimeout(() => fitView({ ...fitViewOptions, maxZoom: Math.min(1, vpZoomRef.current), nodes: ids.map((id) => ({ id })) }), 50)
    }
  }

  function duplicateNodes(ids: string[], dir: Direction) {
    if (ids.length === 0) return
    const group = groupOf(ids)
    placeCopy(group, duplicateOffset(group, dir, placedNodes()))
  }

  function copyNodes(ids: string[]) {
    if (ids.length > 0) setClipboard(groupOf(ids))
  }

  function cutNodes(ids: string[]) {
    if (ids.length === 0) return
    copyNodes(ids)
    removeNodes(ids)
  }

  function removeSelected(ids: string[]) {
    if (ids.length === 1) removeNode(ids[0])   // one element: its neighbours are wired together
    else if (ids.length > 1) removeNodes(ids)
  }

  /** Paste the copied elements with their top-left corner at `at` (flow coordinates), or beside where they were. */
  function pasteAt(at: Pt | null) {
    const clip = useSignalStore.getState().clipboard
    if (!clip || clip.nodes.length === 0) return
    const box = groupBox(clip)
    placeCopy(clip, pasteOffset(clip, snap(at ?? { x: box.left + 2 * GRID, y: box.top + 2 * GRID }), placedNodes()))
  }

  // ── Opened chains (File menu, share link, a file dropped on the canvas) ─────

  /** The canvas becomes the chain (at the level it was made at). */
  function replaceWithChain(read: ParsedChain) {
    loadChain(read.chain)
    setTimeout(() => fitView(fitViewOptions), 50)
  }

  /** The chain's elements join the canvas with new ids and chain colours, moved by `offsetOf`. */
  function addChain(read: ParsedChain, offsetOf: (group: NodeGroup) => Pt, showAll = false) {
    offerChain(null)
    raiseLevel(read.chain.level)
    const group = chainToGroup(read.chain)
    placeCopy(group, offsetOf(group), showAll)
  }

  /** Right-click → Insert a saved chain here, or a file dropped at `at`: no question asked. */
  function insertChainAt(read: ParsedChain, at: Pt) {
    addChain(read, (group) => pasteOffset(group, snap(at), placedNodes()))
    chainFile.skippedNotice(read)
  }

  // Onto an empty canvas an opened chain just loads; otherwise the open dialog asks
  const chainActionsRef = useLatestRef({ replaceWithChain, skippedNotice: chainFile.skippedNotice })
  useEffect(() => {
    if (!chainOffer || !chainEmpty) return
    chainActionsRef.current.replaceWithChain(chainOffer)
    chainActionsRef.current.skippedNotice(chainOffer)
  }, [chainOffer, chainEmpty, chainActionsRef])

  // A share link (#chain=…) opens its chain. The address is cleaned first, so a refresh does not
  // open it again.
  const linkBrokenRef = useLatestRef(t.file.linkBroken)
  useEffect(() => {
    function openLink() {
      const { hash, pathname, search } = window.location
      if (!hash.startsWith(LINK_PREFIX)) return
      history.replaceState(null, '', pathname + search)
      readLink(hash).then((read) => {
        if (read === 'broken') useSignalStore.getState().showNotice(linkBrokenRef.current, true)
        else if (read) useSignalStore.getState().offerChain(read)
      })
    }
    openLink()
    window.addEventListener('hashchange', openLink)
    return () => window.removeEventListener('hashchange', openLink)
  }, [linkBrokenRef])

  // Keyboard: Ctrl / ⌘ + C, X, V, D (duplicate to the right), A (select everything), Z (undo),
  // Shift+Z or Y (redo); Delete removes
  const actionsRef = useLatestRef({ duplicateNodes, copyNodes, cutNodes, pasteAt, removeSelected })
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (target.closest('[role="menu"], [role="dialog"]')) return
      const a   = actionsRef.current
      const ids = useSignalStore.getState().selectedNodeIds
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (ids.length > 0) { e.preventDefault(); a.removeSelected(ids) }
        return
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const key = e.key.toLowerCase()
      const { undo, redo } = useSignalStore.getState()
      if (key === 'z') (e.shiftKey ? redo : undo)()
      else if (key === 'y') redo()
      else if (key === 'c' && ids.length > 0) a.copyNodes(ids)
      else if (key === 'x' && ids.length > 0) a.cutNodes(ids)
      else if (key === 'd' && ids.length > 0) a.duplicateNodes(ids, 'right')
      else if (key === 'v') {
        const m    = lastMouseRef.current
        const over = m && wrapperRef.current?.contains(document.elementFromPoint(m.x, m.y))
        a.pasteAt(over ? screenToFlowPosition(m) : null)
      } else if (key === 'a') setSelection(useSignalStore.getState().nodes.map((n) => n.id))
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actionsRef, screenToFlowPosition, setSelection])

  // ── Camera ──────────────────────────────────────────────────────────────────

  // A blank canvas (start, Reset, level change, last node removed) shows 100% zoom
  useEffect(() => {
    if (chainEmpty) setViewport({ x: 0, y: 0, zoom: 1 })
  }, [chainEmpty, setViewport])

  // Cards read only this flag, never the zoom itself, so a wheel tick does not re-render them all
  // (Not while a picture is taken: it shows the cards' controls whatever the zoom)
  useEffect(() => {
    if (capturing) return
    if (!overview && vpZoom < OVERVIEW_ENTER_ZOOM) setOverview(true)
    else if (overview && vpZoom > OVERVIEW_LEAVE_ZOOM) setOverview(false)
  }, [vpZoom, overview, setOverview, capturing])

  // ── Drag & drop from the palette ────────────────────────────────────────────

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const typeKey = activeDragTypeKey
    if (!typeKey) return
    const raw = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    // Over a wire, the preview shows where the card will really go
    setDropPreview({ typeKey, pos: insertSlot(raw, typeKey)?.pos ?? dropOrigin(raw) })
  }

  function onDragLeave(e: React.DragEvent) {
    const rt = e.relatedTarget as Node | null
    if (rt && (e.currentTarget as Element).contains(rt)) return
    setDropPreview(null)
  }

  /**
   * Where a card dropped at `raw` goes if it lands on a wire (null if it doesn't): right of the
   * wire's source and top-aligned with it, so the wires on both sides stay straight.
   */
  function insertSlot(raw: Pt, typeKey: string): { edge: SignalEdge; pos: Pt } | null {
    if (!canInsertMidChain(typeKey)) return null
    const nodes = layoutNodes()
    // Edges from Zustand: always in sync, unlike getEdges() which can lag
    const edge  = findEdgeAtPoint(raw, graphEdges, nodes)
    const src   = edge && nodes.find((n) => n.id === edge.source)
    if (!edge || !src) return null
    // A Matrix Bus only goes on a wire that carries a finished mix (after its fader)
    if (typeKey === 'matrix-bus' &&
        !isMatrixSource(edge.source, edge.sourceHandle, { nodes: graphNodes, edges: graphEdges })) return null
    const srcRight = src.position.x + nodeDims(src.type ?? '', src.measured?.width, src.measured?.height).w
    const minX     = Math.round((srcRight + MIN_NODE_GAP) / GRID) * GRID
    return { edge, pos: { x: Math.max(minX, dropOrigin(raw).x), y: src.position.y } }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDropPreview(null)
    // A saved chain (.json or picture) dropped from the computer goes where it is dropped
    const file = e.dataTransfer.files[0]
    if (file) {
      const at = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      chainFile.readFile(file).then((read) => { if (read) insertChainAt(read, at) })
      return
    }
    const typeKey = e.dataTransfer.getData('application/lsc-node-type')
    if (!typeKey) return
    const def = NODE_REGISTRY[typeKey]
    if (!def) return
    const raw    = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const newId  = `${typeKey}-${Date.now()}`
    const params = initialParams(typeKey, complexityLevel)

    // ── Smart edge insertion ───────────────────────────────────────────────────
    const slot = insertSlot(raw, typeKey)
    if (slot) {
      // One step: a Fader dropped on a bus's L / R wire becomes the Main Fader, and a card
      // dropped on a Mix wire sits between the bus and its Main Fader without unplugging it
      insertOnWire({ id: newId, typeKey, position: slot.pos, params, bypassed: false }, slot.edge.id)
      // The cards around it move once React Flow has measured it (onNodesChange): a type not
      // dropped before has no known size yet. The card stays hidden until then, so no overlap shows.
      pendingInsertRef.current = newId
      return
    }

    // ── Normal placement (no edge hit) ────────────────────────────────────────
    const { w, h } = nodeDims(typeKey)
    const finalPos = resolveOverlap(dropOrigin(raw), w, h, measuredNodes())
    addNode({ id: newId, typeKey, position: finalPos, params, bypassed: false })
  }

  /** A card dropped onto a wire has its real size now: the cards around it move out of its way. */
  function makeRoomForInserted(nodeId: string, size: { width: number; height: number }) {
    const { nodes, edges } = useSignalStore.getState()
    const placed = layoutNodes(nodes).map((n) => (n.id === nodeId ? { ...n, measured: size } : n))
    setPositions(makeRoomForInsert(nodeId, placed, edges))
    setTimeout(() => fitView({ ...fitViewOptions, duration: 400 }), 50)
  }

  // ── Moving nodes ────────────────────────────────────────────────────────────

  /** How far a dragged selection moves: the grabbed element snaps, the others keep their places around it. */
  function groupDelta(node: FlowNode): Pt {
    const from = graphNodesRef.current.find((n) => n.id === node.id)?.position ?? node.position
    const to   = snap(node.position)
    return { x: to.x - from.x, y: to.y - from.y }
  }

  function onNodeDrag(_e: React.MouseEvent, node: FlowNode, dragged: FlowNode[]) {
    if (dragged.length > 1) {
      const d = groupDelta(node)
      setDragGhosts(graphNodesRef.current
        .filter((n) => dragged.some((x) => x.id === n.id))
        .map((n) => ({ pos: { x: n.position.x + d.x, y: n.position.y + d.y }, ...sizeOf(n) })))
      return
    }
    const measured = getInternalNode(node.id)?.measured
    const { w, h } = nodeDims(node.type ?? '', measured?.width, measured?.height)
    const resolved = resolveOverlap(snap(node.position), w, h, measuredNodes(), node.id)
    setDragGhosts([{ pos: resolved, w, h }])
  }

  function onNodeDragStop(_e: React.MouseEvent, node: FlowNode, dragged: FlowNode[]) {
    setDragGhosts([])
    if (dragged.length > 1) {
      moveNodes(dragged.map((n) => n.id), groupDelta(node))
      return
    }
    const measured = getInternalNode(node.id)?.measured
    const { w, h } = nodeDims(node.type ?? '', measured?.width, measured?.height)
    const resolved = resolveOverlap(snap(node.position), w, h, measuredNodes(), node.id)
    setPositions(new Map([[node.id, resolved]]))
  }

  // Selection + size bookkeeping. Positions stay owned by the store (drag commits on stop).
  function onNodesChange(changes: NodeChange[]) {
    const sizes: Record<string, { width: number; height: number; ports: string }> = {}
    let selection: Set<string> | null = null
    // React Flow selects on any click inside a card and when a drag starts; only its selection
    // box counts (its rectangle is set before the box's first change). Clicks: onNodeClick.
    const boxSelecting = flowStore.getState().userSelectionRect !== null
    for (const c of changes) {
      if (c.type === 'select' && boxSelecting) {
        selection ??= new Set(useSignalStore.getState().selectedNodeIds)
        if (c.selected) selection.add(c.id)
        else selection.delete(c.id)
      }
      if (c.type === 'dimensions' && c.dimensions) {
        const node = graphNodesRef.current.find((n) => n.id === c.id)
        if (node) {
          recordMeasuredSize(node.typeKey, c.dimensions.width, c.dimensions.height)
          sizes[c.id] = { ...c.dimensions, ports: portLayoutKey(node, graphNodesRef.current, edgesRef.current) }
        }
        if (c.id === pendingInsertRef.current) {
          pendingInsertRef.current = null
          makeRoomForInserted(c.id, c.dimensions)
        }
      }
    }
    if (selection) setSelection([...selection])
    if (Object.keys(sizes).length > 0) setMeasuredSizes((prev) => ({ ...prev, ...sizes }))
  }

  // ── Display models ──────────────────────────────────────────────────────────

  // While wires are pointed at (unplug list, Matrix Bus row), their chains stay lit and the rest dims
  const highlight = useMemo(() => {
    const chains = graphEdges.filter((e) => highlightEdgeIds.includes(e.id)).map((e) => chainOfEdge(e, graphEdges))
    if (chains.length === 0) return null
    return {
      nodeIds: new Set(chains.flatMap((c) => [...c.nodeIds])),
      edgeIds: new Set(chains.flatMap((c) => [...c.edgeIds])),
    }
  }, [highlightEdgeIds, graphEdges])

  // These objects are rebuilt on every store change. Without `measured`, React Flow treats each
  // rebuilt node as new: it hides the card until it is measured again on the next frame, and a
  // click in that gap lands on the pane (a knob drag would pan the canvas instead).
  // A card whose ports changed is left unmeasured on purpose, so React Flow re-reads its ports.
  const displayNodes: FlowNode[] = useMemo(
    () =>
      graphNodes.map((node) => {
        const size = measuredSizes[node.id]
        return {
          id:        node.id,
          type:      node.typeKey,
          position:  node.position,
          measured:  size && size.ports === portLayoutKey(node, graphNodes, graphEdges)
            ? { width: size.width, height: size.height }
            : undefined,
          selected:  selectedNodeIds.includes(node.id),
          className: highlight && !highlight.nodeIds.has(node.id) ? 'lsc-dimmed' : undefined,
          data:      { color: node.color, label: node.label, typeKey: node.typeKey },
        }
      }),
    [graphNodes, graphEdges, selectedNodeIds, highlight, measuredSizes]
  )

  const displayEdges: Edge[] = useMemo(() => {
    const nodesForValidation = graphNodes.map((n) => ({ id: n.id, position: n.position }))

    return graphEdges.map((edge) => {
      const sourceStage = stages[edge.source]
      const key         = `${edge.source}:${edge.sourceHandle}`
      const db          = levelOf(wires.get(key) ?? sourceStage?.out)
      const health      = sourceStage ? getHealth(db, sourceStage.domain) : null
      const color       = health ? healthColor(health) : 'var(--lsc-border)'

      const routingWarning = (edge.waypoints?.length ?? 0) > 0
        ? wirePassesThroughNode(edge.waypoints!, nodesForValidation, [edge.source, edge.target])
        : false

      const data: ChainEdgeData = { waypoints: edge.waypoints, routingWarning, stereo: wires.get(key)?.kind === 'stereo' }
      // A send into a Matrix Bus has its own colour
      const toMatrix = graphNodes.find((n) => n.id === edge.target)?.typeKey === 'matrix-bus'

      return {
        id:           edge.id,
        source:       edge.source,
        sourceHandle: edge.sourceHandle,
        target:       edge.target,
        targetHandle: edge.targetHandle,
        type:         'chain',
        animated:     false,
        style:        {
          stroke: toMatrix ? 'var(--lsc-matrix-send)' : color,
          strokeWidth: overview ? OVERVIEW_WIRE_WIDTH : 3,
          opacity: highlight && !highlight.edgeIds.has(edge.id) ? 0.15 : 1,
          transition: 'opacity 0.15s',
        },
        data,
      }
    })
  }, [graphEdges, stages, wires, graphNodes, highlight, overview])

  // Build live wire preview path
  const wirePath = (() => {
    if (!drawing.active) return null
    const endPos = snapPos ?? drawing.cursorPos
    return buildWirePath([drawing.startPos, ...drawing.waypoints, endPos])
  })()

  const sw   = 2.5 / vpZoom
  const dash = `${6 / vpZoom} ${4 / vpZoom}`
  // A wire drawn from a stereo output previews as a twin line, like the wire it will become
  const previewStereo = drawing.active &&
    wires.get(`${drawing.sourceNodeId}:${drawing.sourceHandleId}`)?.kind === 'stereo'

  /** What opening a chain made at another level does to the level. */
  function levelNote({ chain }: ParsedChain): string {
    if (chain.level === complexityLevel) return ''
    const level = t.levels[chain.level].title
    const up    = LEVELS.indexOf(chain.level) > LEVELS.indexOf(complexityLevel)
    return fmt(up ? t.file.levelAdd : t.file.levelReplace, { level })
  }

  const wireSourceLabel = (() => {
    if (!drawing.active) return ''
    const src = graphNodes.find((n) => n.id === drawing.sourceNodeId)
    return src ? (t.palette.items[src.typeKey] ?? src.typeKey) : ''
  })()

  // "Show everything" fits the elements in the part of the canvas the palette leaves free
  const fitViewOptions = { padding: { top: 0.1, right: 0.1, bottom: 0.1, left: `${paletteWidth + 48}px` } as const, maxZoom: 1, duration: 300 }

  // Zoom control tooltips follow the app language
  const ariaLabelConfig = useMemo(() => ({
    'controls.ariaLabel':         t.toolbar.zoom,
    'controls.zoomIn.ariaLabel':  t.toolbar.zoomIn,
    'controls.zoomOut.ariaLabel': t.toolbar.zoomOut,
    'controls.fitView.ariaLabel': t.toolbar.zoomFit,
  }), [t])

  const ghosts = dropPreview
    ? [{ pos: dropPreview.pos, ...nodeDims(dropPreview.typeKey) }]
    : dragGhosts

  const wrapperClass = [
    'w-full h-full relative',
    toolMode === 'connect' ? 'lsc-connect-mode' : '',
    drawing.active ? 'lsc-wiring' : '',
    leftTool === 'remove' ? 'lsc-remove-mode' : '',
    leftTool === 'select' ? 'lsc-select-mode' : '',
  ].join(' ')
  const canEdit = toolMode === 'select' && leftTool !== 'remove'

  return (
    // `isolation`: everything drawn on the canvas stays under the palette that slides over it
    <div ref={wrapperRef} className={wrapperClass} style={{ isolation: 'isolate' }} onDragLeave={onDragLeave}>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={canEdit}
        nodesConnectable={false}
        elementsSelectable={canEdit}
        // Select tool: dragging empty space draws a selection box (the middle button still pans)
        panOnDrag={toolMode !== 'select' ? false : leftTool === 'select' ? [1] : true}
        selectionOnDrag={canEdit && leftTool === 'select'}
        selectionMode={SelectionMode.Partial}
        deleteKeyCode={null}
        nodeOrigin={[0, 0]}
        fitView={startsFilled}
        fitViewOptions={fitViewOptions}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
        ariaLabelConfig={ariaLabelConfig}
        style={{ background: 'var(--lsc-canvas)' }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodesChange={onNodesChange}
        onNodeContextMenu={(e, node) => {
          // (A right-click while drawing a wire never gets here: it only cancels the wire)
          e.preventDefault()
          // Part of a selection: the menu acts on all of it. Otherwise this element becomes the selection.
          const selected = useSignalStore.getState().selectedNodeIds
          const targets  = selected.includes(node.id) ? selected : [node.id]
          if (!selected.includes(node.id)) setSelectedNode(node.id)
          setNodeMenu({ nodeId: node.id, targets, x: e.clientX, y: e.clientY })
        }}
        onPaneContextMenu={(e) => {
          e.preventDefault()
          setCanvasMenu({ x: e.clientX, y: e.clientY, at: screenToFlowPosition({ x: e.clientX, y: e.clientY }) })
        }}
        onPaneClick={() => {
          if (toolModeRef.current !== 'select' || leftToolRef.current === 'remove') return
          setSelection([])
          setActiveTooltip(null, null)
        }}
      >
        {snapToGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={GRID}
            size={2.4}
            color="var(--lsc-grid)"
          />
        )}
        <Controls
          position="bottom-left"
          className="lsc-left-tools"
          orientation="horizontal"
          showInteractive={false}
          fitViewOptions={fitViewOptions}
        />
        <CanvasTools />
      </ReactFlow>

      {/* Reshape overlay — waypoint drag handles (intermediate/advanced) */}
      {complexityLevel !== 'beginner' && (
        <svg
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
            zIndex: 95,
            overflow: 'visible',
          }}
        >
          <g transform={`translate(${vpX}, ${vpY}) scale(${vpZoom})`}>
            {graphEdges.map((edge) => {
              const wps = edge.waypoints ?? []
              if (wps.length === 0) return null
              return (
                <g key={edge.id}>
                  {/* Segment midpoint handles — for inserting new waypoints */}
                  {wps.slice(0, -1).map((wp, i) => {
                    const next = wps[i + 1]
                    const mx = (wp.x + next.x) / 2
                    const my = (wp.y + next.y) / 2
                    return (
                      <circle
                        key={`mid-${i}`}
                        className="lsc-reshape-handle"
                        data-edgeid={edge.id}
                        data-wpidx={-1}
                        data-segidx={i}
                        data-inserting="true"
                        cx={mx} cy={my}
                        r={4 / vpZoom}
                        fill="var(--lsc-accent)"
                        opacity={0.35}
                        style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                      />
                    )
                  })}
                  {/* Waypoint handles — for moving existing waypoints */}
                  {wps.map((wp, i) => {
                    const isActive  = reshaping?.edgeId === edge.id && !reshaping.inserting && reshaping.waypointIndex === i
                    const displayPt = isActive ? reshaping!.livePos : wp
                    return (
                      <circle
                        key={`wp-${i}`}
                        className="lsc-reshape-handle"
                        data-edgeid={edge.id}
                        data-wpidx={i}
                        data-segidx={-1}
                        data-inserting="false"
                        cx={displayPt.x} cy={displayPt.y}
                        r={5 / vpZoom}
                        fill="var(--lsc-accent)"
                        opacity={0.75}
                        style={{ pointerEvents: 'all', cursor: 'move' }}
                      />
                    )
                  })}
                </g>
              )
            })}
          </g>
        </svg>
      )}

      {/* Live wire preview SVG */}
      {wirePath && (
        <svg
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
            zIndex: 100,
            overflow: 'visible',
          }}
        >
          <g transform={`translate(${vpX}, ${vpY}) scale(${vpZoom})`}>
            <path
              d={wirePath}
              fill="none"
              stroke={wireWarning ? 'var(--signal-hot)' : 'var(--lsc-accent)'}
              strokeWidth={previewStereo ? sw * 2.2 : sw}
              strokeDasharray={dash}
              strokeLinecap="round"
            />
            {previewStereo && (
              <path
                d={wirePath}
                fill="none"
                stroke="var(--lsc-canvas)"
                strokeWidth={sw * 0.8}
                strokeDasharray={dash}
                strokeLinecap="round"
              />
            )}
            {snapPos && (
              <circle
                cx={snapPos.x} cy={snapPos.y}
                r={11 / vpZoom}
                fill="none"
                stroke={wireWarning ? 'var(--signal-hot)' : 'var(--lsc-accent)'}
                strokeWidth={2 / vpZoom}
              />
            )}
            {drawing.active && drawing.waypoints.map((wp, i) => (
              <circle
                key={i}
                cx={wp.x} cy={wp.y}
                r={4 / vpZoom}
                fill="var(--lsc-accent)"
              />
            ))}
          </g>
        </svg>
      )}

      {/* Ghost preview — palette drop and canvas node drag share the same look */}
      {ghosts.length > 0 && (
        <svg
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
            zIndex: 99,
            overflow: 'visible',
          }}
        >
          <g transform={`translate(${vpX}, ${vpY}) scale(${vpZoom})`}>
            {ghosts.map((ghost, i) => (
              <rect
                key={i}
                x={ghost.pos.x}
                y={ghost.pos.y}
                width={ghost.w}
                height={ghost.h}
                rx={12}
                fill="var(--lsc-accent)"
                fillOpacity={0.12}
                stroke="var(--lsc-accent)"
                strokeWidth={1.5 / vpZoom}
                strokeDasharray={`${6 / vpZoom} ${3 / vpZoom}`}
              />
            ))}
          </g>
        </svg>
      )}

      <HelpPopover />
      {nodeMenu && (
        <NodeMenu
          {...nodeMenu}
          onCut={() => cutNodes(nodeMenu.targets)}
          onCopy={() => copyNodes(nodeMenu.targets)}
          onDuplicate={(dir) => duplicateNodes(nodeMenu.targets, dir)}
          onRemove={() => removeSelected(nodeMenu.targets)}
          onClose={() => setNodeMenu(null)}
        />
      )}
      {canvasMenu && (
        <CanvasMenu
          x={canvasMenu.x}
          y={canvasMenu.y}
          canPaste={(clipboard?.nodes.length ?? 0) > 0}
          canSelectAll={graphNodes.length > 0}
          onPaste={() => pasteAt(canvasMenu.at)}
          onSelectAll={() => setSelection(graphNodes.map((n) => n.id))}
          onInsertChain={() => {
            const { at } = canvasMenu
            chainFile.pickChain().then((read) => { if (read) insertChainAt(read, at) })
          }}
          onClose={() => setCanvasMenu(null)}
        />
      )}
      {chainOffer && !chainEmpty && (
        <ConfirmDialog
          title={chainOffer.chain.name ? fmt(t.file.openTitle, { name: chainOffer.chain.name }) : t.file.openTitleUnnamed}
          body={[
            t.file.openBody,
            levelNote(chainOffer),
            chainOffer.skipped > 0 ? fmt(t.file.skipped, { count: String(chainOffer.skipped) }) : '',
          ].filter(Boolean).join(' ')}
          confirmLabel={t.file.replace}
          cancelLabel={t.dialog.cancel}
          onConfirm={() => replaceWithChain(chainOffer)}
          onCancel={() => offerChain(null)}
        >
          {/* Or beside what is there — the arrows Duplicate uses */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{t.file.addBeside}</span>
            <DirectionArrows
              labels={{ left: t.file.addLeft, right: t.file.addRight, up: t.file.addUp, down: t.file.addDown }}
              onPick={(dir) => addChain(chainOffer, (group) => besideOffset(group, dir, placedNodes()), true)}
            />
          </div>
        </ConfirmDialog>
      )}
      {drawing.active && <ConnectingToast sourceLabel={wireSourceLabel} />}
    </div>
  )
}
