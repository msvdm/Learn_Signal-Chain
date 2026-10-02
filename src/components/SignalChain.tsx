import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  type Edge,
  type Node as FlowNode,
  type NodeChange,
  BackgroundVariant,
  useReactFlow,
  useViewport,
  useInternalNode,
  useStore as useFlowStore,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { MicNode }             from './nodes/MicNode'
import { GainNode }            from './nodes/GainNode'
import { FaderNode }           from './nodes/FaderNode'
import { MasterBusNode }       from './nodes/MasterBusNode'
import { MonoBusNode }         from './nodes/MonoBusNode'
import { StereoFaderNode }     from './nodes/StereoFaderNode'
import { BalanceNode }         from './nodes/BalanceNode'
import { AmpNode }             from './nodes/AmpNode'
import { SpeakerNode }         from './nodes/SpeakerNode'
import { ActiveSpeakerNode }   from './nodes/ActiveSpeakerNode'
import { SwitchNode }          from './nodes/SwitchNode'
import { PotentiometerNode }   from './nodes/PotentiometerNode'
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
import { CanvasToolbar, ConnectingToast } from './CanvasToolbar'
import { HelpPopover }         from './Tooltip'
import { EmptyStateGuide, ShortcutsCard } from './EmptyState'

import { useSignalStore }     from '../store/signalStore'
import { useGraphSignal, getHealth } from '../hooks/useSignalChain'
import { getHealthStyle }     from '../hooks/useGainStaging'
import { useEdgeReshape }     from '../hooks/useEdgeReshape'
import { useChainEmpty }      from '../hooks/useChainEmpty'
import { NODE_REGISTRY }      from '../data/nodeRegistry'
import { MASTER_BUS_DEFAULT_ID } from '../data/levels'
import { activeDragTypeKey }  from '../utils/dragState'
import {
  GRID, BUS_TYPES, PORT_TOP,
  nodeDims, recordMeasuredSize, resolveOverlap, snapOutOfCenter,
  pushDownstream, pushUpstream,
  shiftNodesLeft, shiftNodesRight,
  enforceGap, findEdgeAtPoint, canInsertMidChain,
} from '../utils/layoutHelpers'
import type { Pt } from '../utils/layoutHelpers'
import { MASTER_BUS_FLOW_POS, CENTER_LEFT_BOUND, CENTER_RIGHT_BOUND, MIN_NODE_GAP, getZone } from '../data/zoneConstants'
import { buildWirePath } from '../utils/wirePath'
import { wirePassesThroughNode } from '../utils/wireValidation'
import { nodeAcceptsWire, portIsFree } from '../utils/connectionRules'
import { emptyStateLayout } from '../utils/emptyStateLayout'
import { useTranslation } from '../i18n/useTranslation'

// nodeTypes must be defined outside the component to avoid re-registration on every render
const nodeTypes = {
  mic:                MicNode,
  'line-in':          MicNode,
  instrument:         MicNode,
  'di-box':           DIBoxNode,
  gain:               GainNode,
  preamp:             GainNode,
  amp:                AmpNode,
  fader:              FaderNode,
  'noise-gate':       NoiseGateNode,
  limiter:            LimiterNode,
  pad:                PadNode,
  deesser:            DeesserNode,
  'master-bus':       MasterBusNode,
  'mono-bus':         MonoBusNode,
  'stereo-bus':       MasterBusNode,
  'stereo-fader':     StereoFaderNode,
  balance:            BalanceNode,
  'audio-interface':  AudioInterfaceNode,
  hpf:                HpfNode,
  eq:                 EQNode,
  comp:               CompressorNode,
  switch:             SwitchNode,
  potentiometer:      PotentiometerNode,
  relay:              RelayNode,
  pan:                PanNode,
  'graphic-eq':       GraphicEQNode,
  speaker:            SpeakerNode,
  'active-speaker':   ActiveSpeakerNode,
  adc:                AdcDacNode,
  dac:                AdcDacNode,
}

const edgeTypes = { chain: ChainEdge }

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

