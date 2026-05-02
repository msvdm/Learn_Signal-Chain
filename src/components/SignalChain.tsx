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
import type { SignalEdge }    from '../store/signalStore'
import { useGraphSignal }     from '../hooks/useSignalChain'
import { getHealthStyle }     from '../hooks/useGainStaging'
import { NODE_REGISTRY }      from '../data/nodeRegistry'
import { activeDragTypeKey }  from '../utils/dragState'

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
  bus:                MasterBusNode,
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

// ── Grid & layout constants ────────────────────────────────────────────────────

const GRID = 36
/** Minimum empty space kept between any two directly connected nodes.
 *  Sized to roughly one switch/fader element so there is always room to insert one. */
const MIN_GAP = 3 * GRID   // 108 px ≈ inline node width (100 px)

const INLINE_TYPE_KEYS = new Set([
  'mic', 'line-in', 'instrument', 'fader', 'switch', 'potentiometer', 'speaker',
  'gain', 'adc', 'dac',
])
// active-speaker is a NodeWrapper card (208px), not inline

/**
 * Default rendered widths per node type, matching each component's explicit
 * `style.width` override (or NodeWrapper's 208 px default where none is set).
 * Used as the fallback when React Flow has not yet measured a node — which is
 * always the case for a node that is about to be dropped but hasn't rendered.
 * For existing nodes the actual `measured.width` from React Flow takes precedence.
 *
 * EQ uses 380 (the advanced-level 4-band layout) as the conservative upper bound;
 * over-estimating spacing is always safer than under-estimating.
 */
const NODE_DEFAULT_W: Record<string, number> = {
  // Inline nodes (100px)
  'mic': 100, 'line-in': 100, 'instrument': 100,
  'fader': 100, 'switch': 100, 'potentiometer': 100, 'speaker': 100,
  'gain': 100, 'adc': 100, 'dac': 100,
  // Wider inline-style nodes
  'relay': 130, 'pan': 130,
  // Custom-width cards
  'hpf': 140,
  'eq': 380,
  'graphic-eq': 340,
  'di-box': 208, 'noise-gate': 220, 'limiter': 208, 'deesser': 208,
  // Standard NodeWrapper cards (208 px default, listed for clarity)
  'amp': 208, 'comp': 220, 'master-bus': 208, 'bus': 208,
  'audio-interface': 208, 'active-speaker': 208,
}

// ── Overlap helpers ────────────────────────────────────────────────────────────

function nodeDims(typeKey: string, measuredW?: number, measuredH?: number) {
  const inline = INLINE_TYPE_KEYS.has(typeKey)
  return {
    w: measuredW ?? NODE_DEFAULT_W[typeKey] ?? (inline ? 100 : 208),
    h: measuredH ?? (inline ? 72 : 120),
  }
}

// nodeOrigin=[0,0.5]: position is the left edge, vertical center
function nodeRect(pos: { x: number; y: number }, w: number, h: number) {
  return { left: pos.x, right: pos.x + w, top: pos.y - h / 2, bottom: pos.y + h / 2 }
}

function rectsOverlap(a: ReturnType<typeof nodeRect>, b: ReturnType<typeof nodeRect>) {
  const PAD = 8
  return (
    a.left   < b.right  + PAD &&
    a.right  > b.left   - PAD &&
    a.top    < b.bottom + PAD &&
    a.bottom > b.top    - PAD
  )
}

function resolveOverlap(
  pos: { x: number; y: number },
  w: number,
  h: number,
  others: FlowNode[],
  skipId?: string,
): { x: number; y: number } {
  let cur = { ...pos }
  for (let i = 0; i < 50; i++) {
    const r = nodeRect(cur, w, h)
    const clash = others.find((n) => {
      if (n.id === skipId) return false
      const d = nodeDims(n.type ?? '', n.measured?.width, n.measured?.height)
      return rectsOverlap(r, nodeRect(n.position, d.w, d.h))
    })
    if (!clash) return cur
    cur = { x: cur.x, y: cur.y + GRID }
  }
  return cur
}

// ── Spacing helpers ────────────────────────────────────────────────────────────

/** Push every node whose left edge is at X ≥ fromX rightward by `amount` (grid-snapped).
 *  Updates the local nodeMap in-place so subsequent calls in the same pass cascade. */
function pushDownstream(
  fromX: number,
  amount: number,
  nodes: FlowNode[],
  nodeMap: Map<string, FlowNode>,
  updatePos: (id: string, pos: { x: number; y: number }) => void,
) {
  const snapped = Math.ceil(amount / GRID) * GRID
  for (const n of nodes) {
    if (n.position.x >= fromX - GRID / 2) {
      const newPos = { x: n.position.x + snapped, y: n.position.y }
      nodeMap.set(n.id, { ...n, position: newPos })
      updatePos(n.id, newPos)
    }
  }
}

