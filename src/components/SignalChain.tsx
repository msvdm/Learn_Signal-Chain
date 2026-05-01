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

import { MicNode }            from './nodes/MicNode'
import { GainNode }           from './nodes/GainNode'
import { FaderNode }          from './nodes/FaderNode'
import { MasterBusNode }      from './nodes/MasterBusNode'
import { AmpNode }            from './nodes/AmpNode'
import { SpeakerNode }        from './nodes/SpeakerNode'
import { SwitchNode }         from './nodes/SwitchNode'
import { PotentiometerNode }  from './nodes/PotentiometerNode'
import { GenericNode }        from './nodes/GenericNode'
import { HpfNode }            from './nodes/HpfNode'
import { EQNode }             from './nodes/EQNode'
import { GraphicEQNode }      from './nodes/GraphicEQNode'
import { ChainEdge }          from './ChainEdge'

import { useSignalStore }     from '../store/signalStore'
import { useGraphSignal }     from '../hooks/useSignalChain'
import { getHealthStyle }     from '../hooks/useGainStaging'
import { NODE_REGISTRY }      from '../data/nodeRegistry'
import { activeDragTypeKey }  from '../utils/dragState'

// nodeTypes must be defined outside the component to avoid re-registration on every render
const nodeTypes = {
  mic:           MicNode,
  'line-in':     MicNode,
  instrument:    MicNode,
  gain:          GainNode,
  preamp:        GainNode,
  amp:           AmpNode,
  fader:         FaderNode,
  'master-bus':  MasterBusNode,
  bus:           MasterBusNode,
  hpf:           HpfNode,
  eq:            EQNode,
  comp:          GenericNode,
  switch:        SwitchNode,
  potentiometer: PotentiometerNode,
  'graphic-eq':  GraphicEQNode,
  speaker:       SpeakerNode,
}

const edgeTypes = { chain: ChainEdge }

// ── Grid & layout constants ────────────────────────────────────────────────────

const GRID = 36

const INLINE_TYPE_KEYS = new Set([
  'mic', 'line-in', 'instrument', 'fader', 'switch', 'potentiometer', 'speaker',
])

// ── Overlap helpers ────────────────────────────────────────────────────────────

function nodeDims(typeKey: string, measuredW?: number, measuredH?: number) {
  const inline = INLINE_TYPE_KEYS.has(typeKey)
  return {
    w: measuredW ?? (inline ? 100 : 208),
    h: measuredH ?? (inline ? 72  : 120),
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
  const { screenToFlowPosition, getNodes } = useReactFlow()
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
  }, [screenToFlowPosition, addEdge])

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
    const pos = resolveOverlap(snapped, w, h, getNodes())
    addNode({
      id:       `${typeKey}-${Date.now()}`,
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

  const displayEdges: Edge[] = useMemo(
    () =>
      graphEdges.map((edge) => {
        const sourceStage = stages[edge.source]
        const healthColor = sourceStage
          ? getHealthStyle(sourceStage.health).color
          : 'var(--lsc-text)'
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
        }
      }),
    [graphEdges, stages]
  )

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