/** Get flow-coordinate center of a handle DOM element. */
function handleFlowPos(el: HTMLElement, toFlow: (p: Pt) => Pt): Pt {
  const r = el.getBoundingClientRect()
  return toFlow({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
}

/** Signal level as a short badge label: "−18", "+3", "−∞". */
function formatBadgeDb(db: number): string {
  if (!isFinite(db)) return '−∞'
  const r = Math.round(db)
  if (r === 0) return '0'
  return r > 0 ? `+${r}` : `−${Math.abs(r)}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SignalChain() {
  const graphNodes            = useSignalStore((s) => s.nodes)
  const graphEdges            = useSignalStore((s) => s.edges)
  const complexityLevel       = useSignalStore((s) => s.complexityLevel)
  const toolMode              = useSignalStore((s) => s.toolMode)
  const snapToGrid            = useSignalStore((s) => s.snapToGrid)
  const selectedNodeId        = useSignalStore((s) => s.selectedNodeId)
  const setToolMode           = useSignalStore((s) => s.setToolMode)
  const setWireSource         = useSignalStore((s) => s.setWireSource)
  const setSelectedNode       = useSignalStore((s) => s.setSelectedNode)
  const setActiveTooltip      = useSignalStore((s) => s.setActiveTooltip)
  const addNode               = useSignalStore((s) => s.addNode)
  const addEdge               = useSignalStore((s) => s.addEdge)
  const removeEdge            = useSignalStore((s) => s.removeEdge)
  const updateNodePosition    = useSignalStore((s) => s.updateNodePosition)
  const updateEdgeWaypoints   = useSignalStore((s) => s.updateEdgeWaypoints)
  const { stages, portSignal } = useGraphSignal()
  const { t }                 = useTranslation()
  const chainEmpty            = useChainEmpty()
  const { screenToFlowPosition, getNodes, getInternalNode, fitView, setViewport } = useReactFlow()
  const { x: vpX, y: vpY, zoom: vpZoom } = useViewport()
  const paneW = useFlowStore((s) => s.width)
  const paneH = useFlowStore((s) => s.height)

  const [drawing, setDrawing]               = useState<WireDrawing>({ active: false })
  const [snapPos, setSnapPos]               = useState<Pt | null>(null)
  const [wireWarning, setWireWarning]       = useState(false)
  const [dropPreview, setDropPreview]       = useState<{ typeKey: string; pos: Pt } | null>(null)
  const [dragNodePreview, setDragNodePreview] = useState<{ typeKey: string; pos: Pt; w: number; h: number } | null>(null)

  // Mutable refs so document-level handlers always see current state
  const wrapperRef      = useRef<HTMLDivElement>(null)
  const drawingRef      = useRef(drawing)
  drawingRef.current    = drawing
  const toolModeRef     = useRef(toolMode)
  toolModeRef.current   = toolMode
  const edgesRef        = useRef(graphEdges)
  edgesRef.current      = graphEdges
  const graphNodesRef   = useRef(graphNodes)
  graphNodesRef.current = graphNodes

  const { reshaping, setReshaping } = useEdgeReshape(screenToFlowPosition, edgesRef, updateEdgeWaypoints)

  /** React Flow nodes with their real rendered size (cards size themselves to content). */
  function measuredNodes(): FlowNode[] {
    return getNodes().map((n) => ({ ...n, measured: getInternalNode(n.id)?.measured ?? n.measured }))
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

  // Cancel drawing when leaving connect mode
  useEffect(() => {
    if (toolMode !== 'connect') cancelWire()
  }, [toolMode, cancelWire])

  // Keyboard shortcuts: V = Move, C = Connect, Esc = cancel wire / back to Move
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 'v') setToolMode('select')
      if (key === 'c') setToolMode('connect')
      if (e.key === 'Escape') {
        if (drawingRef.current.active) {
          cancelWire()
        } else {
          setToolMode('select')
          setActiveTooltip(null, null)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setToolMode, setActiveTooltip, cancelWire])

  // Live cursor tracking while a wire is being drawn
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = drawingRef.current
      if (!d.active) return
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setDrawing((prev) => (prev.active ? { ...prev, cursorPos: flowPos } : prev))
      const hEl  = handleUnder(e.clientX, e.clientY)
      const snapTo = hEl?.classList.contains('target') ? handleFlowPos(hEl, screenToFlowPosition) : null
      setSnapPos(snapTo)
      const allPts = [d.startPos, ...d.waypoints, snapTo ?? flowPos]
      const nodesForValidation = graphNodesRef.current.map((n) => {
        const m = getInternalNode(n.id)?.measured
        return { id: n.id, position: n.position, width: m?.width, height: m?.height }
      })
      setWireWarning(wirePassesThroughNode(allPts, nodesForValidation, [d.sourceNodeId]))
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [screenToFlowPosition, getInternalNode])

  // Click interception — capture phase fires before React Flow's own handlers
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (toolModeRef.current !== 'connect') return
      if (e.button !== 0) return
      const targetEl = e.target as Element
      // Only clicks on the canvas itself — not the palette, header, toolbar or popovers
      if (!wrapperRef.current?.contains(targetEl)) return
      if (targetEl.closest('.lsc-overlay')) return

      // Check if a reshape handle (waypoint drag circle) is under the cursor
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

      const d       = drawingRef.current
      const hEl     = handleUnder(e.clientX, e.clientY)
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })

      if (!d.active) {
        if (hEl?.classList.contains('source')) {
          e.stopPropagation()
          setDrawing({
            active: true,
            sourceNodeId:   hEl.dataset.nodeid!,
            sourceHandleId: hEl.dataset.handleid!,
            startPos:  handleFlowPos(hEl, screenToFlowPosition),
            waypoints: [],
            cursorPos: flowPos,
          })
        }
        return
      }

      // Wire is being drawn — intercept ALL left-clicks on the canvas
      e.stopPropagation()

      if (hEl?.classList.contains('target')) {
        const targetNodeId   = hEl.dataset.nodeid!
        const targetHandleId = hEl.dataset.handleid!
        const targetNode     = graphNodesRef.current.find((n) => n.id === targetNodeId)
        const source         = { nodeId: d.sourceNodeId, handleId: d.sourceHandleId }

        const allowed = targetNode !== undefined &&
          nodeAcceptsWire(targetNode, source, edgesRef.current) &&
          portIsFree(targetNodeId, targetHandleId, edgesRef.current)

        if (!allowed) {
          if (targetNodeId !== d.sourceNodeId) {
            hEl.classList.add('lsc-handle-rejected')
            setTimeout(() => hEl.classList.remove('lsc-handle-rejected'), 600)
          }
          return
        }

        addEdge({
          id:           `e-${d.sourceNodeId}-${targetNodeId}-${Date.now()}`,
          source:       d.sourceNodeId,
          sourceHandle: d.sourceHandleId,
          target:       targetNodeId,
          targetHandle: targetHandleId,
          waypoints:    d.waypoints.length > 0 ? d.waypoints : undefined,
        })
        enforceGap(d.sourceNodeId, targetNodeId, measuredNodes(), updateNodePosition)
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

    function onContext(e: MouseEvent) {
      if (toolModeRef.current !== 'connect') return
      if (!drawingRef.current.active) return
      e.preventDefault()
      cancelWire()
    }

    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('contextmenu', onContext, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('contextmenu', onContext, true)
    }
  // measuredNodes reads React Flow's live state each call
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenToFlowPosition, addEdge, updateNodePosition, setReshaping])

  // ── Empty state: guide outline + camera ─────────────────────────────────────

  const masterInternal = useInternalNode(MASTER_BUS_DEFAULT_ID)
  const masterRect = masterInternal
    ? {
        x: masterInternal.internals.positionAbsolute.x,
        y: masterInternal.internals.positionAbsolute.y,
        w: masterInternal.measured.width ?? 200,
        h: masterInternal.measured.height ?? 150,
      }
    : null
  const masterMeasured = Boolean(masterInternal?.measured.width)
  const emptyLayout = chainEmpty ? emptyStateLayout(masterRect) : null

  // Frame the outline whenever the canvas becomes empty (start, reset, level change)
  const waitingForMaster = complexityLevel !== 'beginner' && !masterMeasured
  useEffect(() => {
    if (!chainEmpty || waitingForMaster || paneW === 0 || paneH === 0) return
    const master = getInternalNode(MASTER_BUS_DEFAULT_ID)
    const b = emptyStateLayout(master
      ? {
          x: master.internals.positionAbsolute.x, y: master.internals.positionAbsolute.y,
          w: master.measured.width ?? 200, h: master.measured.height ?? 150,
        }
      : null).bounds
    const TOOLBAR = 64   // keep clear of the floating toolbar
    const PAD = 40
    const zoom = Math.max(0.15, Math.min(1, (paneW - PAD * 2) / b.w, (paneH - TOOLBAR - PAD * 2) / b.h))
    setViewport({
      x: paneW / 2 - (b.x + b.w / 2) * zoom,
      y: TOOLBAR + (paneH - TOOLBAR) / 2 - (b.y + b.h / 2) * zoom,
      zoom,
    })
  // Re-frame only when emptiness / level / readiness / pane size change — not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainEmpty, complexityLevel, waitingForMaster, paneW > 0 && paneH > 0])

  // ── Drag & drop from the palette ────────────────────────────────────────────

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const typeKey = activeDragTypeKey
    if (!typeKey) return
    const raw = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const { w } = nodeDims(typeKey)
    let pos = dropOrigin(raw)
    const notBeginner = complexityLevel !== 'beginner'
    if (BUS_TYPES.has(typeKey) && notBeginner) {
      pos.x = Math.max(CENTER_LEFT_BOUND, Math.min(CENTER_RIGHT_BOUND - w, pos.x))
    } else {
      pos = snapOutOfCenter(pos, w, notBeginner)
    }
    setDropPreview({ typeKey, pos })
  }

  function onDragLeave(e: React.DragEvent) {
    const rt = e.relatedTarget as Node | null
    if (rt && (e.currentTarget as Element).contains(rt)) return
    setDropPreview(null)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDropPreview(null)
    const typeKey = e.dataTransfer.getData('application/lsc-node-type')
    if (!typeKey) return
    const def = NODE_REGISTRY[typeKey]
    if (!def) return
    const raw     = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const snapped = dropOrigin(raw)
    const { w, h } = nodeDims(typeKey)
    const newId = `${typeKey}-${Date.now()}`
    const allNodes = measuredNodes()

    // ── Smart edge insertion ───────────────────────────────────────────────────
    // Use graphEdges from Zustand (always in sync, unlike getEdges() which can lag)
    if (canInsertMidChain(typeKey)) {
      const nodePositions = new Map(
        graphNodes.map(n => [n.id, {
          id:       n.id,
          type:     n.typeKey,
          position: n.position,
          measured: allNodes.find(r => r.id === n.id)?.measured,
        }])
      )
      const nmNodes = [...nodePositions.values()] as unknown as FlowNode[]
      const hitEdge = findEdgeAtPoint(raw, graphEdges, nmNodes)

      if (hitEdge) {
        const src = nodePositions.get(hitEdge.source)
        const tgt = nodePositions.get(hitEdge.target)
        if (src && tgt) {
          const srcDims  = nodeDims(src.type, src.measured?.width, src.measured?.height)
          const srcRight = src.position.x + srcDims.w
          const tgtLeft  = tgt.position.x
          // Top-align with the source so the wires on both sides stay straight
          const insertY  = src.position.y

          const dropZone = complexityLevel !== 'beginner' ? getZone(snapped.x) : 'right'

          let insertX: number
          if (dropZone === 'left') {
            const maxInsertX = Math.floor((tgtLeft - w - MIN_NODE_GAP) / GRID) * GRID
            insertX = Math.min(maxInsertX, snapped.x)
          } else if (dropZone === 'center') {
            const available = tgtLeft - srcRight
            if (available < w + MIN_NODE_GAP * 2) return
            insertX = snapped.x
          } else {
            const minInsertX = Math.round((srcRight + MIN_NODE_GAP) / GRID) * GRID
            insertX = Math.max(minInsertX, snapped.x)
          }

          const newNodeRight = insertX + w
          const rightGap     = tgtLeft - newNodeRight
          const nm           = new Map(nmNodes.map((n) => [n.id, n]))

          if (dropZone === 'left') {
            const leftGap = insertX - srcRight
            if (leftGap < MIN_NODE_GAP) {
              pushUpstream(srcRight, MIN_NODE_GAP - leftGap, nmNodes, nm, updateNodePosition, newId)
            }
          } else if (dropZone !== 'center') {
            if (rightGap < MIN_NODE_GAP) {
              pushDownstream(tgtLeft, MIN_NODE_GAP - rightGap, nmNodes, nm, updateNodePosition)
            }
          }

          addNode({ id: newId, typeKey, position: { x: insertX, y: insertY }, params: { ...def.defaultParams }, bypassed: false })
          removeEdge(hitEdge.id)
          const ts = Date.now()
          addEdge({ id: `e-${hitEdge.source}-${newId}-${ts}`,     source: hitEdge.source, sourceHandle: hitEdge.sourceHandle, target: newId,          targetHandle: def.inputs[0].id  })
          addEdge({ id: `e-${newId}-${hitEdge.target}-${ts + 1}`, source: newId,          sourceHandle: def.outputs[0].id,   target: hitEdge.target, targetHandle: hitEdge.targetHandle })
          setTimeout(() => fitView({ padding: 0.25, duration: 400, maxZoom: 1 }), 50)
          return
        }
      }
    }

    // ── Normal placement (no edge hit) ────────────────────────────────────────
    const notBeginner = complexityLevel !== 'beginner'
    if (BUS_TYPES.has(typeKey) && notBeginner) {
      const clampedX = Math.max(CENTER_LEFT_BOUND, Math.min(CENTER_RIGHT_BOUND - w, snapped.x))
      const finalPos = resolveOverlap({ x: clampedX, y: snapped.y }, w, h, allNodes)
      addNode({ id: newId, typeKey, position: finalPos, params: { ...def.defaultParams }, bypassed: false })
    } else if (notBeginner) {
      const finalPos = snapOutOfCenter(snapped, w, true)
      if (getZone(finalPos.x) === 'left') {
        shiftNodesLeft(finalPos.x, allNodes, updateNodePosition)
      } else {
        shiftNodesRight(finalPos.x, w, allNodes, updateNodePosition)
      }
      addNode({ id: newId, typeKey, position: finalPos, params: { ...def.defaultParams }, bypassed: false })
    } else {
      const finalPos = resolveOverlap(snapped, w, h, allNodes)
      addNode({ id: newId, typeKey, position: finalPos, params: { ...def.defaultParams }, bypassed: false })
    }
  }

  // ── Moving nodes ────────────────────────────────────────────────────────────

  function onNodeDrag(_e: React.MouseEvent, node: FlowNode) {
    const measured = getInternalNode(node.id)?.measured
    const { w, h } = nodeDims(node.type ?? '', measured?.width, measured?.height)
    let snapped = snap(node.position)
    if (!BUS_TYPES.has(node.type ?? '')) {
      snapped = snapOutOfCenter(snapped, w, complexityLevel !== 'beginner')
    }
    const resolved = resolveOverlap(snapped, w, h, measuredNodes(), node.id)
    setDragNodePreview({ typeKey: node.type ?? '', pos: resolved, w, h })
  }

  function onNodeDragStop(_e: React.MouseEvent, node: FlowNode) {
    setDragNodePreview(null)
    if (node.type === 'master-bus' && complexityLevel !== 'beginner') {
      updateNodePosition(node.id, MASTER_BUS_FLOW_POS)
      return
    }
    let snapped = snap(node.position)
    const measured = getInternalNode(node.id)?.measured
    const { w, h } = nodeDims(node.type ?? '', measured?.width, measured?.height)
    const notBeginner = complexityLevel !== 'beginner'
    if (BUS_TYPES.has(node.type ?? '') && node.type !== 'master-bus' && notBeginner) {
      // Center-zone buses move vertically only — restore original X
      snapped.x = graphNodes.find((n) => n.id === node.id)?.position.x ?? snapped.x
    } else if (!BUS_TYPES.has(node.type ?? '')) {
      snapped = snapOutOfCenter(snapped, w, notBeginner)
    }
    const resolved = resolveOverlap(snapped, w, h, measuredNodes(), node.id)
    updateNodePosition(node.id, resolved)
  }

  // Selection + size bookkeeping. Positions stay owned by the store (drag commits on stop).
  function onNodesChange(changes: NodeChange[]) {
    for (const c of changes) {
      if (c.type === 'select') {
        if (c.selected) setSelectedNode(c.id)
        else if (useSignalStore.getState().selectedNodeId === c.id) setSelectedNode(null)
      }
      if (c.type === 'dimensions' && c.dimensions) {
        const typeKey = graphNodesRef.current.find((n) => n.id === c.id)?.typeKey
        if (typeKey) recordMeasuredSize(typeKey, c.dimensions.width, c.dimensions.height)
      }
    }
  }

  // ── Display models ──────────────────────────────────────────────────────────

  const displayNodes: FlowNode[] = useMemo(
    () =>
      graphNodes.map((node) => ({
        id:        node.id,
        type:      node.typeKey,
        position:  node.position,
        selected:  node.id === selectedNodeId,
        draggable: !(node.typeKey === 'master-bus' && complexityLevel !== 'beginner'),
        data:      { color: node.color, label: node.label, typeKey: node.typeKey },
      })),
    [graphNodes, complexityLevel, selectedNodeId]
  )

  const displayEdges: Edge[] = useMemo(() => {
    const nodesForValidation = graphNodes.map((n) => ({ id: n.id, position: n.position }))

    return graphEdges.map((edge) => {
      const sourceStage = stages[edge.source]
      const db          = portSignal.get(`${edge.source}:${edge.sourceHandle}`) ?? sourceStage?.out ?? -Infinity
      const health      = sourceStage ? getHealth(db) : null
      const style       = health ? getHealthStyle(health) : null

      const routingWarning = (edge.waypoints?.length ?? 0) > 0
        ? wirePassesThroughNode(edge.waypoints!, nodesForValidation, [edge.source, edge.target])
        : false

      const data: ChainEdgeData = {
        waypoints:   edge.waypoints,
        routingWarning,
        dbLabel:     formatBadgeDb(db),
        badgeBorder: style?.border,
      }

      return {
        id:           edge.id,
        source:       edge.source,
        sourceHandle: edge.sourceHandle,
        target:       edge.target,
        targetHandle: edge.targetHandle,
        type:         'chain',
        animated:     false,
        style:        { stroke: style?.color ?? 'var(--lsc-border)', strokeWidth: 3 },
        data,
      }
    })
  }, [graphEdges, stages, portSignal, graphNodes])

  // Build live wire preview path
  const wirePath = (() => {
    if (!drawing.active) return null
    const endPos = snapPos ?? drawing.cursorPos
    return buildWirePath([drawing.startPos, ...drawing.waypoints, endPos])
  })()

  const sw   = 2.5 / vpZoom
  const dash = `${6 / vpZoom} ${4 / vpZoom}`

  const wireSourceLabel = (() => {
    if (!drawing.active) return ''
    const src = graphNodes.find((n) => n.id === drawing.sourceNodeId)
    return src ? (t.palette.items[src.typeKey] ?? src.typeKey) : ''
  })()

  const ghost = dropPreview
    ? { pos: dropPreview.pos, ...nodeDims(dropPreview.typeKey) }
    : dragNodePreview

  const wrapperClass = [
    'w-full h-full relative',
    toolMode === 'connect' ? 'lsc-connect-mode' : '',
    drawing.active ? 'lsc-wiring' : '',
  ].join(' ')

  return (
    <div ref={wrapperRef} className={wrapperClass} onDragLeave={onDragLeave}>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={toolMode === 'select'}
        nodesConnectable={false}
        elementsSelectable={toolMode === 'select'}
        panOnDrag={toolMode === 'select'}
        nodeOrigin={[0, 0]}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
        style={{ background: 'var(--lsc-canvas)' }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodesChange={onNodesChange}
        onPaneClick={() => {
          if (toolModeRef.current !== 'select') return
          setSelectedNode(null)
          setActiveTooltip(null, null)
        }}
        onEdgesDelete={(eds) => eds.forEach((e) => removeEdge(e.id))}
      >
        {snapToGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={GRID}
            size={2.4}
            color="var(--lsc-grid)"
          />
        )}
        {emptyLayout && <EmptyStateGuide layout={emptyLayout} />}
      </ReactFlow>

      {/* Zone dividers — visible in intermediate/advanced modes */}
      {complexityLevel !== 'beginner' && (
        <svg
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
            zIndex: 50,
            overflow: 'visible',
          }}
        >
          <g transform={`translate(${vpX}, ${vpY}) scale(${vpZoom})`}>
            <line
              x1={CENTER_LEFT_BOUND}  y1={-10000} x2={CENTER_LEFT_BOUND}  y2={10000}
              stroke="var(--lsc-border)" strokeWidth={1 / vpZoom} strokeDasharray={`${6 / vpZoom} ${6 / vpZoom}`}
            />
            <line
              x1={CENTER_RIGHT_BOUND} y1={-10000} x2={CENTER_RIGHT_BOUND} y2={10000}
              stroke="var(--lsc-border)" strokeWidth={1 / vpZoom} strokeDasharray={`${6 / vpZoom} ${6 / vpZoom}`}
            />
          </g>
        </svg>
      )}

      {/* Reshape overlay — waypoint drag handles (connect mode, intermediate/advanced) */}
      {toolMode === 'connect' && complexityLevel !== 'beginner' && (
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
              strokeWidth={sw}
              strokeDasharray={dash}
              strokeLinecap="round"
            />
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
      {ghost && (
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
            <rect
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
          </g>
        </svg>
      )}

      <CanvasToolbar />
      <HelpPopover />
      {drawing.active && <ConnectingToast sourceLabel={wireSourceLabel} />}
      {chainEmpty && !drawing.active && <ShortcutsCard />}
    </div>
  )
}