/** Ensure source→target pair has at least MIN_GAP between them, pushing target
 *  (and everything downstream) right if needed. */
function enforceGap(
  srcId: string,
  tgtId: string,
  nodes: FlowNode[],
  updatePos: (id: string, pos: { x: number; y: number }) => void,
) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const src = nodeMap.get(srcId)
  const tgt = nodeMap.get(tgtId)
  if (!src || !tgt) return
  const srcDims = nodeDims(src.type ?? '', src.measured?.width, src.measured?.height)
  const gap  = tgt.position.x - (src.position.x + srcDims.w)
  if (gap < MIN_GAP) {
    pushDownstream(tgt.position.x, MIN_GAP - gap, nodes, nodeMap, updatePos)
  }
}

// ── Edge insertion helpers ─────────────────────────────────────────────────────

const HIT_THRESHOLD = 48 // flow-coordinate pixels

/** Returns the edge that "owns" the given flow-coordinate drop point.
 *
 *  Each edge is assigned the horizontal band between the CENTRE of its source
 *  node and the CENTRE of its target node.  Adjacent edges share a boundary at
 *  the centre of the shared (bridge) node — so zones never overlap and the
 *  correct edge is always selected regardless of measured node widths.
 *
 *  Vertical tolerance is ±HIT_THRESHOLD around the two node centres. */
function findEdgeAtPoint(
  point: { x: number; y: number },
  edges: SignalEdge[],
  nodes: FlowNode[],
): SignalEdge | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  for (const edge of edges) {
    const src = nodeMap.get(edge.source)
    const tgt = nodeMap.get(edge.target)
    if (!src || !tgt) continue
    const srcDims = nodeDims(src.type ?? '', src.measured?.width, src.measured?.height)
    const tgtDims = nodeDims(tgt.type ?? '', tgt.measured?.width, tgt.measured?.height)
    // X zone: source centre → target centre (non-overlapping for adjacent edges)
    const srcCX = src.position.x + srcDims.w / 2
    const tgtCX = tgt.position.x + tgtDims.w / 2
    if (point.x < srcCX || point.x > tgtCX) continue
    // Y zone: covers both node heights + threshold
    const minY = Math.min(src.position.y, tgt.position.y) - HIT_THRESHOLD
    const maxY = Math.max(src.position.y, tgt.position.y) + HIT_THRESHOLD
    if (point.y < minY || point.y > maxY) continue
    return edge
  }
  return null
}

/** True only for nodes that have both an input and an output port (can be inserted mid-chain). */
function canInsertMidChain(typeKey: string): boolean {
  const def = NODE_REGISTRY[typeKey]
  return !!def && def.inputs.length > 0 && def.outputs.length > 0
}

// ── Wire drawing types ─────────────────────────────────────────────────────────

type Pt = { x: number; y: number }

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

// ── Pure helpers (no component state) ─────────────────────────────────────────

/** Find the react-flow handle element at a screen point, ignoring a given element. */
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

/**
 * Build an orthogonal SVG path through a series of flow-coordinate points.
 * The first segment exits to the right (source handle is always on the right).
 * Subsequent segments use a simple H→V→H elbow.
 */
function buildWirePath(points: Pt[]): string {
  if (points.length < 2) return ''
  const MIN_EXIT = 40
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    // First segment: guarantee minimum rightward exit from the source handle
    const pivot = i === 0
      ? Math.max(a.x + MIN_EXIT, (a.x + b.x) / 2)
      : (a.x + b.x) / 2
    d += ` H ${pivot} V ${b.y} H ${b.x}`
  }
  return d
}

// ── Component ─────────────────────────────────────────────────────────────────

type ToolMode = 'select' | 'connect'

interface SignalChainProps {
  toolMode: ToolMode
  onToolModeChange: (mode: ToolMode) => void
}

