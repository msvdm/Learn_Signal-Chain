import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Edge,
  type Node as FlowNode,
  type NodeChange,
  BackgroundVariant,
  useReactFlow,
  useViewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { MicNode }             from './nodes/MicNode'
import { GainNode }            from './nodes/GainNode'
import { FaderNode }           from './nodes/FaderNode'
import { MasterBusNode }       from './nodes/MasterBusNode'
import { MatrixNode }          from './nodes/MatrixNode'
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
import { ConnectingToast }     from './ConnectingToast'
import { HelpPopover }         from './Tooltip'

import { useSignalStore }     from '../store/signalStore'
import { useGraphSignal, getHealth } from '../hooks/useSignalChain'
import { getHealthStyle }     from '../hooks/useGainStaging'
import { useEdgeReshape }     from '../hooks/useEdgeReshape'
import { useLatestRef }       from '../hooks/useLatestRef'
import { useChainEmpty }      from '../hooks/useChainEmpty'
import { NODE_REGISTRY, getPorts } from '../data/nodeRegistry'
import type { SignalNode, SignalEdge } from '../data/nodeRegistry'
import { activeDragTypeKey }  from '../utils/dragState'
import {
  GRID, MIN_NODE_GAP, PORT_TOP,
  nodeDims, recordMeasuredSize, resolveOverlap,
  pushDownstream, enforceGap, findEdgeAtPoint, canInsertMidChain,
} from '../utils/layoutHelpers'
import type { Pt } from '../utils/layoutHelpers'
import { buildWirePath } from '../utils/wirePath'
import { wirePassesThroughNode } from '../utils/wireValidation'
import { chainOfEdge } from '../utils/chainColors'
import { nodeAcceptsWire, portAcceptsWire } from '../utils/connectionRules'
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
  'aux-bus':          MasterBusNode,
  matrix:             MatrixNode,
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
  const selectedNodeId        = useSignalStore((s) => s.selectedNodeId)
  const setToolMode           = useSignalStore((s) => s.setToolMode)
  const setWireSource         = useSignalStore((s) => s.setWireSource)
  const setSelectedNode       = useSignalStore((s) => s.setSelectedNode)
  const setActiveTooltip      = useSignalStore((s) => s.setActiveTooltip)
  const addNode               = useSignalStore((s) => s.addNode)
  const addEdge               = useSignalStore((s) => s.addEdge)
  const removeEdge            = useSignalStore((s) => s.removeEdge)
  const replaceEdge           = useSignalStore((s) => s.replaceEdge)
  const highlightEdgeId       = useSignalStore((s) => s.highlightEdgeId)
  const updateNodePosition    = useSignalStore((s) => s.updateNodePosition)
  const updateEdgeWaypoints   = useSignalStore((s) => s.updateEdgeWaypoints)
  const { stages, portSignal, wires } = useGraphSignal()
  const { t }                 = useTranslation()
  const chainEmpty            = useChainEmpty()
  const { screenToFlowPosition, getNodes, getInternalNode, fitView, setViewport } = useReactFlow()
  const { x: vpX, y: vpY, zoom: vpZoom } = useViewport()

  const [drawing, setDrawing]               = useState<WireDrawing>({ active: false })
  const [snapPos, setSnapPos]               = useState<Pt | null>(null)
  const [wireWarning, setWireWarning]       = useState(false)
  const [dropPreview, setDropPreview]       = useState<{ typeKey: string; pos: Pt } | null>(null)
  const [dragNodePreview, setDragNodePreview] = useState<{ typeKey: string; pos: Pt; w: number; h: number } | null>(null)
  // React Flow's measured card sizes, handed back with the nodes (see displayNodes)
  const [measuredSizes, setMeasuredSizes]   = useState<Record<string, { width: number; height: number; ports: string }>>({})

  // Mutable refs so document-level handlers always see current state
  const wrapperRef      = useRef<HTMLDivElement>(null)
  const drawingRef      = useLatestRef(drawing)
  const toolModeRef     = useLatestRef(toolMode)
  const edgesRef        = useLatestRef(graphEdges)
  const graphNodesRef   = useLatestRef(graphNodes)
  const revertTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set when a press on a port was used for wiring — the click that follows it is swallowed
  const swallowClickRef = useRef(false)

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
      if (drawingRef.current.active) cancelWire()
      else setActiveTooltip(null, null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setActiveTooltip, cancelWire, drawingRef])

  // The canvas follows the mouse: hovering a port switches to connect mode, moving
  // away switches back to select mode after a short delay (never while a wire is drawn).
  // While a wire is drawn, the cursor is tracked for the live preview instead.
  useEffect(() => {
    function followMouse(e: MouseEvent) {
      // A button is held: a node, slider or the canvas is being dragged — don't switch mid-drag
      if (e.buttons !== 0) return
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
  }, [screenToFlowPosition, getInternalNode, setToolMode, drawingRef, toolModeRef, graphNodesRef])

  // Click interception — capture phase fires before React Flow's own handlers
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (e.button !== 0) return
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
          nodeAcceptsWire(targetNode, source, edgesRef.current) &&
          portAcceptsWire(targetNode, targetHandleId, edgesRef.current, source)

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
        enforceGap(d.sourceNodeId, targetNodeId, measuredNodes(), edgesRef.current, updateNodePosition)
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
      cancelWire()
    }

    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('contextmenu', onContext, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('contextmenu', onContext, true)
    }
  // measuredNodes reads React Flow's live state each call
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenToFlowPosition, addEdge, updateNodePosition, setReshaping])

  // ── Camera ──────────────────────────────────────────────────────────────────

  // A blank canvas (start, Reset, level change, last node removed) shows 100% zoom
  useEffect(() => {
    if (chainEmpty) setViewport({ x: 0, y: 0, zoom: 1 })
  }, [chainEmpty, setViewport])

  // ── Drag & drop from the palette ────────────────────────────────────────────

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const typeKey = activeDragTypeKey
    if (!typeKey) return
    const raw = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setDropPreview({ typeKey, pos: dropOrigin(raw) })
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

          // Right of the source; the target and everything after it move right to make room
          const minInsertX = Math.round((srcRight + MIN_NODE_GAP) / GRID) * GRID
          const insertX    = Math.max(minInsertX, snapped.x)
          const rightGap   = tgtLeft - (insertX + w)
          if (rightGap < MIN_NODE_GAP) {
            const nm = new Map(nmNodes.map((n) => [n.id, n]))
            pushDownstream(tgtLeft, MIN_NODE_GAP - rightGap, nmNodes, nm, updateNodePosition)
          }

          addNode({ id: newId, typeKey, position: { x: insertX, y: insertY }, params: { ...def.defaultParams }, bypassed: false })
          const ts = Date.now()
          const ports = getPorts({ typeKey, params: def.defaultParams })
          // One step: a Fader dropped on a bus's L / R wire becomes the Main Fader, and a card
          // dropped on a Mix wire sits between the bus and its Main Fader without unplugging it
          replaceEdge(hitEdge.id, [
            { id: `e-${hitEdge.source}-${newId}-${ts}`,     source: hitEdge.source, sourceHandle: hitEdge.sourceHandle, target: newId,          targetHandle: ports.inputs[0].id  },
            { id: `e-${newId}-${hitEdge.target}-${ts + 1}`, source: newId,          sourceHandle: ports.outputs[0].id,   target: hitEdge.target, targetHandle: hitEdge.targetHandle },
          ])
          setTimeout(() => fitView({ padding: 0.25, duration: 400, maxZoom: 1 }), 50)
          return
        }
      }
    }

    // ── Normal placement (no edge hit) ────────────────────────────────────────
    const finalPos = resolveOverlap(snapped, w, h, allNodes)
    addNode({ id: newId, typeKey, position: finalPos, params: { ...def.defaultParams }, bypassed: false })
  }

  // ── Moving nodes ────────────────────────────────────────────────────────────

  function onNodeDrag(_e: React.MouseEvent, node: FlowNode) {
    const measured = getInternalNode(node.id)?.measured
    const { w, h } = nodeDims(node.type ?? '', measured?.width, measured?.height)
    const resolved = resolveOverlap(snap(node.position), w, h, measuredNodes(), node.id)
    setDragNodePreview({ typeKey: node.type ?? '', pos: resolved, w, h })
  }

  function onNodeDragStop(_e: React.MouseEvent, node: FlowNode) {
    setDragNodePreview(null)
    const measured = getInternalNode(node.id)?.measured
    const { w, h } = nodeDims(node.type ?? '', measured?.width, measured?.height)
    const resolved = resolveOverlap(snap(node.position), w, h, measuredNodes(), node.id)
    updateNodePosition(node.id, resolved)
  }

  // Selection + size bookkeeping. Positions stay owned by the store (drag commits on stop).
  function onNodesChange(changes: NodeChange[]) {
    const sizes: Record<string, { width: number; height: number; ports: string }> = {}
    for (const c of changes) {
      if (c.type === 'select') {
        if (c.selected) setSelectedNode(c.id)
        else if (useSignalStore.getState().selectedNodeId === c.id) setSelectedNode(null)
      }
      if (c.type === 'dimensions' && c.dimensions) {
        const node = graphNodesRef.current.find((n) => n.id === c.id)
        if (node) {
          recordMeasuredSize(node.typeKey, c.dimensions.width, c.dimensions.height)
          sizes[c.id] = { ...c.dimensions, ports: portLayoutKey(node, graphNodesRef.current, edgesRef.current) }
        }
      }
    }
    if (Object.keys(sizes).length > 0) setMeasuredSizes((prev) => ({ ...prev, ...sizes }))
  }

  // ── Display models ──────────────────────────────────────────────────────────

  // While a wire is pointed at in the unplug list, its chain stays lit and the rest dims
  const highlight = useMemo(() => {
    const edge = highlightEdgeId ? graphEdges.find((e) => e.id === highlightEdgeId) : undefined
    return edge ? chainOfEdge(edge, graphEdges) : null
  }, [highlightEdgeId, graphEdges])

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
          selected:  node.id === selectedNodeId,
          className: highlight && !highlight.nodeIds.has(node.id) ? 'lsc-dimmed' : undefined,
          data:      { color: node.color, label: node.label, typeKey: node.typeKey },
        }
      }),
    [graphNodes, graphEdges, selectedNodeId, highlight, measuredSizes]
  )

  const displayEdges: Edge[] = useMemo(() => {
    const nodesForValidation = graphNodes.map((n) => ({ id: n.id, position: n.position }))

    return graphEdges.map((edge) => {
      const sourceStage = stages[edge.source]
      const key         = `${edge.source}:${edge.sourceHandle}`
      const db          = portSignal.get(key) ?? sourceStage?.out ?? -Infinity
      const health      = sourceStage ? getHealth(db) : null
      const style       = health ? getHealthStyle(health) : null

      const routingWarning = (edge.waypoints?.length ?? 0) > 0
        ? wirePassesThroughNode(edge.waypoints!, nodesForValidation, [edge.source, edge.target])
        : false

      const data: ChainEdgeData = { waypoints: edge.waypoints, routingWarning, stereo: wires.get(key)?.kind === 'stereo' }

      return {
        id:           edge.id,
        source:       edge.source,
        sourceHandle: edge.sourceHandle,
        target:       edge.target,
        targetHandle: edge.targetHandle,
        type:         'chain',
        animated:     false,
        style:        {
          stroke: style?.color ?? 'var(--lsc-border)', strokeWidth: 3,
          opacity: highlight && !highlight.edgeIds.has(edge.id) ? 0.15 : 1,
          transition: 'opacity 0.15s',
        },
        data,
      }
    })
  }, [graphEdges, stages, portSignal, wires, graphNodes, highlight])

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

  const wireSourceLabel = (() => {
    if (!drawing.active) return ''
    const src = graphNodes.find((n) => n.id === drawing.sourceNodeId)
    return src ? (t.palette.items[src.typeKey] ?? src.typeKey) : ''
  })()

  // Zoom control tooltips follow the app language
  const ariaLabelConfig = useMemo(() => ({
    'controls.ariaLabel':         t.toolbar.zoom,
    'controls.zoomIn.ariaLabel':  t.toolbar.zoomIn,
    'controls.zoomOut.ariaLabel': t.toolbar.zoomOut,
    'controls.fitView.ariaLabel': t.toolbar.zoomFit,
  }), [t])

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
        ariaLabelConfig={ariaLabelConfig}
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
        <Controls
          position="bottom-left"
          showInteractive={false}
          fitViewOptions={{ padding: 0.2, maxZoom: 1, duration: 300 }}
        />
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

      <HelpPopover />
      {drawing.active && <ConnectingToast sourceLabel={wireSourceLabel} />}
    </div>
  )
}
