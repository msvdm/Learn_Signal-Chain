import { useMemo, useState, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  type Edge,
  type Node as FlowNode,
  BackgroundVariant,
  MarkerType,
  useReactFlow,
  useViewport,
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
import { DeesserNode }         from './nodes/DeesserNode'
import { RelayNode }           from './nodes/RelayNode'
import { PanNode }             from './nodes/PanNode'
import { AudioInterfaceNode }  from './nodes/AudioInterfaceNode'
import { AdcDacNode }          from './nodes/AdcDacNode'
import { ChainEdge }           from './ChainEdge'

import { useSignalStore }     from '../store/signalStore'
import { useGraphSignal }     from '../hooks/useSignalChain'
import { getHealthStyle }     from '../hooks/useGainStaging'
import { useEdgeReshape }     from '../hooks/useEdgeReshape'
import { NODE_REGISTRY }      from '../data/nodeRegistry'
import { activeDragTypeKey }  from '../utils/dragState'
import {
  GRID, INLINE_TYPE_KEYS, BUS_TYPES,
  nodeDims, resolveOverlap, snapOutOfCenter,
  pushDownstream, pushUpstream,
  shiftNodesLeft, shiftNodesRight,
  enforceGap, findEdgeAtPoint, canInsertMidChain,
} from '../utils/layoutHelpers'
import type { Pt } from '../utils/layoutHelpers'
import { MASTER_BUS_FLOW_POS, CENTER_LEFT_BOUND, CENTER_RIGHT_BOUND, MIN_NODE_GAP, getZone } from '../data/zoneConstants'
import { buildWirePath } from '../utils/wirePath'
import { wirePassesThroughNode } from '../utils/wireValidation'

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

// Input limits per node type — enforced at connection time
const INPUT_LIMITS: Record<string, number> = {
  gain: 1, hpf: 1, eq: 1, comp: 1, fader: 1, switch: 1, amp: 1,
  'di-box': 1, 'noise-gate': 1, limiter: 1, deesser: 1, potentiometer: 1,
  pan: 1, adc: 1, dac: 1, 'graphic-eq': 1, speaker: 1, 'active-speaker': 1,
  'stereo-fader': 2, balance: 2,
}

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

/** Find the react-flow handle element at a screen point, optionally ignoring one element. */
function handleUnder(clientX: number, clientY: number, skip?: Element | null): HTMLElement | null {
  if (skip) {
    const prev = (skip as HTMLElement).style.pointerEvents
    ;(skip as HTMLElement).style.pointerEvents = 'none'
    const els = document.elementsFromPoint(clientX, clientY)
    ;(skip as HTMLElement).style.pointerEvents = prev
    return (els.find((el) => el.classList.contains('react-flow__handle')) as HTMLElement) ?? null
  }
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

// ── Component ─────────────────────────────────────────────────────────────────

export function SignalChain() {
  const graphNodes            = useSignalStore((s) => s.nodes)
  const graphEdges            = useSignalStore((s) => s.edges)
  const complexityLevel       = useSignalStore((s) => s.complexityLevel)
  const toolMode              = useSignalStore((s) => s.toolMode)
  const setToolMode           = useSignalStore((s) => s.setToolMode)
  const addNode               = useSignalStore((s) => s.addNode)
  const addEdge               = useSignalStore((s) => s.addEdge)
  const removeEdge            = useSignalStore((s) => s.removeEdge)
  const updateNodePosition    = useSignalStore((s) => s.updateNodePosition)
  const updateEdgeWaypoints   = useSignalStore((s) => s.updateEdgeWaypoints)
  const { stages }            = useGraphSignal()
  const { screenToFlowPosition, getNodes, fitView } = useReactFlow()
  const { x: vpX, y: vpY, zoom: vpZoom } = useViewport()

  const [drawing, setDrawing]               = useState<WireDrawing>({ active: false })
  const [snapPos, setSnapPos]               = useState<Pt | null>(null)
  const [wireWarning, setWireWarning]       = useState(false)
  const [dropPreview, setDropPreview]       = useState<{ typeKey: string; pos: Pt } | null>(null)
  const [dragNodePreview, setDragNodePreview] = useState<{ typeKey: string; pos: Pt } | null>(null)

  // Mutable refs so document-level handlers always see current state
  const drawingRef      = useRef(drawing)
  drawingRef.current    = drawing
  const toolModeRef     = useRef(toolMode)
  toolModeRef.current   = toolMode
  const edgesRef        = useRef(graphEdges)
  edgesRef.current      = graphEdges
  const graphNodesRef   = useRef(graphNodes)
  graphNodesRef.current = graphNodes
  const revertTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { reshaping, setReshaping } = useEdgeReshape(screenToFlowPosition, edgesRef, updateEdgeWaypoints)

  // Cancel drawing when leaving connect mode; clear auto-revert timer
  useEffect(() => {
    if (toolMode !== 'connect') {
      setDrawing({ active: false })
      setSnapPos(null)
      if (revertTimerRef.current) { clearTimeout(revertTimerRef.current); revertTimerRef.current = null }
    }
  }, [toolMode])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 's' || e.key === 'S') setToolMode('select')
      if (e.key === 'c' || e.key === 'C' || e.key === 'l' || e.key === 'L') setToolMode('connect')
      if (e.key === 'Escape') {
        if (drawingRef.current.active) {
          setDrawing({ active: false })
          setSnapPos(null)
        } else {
          setToolMode('select')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setToolMode])

  // Live cursor tracking + auto mode switching based on handle proximity
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = drawingRef.current

      if (d.active) {
        const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        setDrawing((prev) => (prev.active ? { ...prev, cursorPos: flowPos } : prev))
        const hEl = handleUnder(e.clientX, e.clientY)
        if (hEl?.classList.contains('target')) {
          setSnapPos(handleFlowPos(hEl, screenToFlowPosition))
        } else {
          setSnapPos(null)
        }
        const endPos = snapPos ?? flowPos
        const allPts = [d.startPos, ...d.waypoints, endPos]
        const nodesForValidation = graphNodesRef.current.map((n) => ({ id: n.id, position: n.position }))
        setWireWarning(wirePassesThroughNode(allPts, nodesForValidation, [d.sourceNodeId]))
        return
      }

      // Auto-switch connect/select based on handle proximity
      const hEl = handleUnder(e.clientX, e.clientY)
      if (hEl) {
        if (revertTimerRef.current) { clearTimeout(revertTimerRef.current); revertTimerRef.current = null }
        if (toolModeRef.current === 'select') setToolMode('connect')
      } else if (toolModeRef.current === 'connect') {
        if (!revertTimerRef.current) {
          revertTimerRef.current = setTimeout(() => {
            revertTimerRef.current = null
            if (!drawingRef.current.active) setToolMode('select')
          }, 200)
        }
      }
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [screenToFlowPosition, setToolMode])

  // Click interception — capture phase fires before React Flow's own handlers
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (toolModeRef.current !== 'connect') return
      if (e.button !== 0) return

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

      // Wire is being drawn — intercept ALL left-clicks
      e.stopPropagation()

      if (hEl?.classList.contains('target')) {
        const targetNodeId   = hEl.dataset.nodeid!
        const targetHandleId = hEl.dataset.handleid!
        const isDup = edgesRef.current.some(
          (edge) =>
            edge.source       === d.sourceNodeId   &&
            edge.sourceHandle === d.sourceHandleId &&
            edge.target       === targetNodeId      &&
            edge.targetHandle === targetHandleId
        )

        if (!isDup && d.sourceNodeId !== targetNodeId) {
          const targetTypeKey  = graphNodesRef.current.find((n) => n.id === targetNodeId)?.typeKey
          const limit          = targetTypeKey ? INPUT_LIMITS[targetTypeKey] : undefined
          const existingInputs = edgesRef.current.filter((e) => e.target === targetNodeId).length

          if (limit !== undefined && existingInputs >= limit) {
            hEl.classList.add('lsc-handle-rejected')
            setTimeout(() => hEl.classList.remove('lsc-handle-rejected'), 600)
            setDrawing({ active: false })
            setSnapPos(null)
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
          enforceGap(d.sourceNodeId, targetNodeId, getNodes(), updateNodePosition)
        }
        setDrawing({ active: false })
        setSnapPos(null)
        setWireWarning(false)
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
      setDrawing({ active: false })
      setSnapPos(null)
    }

    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('contextmenu', onContext, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('contextmenu', onContext, true)
    }
  }, [screenToFlowPosition, addEdge, getNodes, updateNodePosition, setReshaping])

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const typeKey = activeDragTypeKey
    if (!typeKey) return
    const raw = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const { w } = nodeDims(typeKey)
    let pos = {
      x: Math.round(raw.x / GRID) * GRID,
      y: Math.round(raw.y / GRID) * GRID,
    }
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
    const raw = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const snapped = {
      x: Math.round(raw.x / GRID) * GRID,
      y: Math.round(raw.y / GRID) * GRID,
    }
    const { w, h } = nodeDims(typeKey)
    const newId = `${typeKey}-${Date.now()}`

    // ── Smart edge insertion ───────────────────────────────────────────────────
    // Use graphEdges from Zustand (always in sync, unlike getEdges() which can lag)
    if (canInsertMidChain(typeKey)) {
      const allNodes      = getNodes()
      const nodePositions = new Map(
        graphNodes.map(n => [n.id, {
          id:       n.id,
          type:     n.typeKey,
          position: n.position,
          measured: allNodes.find(r => r.id === n.id)?.measured,
        }])
      )
      const hitEdge = findEdgeAtPoint(snapped, graphEdges, [...nodePositions.values()] as unknown as FlowNode[])

      if (hitEdge) {
        const src = nodePositions.get(hitEdge.source)
        const tgt = nodePositions.get(hitEdge.target)
        if (src && tgt) {
          const srcDims  = nodeDims(src.type, (src as any).measured?.width, (src as any).measured?.height)
          const srcRight = src.position.x + srcDims.w
          const tgtLeft  = tgt.position.x
          const insertY  = Math.round(snapped.y / GRID) * GRID

          const dropZone = complexityLevel !== 'beginner'
            ? getZone(Math.round(snapped.x / GRID) * GRID)
            : 'right'

          let insertX: number
          if (dropZone === 'left') {
            const maxInsertX = Math.floor((tgtLeft - w - MIN_NODE_GAP) / GRID) * GRID
            insertX = Math.min(maxInsertX, Math.round(snapped.x / GRID) * GRID)
          } else if (dropZone === 'center') {
            const available = tgtLeft - srcRight
            if (available < w + MIN_NODE_GAP * 2) return
            insertX = Math.round(snapped.x / GRID) * GRID
          } else {
            const minInsertX = Math.round((srcRight + MIN_NODE_GAP) / GRID) * GRID
            insertX = Math.max(minInsertX, Math.round(snapped.x / GRID) * GRID)
          }

          const newNodeRight = insertX + w
          const rightGap     = tgtLeft - newNodeRight
          const nmNodes      = [...nodePositions.values()] as unknown as FlowNode[]
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
          setTimeout(() => fitView({ padding: 0.25, duration: 400 }), 50)
          return
        }
      }
    }

    // ── Normal placement (no edge hit) ────────────────────────────────────────
    const notBeginner = complexityLevel !== 'beginner'
    if (BUS_TYPES.has(typeKey) && notBeginner) {
      const clampedX = Math.max(CENTER_LEFT_BOUND, Math.min(CENTER_RIGHT_BOUND - w, snapped.x))
      const finalPos = resolveOverlap({ x: clampedX, y: snapped.y }, w, h, getNodes())
      addNode({ id: newId, typeKey, position: finalPos, params: { ...def.defaultParams }, bypassed: false })
    } else if (notBeginner) {
      const finalPos = snapOutOfCenter(snapped, w, true)
      const allNodes = getNodes()
      if (getZone(finalPos.x) === 'left') {
        shiftNodesLeft(finalPos.x, allNodes, updateNodePosition)
      } else {
        shiftNodesRight(finalPos.x, w, allNodes, updateNodePosition)
      }
      addNode({ id: newId, typeKey, position: finalPos, params: { ...def.defaultParams }, bypassed: false })
    } else {
      const finalPos = resolveOverlap(snapped, w, h, getNodes())
      addNode({ id: newId, typeKey, position: finalPos, params: { ...def.defaultParams }, bypassed: false })
    }
  }

  function onNodeDrag(_e: React.MouseEvent, node: FlowNode) {
    const { w, h } = nodeDims(node.type ?? '', node.measured?.width, node.measured?.height)
    let snapped = {
      x: Math.round(node.position.x / GRID) * GRID,
      y: Math.round(node.position.y / GRID) * GRID,
    }
    if (!BUS_TYPES.has(node.type ?? '')) {
      snapped = snapOutOfCenter(snapped, w, complexityLevel !== 'beginner')
    }
    const resolved = resolveOverlap(snapped, w, h, getNodes(), node.id)
    setDragNodePreview({ typeKey: node.type ?? '', pos: resolved })
  }

  function onNodeDragStop(_e: React.MouseEvent, node: FlowNode) {
    setDragNodePreview(null)
    if (node.type === 'master-bus' && complexityLevel !== 'beginner') {
      updateNodePosition(node.id, MASTER_BUS_FLOW_POS)
      return
    }
    let snapped = {
      x: Math.round(node.position.x / GRID) * GRID,
      y: Math.round(node.position.y / GRID) * GRID,
    }
    const { w, h } = nodeDims(node.type ?? '', node.measured?.width, node.measured?.height)
    const notBeginner = complexityLevel !== 'beginner'
    if (BUS_TYPES.has(node.type ?? '') && node.type !== 'master-bus' && notBeginner) {
      // Center-zone buses move vertically only — restore original X
      const originalX = graphNodes.find((n) => n.id === node.id)?.position.x ?? snapped.x
      snapped.x = Math.round(originalX / GRID) * GRID
    } else if (!BUS_TYPES.has(node.type ?? '')) {
      snapped = snapOutOfCenter(snapped, w, notBeginner)
    }
    const resolved = resolveOverlap(snapped, w, h, getNodes(), node.id)
    updateNodePosition(node.id, resolved)
  }

  const displayNodes: FlowNode[] = useMemo(
    () =>
      graphNodes.map((node) => ({
        id:       node.id,
        type:     node.typeKey,
        position: node.position,
        draggable: !(node.typeKey === 'master-bus' && complexityLevel !== 'beginner'),
        data:     { color: node.color, label: node.label, typeKey: node.typeKey },
      })),
    [graphNodes, complexityLevel]
  )

  const displayEdges: Edge[] = useMemo(() => {
    // Stagger parallel edges sharing the same target so elbow points separate
    const edgesByTarget = new Map<string, string[]>()
    for (const e of graphEdges) {
      const arr = edgesByTarget.get(e.target) ?? []
      arr.push(e.id)
      edgesByTarget.set(e.target, arr)
    }

    const nodesForValidation = graphNodes.map((n) => ({ id: n.id, position: n.position }))

    return graphEdges.map((edge) => {
      const sourceStage = stages[edge.source]
      const healthColor = sourceStage
        ? getHealthStyle(sourceStage.health).color
        : 'var(--lsc-text)'

      const siblings      = edgesByTarget.get(edge.target) ?? [edge.id]
      const idx           = siblings.indexOf(edge.id)
      const centerXOffset = (idx - (siblings.length - 1) / 2) * 20

      const routingWarning = (edge.waypoints?.length ?? 0) > 0
        ? wirePassesThroughNode(edge.waypoints!, nodesForValidation, [edge.source, edge.target])
        : false

      return {
        id:           edge.id,
        source:       edge.source,
        sourceHandle: edge.sourceHandle,
        target:       edge.target,
        targetHandle: edge.targetHandle,
        type:         'chain',
        animated:     false,
        style:        { stroke: healthColor, strokeWidth: 3 },
        markerEnd:    { type: MarkerType.ArrowClosed, color: healthColor, width: 18, height: 18 },
        data:         { centerXOffset, waypoints: edge.waypoints, routingWarning },
      }
    })
  }, [graphEdges, stages, graphNodes])

  // Build live wire preview path
  const wirePath = (() => {
    if (!drawing.active) return null
    const endPos = snapPos ?? drawing.cursorPos
    const allPts = [drawing.startPos, ...drawing.waypoints, endPos]
    return buildWirePath(allPts)
  })()

  const sw   = 2 / vpZoom
  const dash = `${6 / vpZoom} ${4 / vpZoom}`

  return (
    <div
      className={`w-full h-full relative ${toolMode === 'connect' ? 'lsc-connect-mode' : ''}`}
      onDragLeave={onDragLeave}
    >
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={toolMode === 'select'}
        nodesConnectable={false}
        elementsSelectable={toolMode === 'select'}
        panOnDrag={toolMode === 'select'}
        nodeOrigin={[0, 0.5]}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
        style={{ background: 'var(--lsc-canvas)' }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onEdgesDelete={(eds) => eds.forEach((e) => removeEdge(e.id))}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color="var(--lsc-grid)"
        />
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
              stroke="var(--lsc-text)" strokeWidth={1 / vpZoom} opacity={0.25}
            />
            <line
              x1={CENTER_RIGHT_BOUND} y1={-10000} x2={CENTER_RIGHT_BOUND} y2={10000}
              stroke="var(--lsc-text)" strokeWidth={1 / vpZoom} opacity={0.25}
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
              strokeLinecap="square"
            />
            {snapPos && (
              <circle
                cx={snapPos.x} cy={snapPos.y}
                r={7 / vpZoom}
                fill="none"
                stroke={wireWarning ? 'var(--signal-hot)' : 'var(--lsc-accent)'}
                strokeWidth={sw}
              />
            )}
            {drawing.active && drawing.waypoints.map((wp, i) => (
              <circle
                key={i}
                cx={wp.x} cy={wp.y}
                r={3 / vpZoom}
                fill="var(--lsc-accent)"
                opacity={0.6}
              />
            ))}
          </g>
        </svg>
      )}

      {/* Ghost preview — palette drop and canvas node drag share the same look */}
      {(dropPreview ?? dragNodePreview) && (() => {
        const src    = (dropPreview ?? dragNodePreview)!
        const inline = INLINE_TYPE_KEYS.has(src.typeKey)
        const w      = inline ? 100 : 208
        const h      = inline ? 72  : 120
        const { x, y } = src.pos
        return (
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
                x={x}
                y={y - h / 2}
                width={w}
                height={h}
                rx={inline ? 8 : 12}
                fill="var(--lsc-accent)"
                fillOpacity={0.15}
                stroke="var(--lsc-accent)"
                strokeWidth={1.5 / vpZoom}
                strokeDasharray={`${6 / vpZoom} ${3 / vpZoom}`}
              />
            </g>
          </svg>
        )
      })()}
    </div>
  )
}