export function SignalChain({ toolMode, onToolModeChange }: SignalChainProps) {
  const graphNodes         = useSignalStore((s) => s.nodes)
  const graphEdges         = useSignalStore((s) => s.edges)
  const addNode            = useSignalStore((s) => s.addNode)
  const addEdge            = useSignalStore((s) => s.addEdge)
  const removeEdge         = useSignalStore((s) => s.removeEdge)
  const updateNodePosition = useSignalStore((s) => s.updateNodePosition)
  const { stages }         = useGraphSignal()
  const { screenToFlowPosition, getNodes, fitView } = useReactFlow()
  const { x: vpX, y: vpY, zoom: vpZoom }  = useViewport()

  const [drawing, setDrawing]               = useState<WireDrawing>({ active: false })
  const [snapPos, setSnapPos]               = useState<Pt | null>(null)
  const [dropPreview, setDropPreview]       = useState<{ typeKey: string; pos: Pt } | null>(null)
  const [dragNodePreview, setDragNodePreview] = useState<{ typeKey: string; pos: Pt } | null>(null)

  // Mutable refs so document-level handlers always see current state
  const drawingRef    = useRef(drawing)
  drawingRef.current  = drawing
  const toolModeRef   = useRef(toolMode)
  toolModeRef.current = toolMode
  const edgesRef      = useRef(graphEdges)
  edgesRef.current    = graphEdges

  // Cancel drawing when leaving connect mode
  useEffect(() => {
    if (toolMode !== 'connect') {
      setDrawing({ active: false })
      setSnapPos(null)
    }
  }, [toolMode])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 's' || e.key === 'S') onToolModeChange('select')
      if (e.key === 'c' || e.key === 'C' || e.key === 'l' || e.key === 'L') onToolModeChange('connect')
      if (e.key === 'Escape') {
        if (drawingRef.current.active) {
          setDrawing({ active: false })
          setSnapPos(null)
        } else {
          onToolModeChange('select')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onToolModeChange])

  // Live cursor tracking while drawing
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (toolModeRef.current !== 'connect') return
      const d = drawingRef.current
      if (!d.active) return

      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setDrawing((prev) => (prev.active ? { ...prev, cursorPos: flowPos } : prev))

      // Snap detection: highlight target handle under cursor
      const hEl = handleUnder(e.clientX, e.clientY)
      if (hEl?.classList.contains('target')) {
        setSnapPos(handleFlowPos(hEl, screenToFlowPosition))
      } else {
        setSnapPos(null)
      }
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [screenToFlowPosition])

  // Click interception — capture phase fires before React Flow's own handlers
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (toolModeRef.current !== 'connect') return
      if (e.button !== 0) return

      const d     = drawingRef.current
      const hEl   = handleUnder(e.clientX, e.clientY)
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })

      if (!d.active) {
        // Start a new wire from a source handle
        if (hEl?.classList.contains('source')) {
          e.stopPropagation()
          setDrawing({
            active: true,
            sourceNodeId:   hEl.dataset.nodeid!,
            sourceHandleId: hEl.dataset.handleid!,
            startPos:   handleFlowPos(hEl, screenToFlowPosition),
            waypoints:  [],
            cursorPos:  flowPos,
          })
        }
        return
      }

      // Wire is being drawn — intercept ALL left-clicks
      e.stopPropagation()

      if (hEl?.classList.contains('target')) {
        // Complete the connection
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
          addEdge({
            id:           `e-${d.sourceNodeId}-${targetNodeId}-${Date.now()}`,
            source:       d.sourceNodeId,
            sourceHandle: d.sourceHandleId,
            target:       targetNodeId,
            targetHandle: targetHandleId,
          })
          // Ensure the two newly connected nodes respect the minimum gap
          enforceGap(d.sourceNodeId, targetNodeId, getNodes(), updateNodePosition)
        }
        setDrawing({ active: false })
        setSnapPos(null)
        return
      }

      if (hEl?.classList.contains('source')) {
        // Click a different source → restart wire from here
        setDrawing({
          active: true,
          sourceNodeId:   hEl.dataset.nodeid!,
          sourceHandleId: hEl.dataset.handleid!,
          startPos:   handleFlowPos(hEl, screenToFlowPosition),
          waypoints:  [],
          cursorPos:  flowPos,
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
  }, [screenToFlowPosition, addEdge, getNodes, updateNodePosition])

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const typeKey = activeDragTypeKey
    if (!typeKey) return
    const raw = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setDropPreview({
      typeKey,
      pos: {
        x: Math.round(raw.x / GRID) * GRID,
        y: Math.round(raw.y / GRID) * GRID,
      },
    })
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
    // Use graphEdges from the Zustand store — always in sync, unlike
    // getEdges() from useReactFlow() which can lag one render behind.
    if (canInsertMidChain(typeKey)) {
      const allNodes      = getNodes()
      // Build node lookup from graphNodes (always current) enriched with React Flow
      // measured dimensions where available.
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

          const minInsertX   = Math.round((srcRight + MIN_GAP) / GRID) * GRID
          const insertX      = Math.max(minInsertX, Math.round(snapped.x / GRID) * GRID)
          const insertY      = Math.round(snapped.y / GRID) * GRID
          const newNodeRight = insertX + w
          const rightGap     = tgtLeft - newNodeRight

          if (rightGap < MIN_GAP) {
            const push    = Math.ceil((MIN_GAP - rightGap) / GRID) * GRID
            const nmNodes = [...nodePositions.values()] as unknown as FlowNode[]
            const nm      = new Map(nmNodes.map((n) => [n.id, n]))
            pushDownstream(tgtLeft, push, nmNodes, nm, updateNodePosition)
          }

          addNode({ id: newId, typeKey, position: { x: insertX, y: insertY }, params: { ...def.defaultParams }, bypassed: false, label: def.label })
          removeEdge(hitEdge.id)
          const ts = Date.now()
          addEdge({ id: `e-${hitEdge.source}-${newId}-${ts}`,     source: hitEdge.source, sourceHandle: hitEdge.sourceHandle, target: newId,          targetHandle: def.inputs[0].id  })
          addEdge({ id: `e-${newId}-${hitEdge.target}-${ts + 1}`, source: newId,          sourceHandle: def.outputs[0].id,   target: hitEdge.target, targetHandle: hitEdge.targetHandle })
          // Fit all nodes into view after insertion — the pushed target may be off-screen
          setTimeout(() => fitView({ padding: 0.25, duration: 400 }), 50)
          return
        }
      }
    }

    // ── Normal placement (no edge hit) ────────────────────────────────────────
    const pos = resolveOverlap(snapped, w, h, getNodes())
    addNode({
      id:       newId,
      typeKey,
      position: pos,
      params:   { ...def.defaultParams },
      bypassed: false,
      label:    def.label,
    })
  }

  function onNodeDrag(_e: React.MouseEvent, node: FlowNode) {
    const snapped = {
      x: Math.round(node.position.x / GRID) * GRID,
      y: Math.round(node.position.y / GRID) * GRID,
    }
    const { w, h } = nodeDims(node.type ?? '', node.measured?.width, node.measured?.height)
    const resolved = resolveOverlap(snapped, w, h, getNodes(), node.id)
    setDragNodePreview({ typeKey: node.type ?? '', pos: resolved })
  }

  function onNodeDragStop(_e: React.MouseEvent, node: FlowNode) {
    setDragNodePreview(null)
    const snapped = {
      x: Math.round(node.position.x / GRID) * GRID,
      y: Math.round(node.position.y / GRID) * GRID,
    }
    const { w, h } = nodeDims(node.type ?? '', node.measured?.width, node.measured?.height)
    const resolved = resolveOverlap(snapped, w, h, getNodes(), node.id)
    updateNodePosition(node.id, resolved)
  }

  const displayNodes: FlowNode[] = useMemo(
    () =>
      graphNodes.map((node) => ({
        id:       node.id,
        type:     node.typeKey,
        position: node.position,
        data:     { color: node.color, label: node.label, typeKey: node.typeKey },
      })),
    [graphNodes]
  )

  const displayEdges: Edge[] = useMemo(() => {
    // Stagger parallel edges that share the same target node.
    // Edges going to the same target are offset at their center X so their
    // elbow points separate, preventing overlap.
    const edgesByTarget = new Map<string, string[]>()
    for (const e of graphEdges) {
      const arr = edgesByTarget.get(e.target) ?? []
      arr.push(e.id)
      edgesByTarget.set(e.target, arr)
    }

    return graphEdges.map((edge) => {
      const sourceStage = stages[edge.source]
      const healthColor = sourceStage
        ? getHealthStyle(sourceStage.health).color
        : 'var(--lsc-text)'

      const siblings   = edgesByTarget.get(edge.target) ?? [edge.id]
      const idx        = siblings.indexOf(edge.id)
      const centerXOffset = (idx - (siblings.length - 1) / 2) * 20

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
        data:         { centerXOffset },
      }
    })
  }, [graphEdges, stages])

  // Build live wire preview path
  const wirePath = (() => {
    if (!drawing.active) return null
    const endPos  = snapPos ?? drawing.cursorPos
    const allPts  = [drawing.startPos, ...drawing.waypoints, endPos]
    return buildWirePath(allPts)
  })()

  const sw   = 2 / vpZoom   // stroke-width in flow units
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
        nodesConnectable={false}          // connections handled entirely by our click system
        elementsSelectable={toolMode === 'select'}
        panOnDrag={toolMode === 'select'} // prevent accidental pan while placing wires
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

      {/* Live wire preview SVG — rendered in flow-coordinate space */}
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
            {/* Wire path */}
            <path
              d={wirePath}
              fill="none"
              stroke="var(--lsc-accent)"
              strokeWidth={sw}
              strokeDasharray={dash}
              strokeLinecap="square"
            />
            {/* Snap ring at hovered target handle */}
            {snapPos && (
              <circle
                cx={snapPos.x} cy={snapPos.y}
                r={7 / vpZoom}
                fill="none"
                stroke="var(--lsc-accent)"
                strokeWidth={sw}
              />
            )}
            {/* Committed waypoint dots */}
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

      {/* Ghost previews — palette drop and canvas node drag share the same look */}
      {(dropPreview ?? dragNodePreview) && (() => {
        const src = (dropPreview ?? dragNodePreview)!
        const inline = INLINE_TYPE_KEYS.has(src.typeKey)
        const w = inline ? 100 : 208
        const h = inline ? 72  : 120
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
