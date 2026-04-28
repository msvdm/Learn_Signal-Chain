import { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  ReactFlow,
  Background,
  type Edge,
  type Node as FlowNode,
  type Connection,
  BackgroundVariant,
  MarkerType,
  useReactFlow,
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
import { ToolBar }            from './ToolBar'

import { useSignalStore }     from '../store/signalStore'
import { useGraphSignal }     from '../hooks/useSignalChain'
import { getHealthStyle }     from '../hooks/useGainStaging'
import { NODE_REGISTRY }      from '../data/nodeRegistry'

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
  bus:           GenericNode,
  hpf:           HpfNode,
  eq:            EQNode,
  comp:          GenericNode,
  switch:        SwitchNode,
  potentiometer: PotentiometerNode,
  'graphic-eq':  GraphicEQNode,
  speaker:       SpeakerNode,
}

const edgeTypes = {
  chain: ChainEdge,
}

type ToolMode = 'select' | 'connect'

export function SignalChain() {
  const graphNodes  = useSignalStore((s) => s.nodes)
  const graphEdges  = useSignalStore((s) => s.edges)
  const addNode     = useSignalStore((s) => s.addNode)
  const addEdge     = useSignalStore((s) => s.addEdge)
  const removeEdge  = useSignalStore((s) => s.removeEdge)
  const { stages }  = useGraphSignal()
  const { screenToFlowPosition } = useReactFlow()

  const [toolMode, setToolMode] = useState<ToolMode>('select')
  const [edgeMenu, setEdgeMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null)
  const edgeMenuRef = useRef<HTMLDivElement>(null)

  // Keyboard shortcuts: S = select, C/L = connect, Escape = select
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (e.key === 's' || e.key === 'S') setToolMode('select')
      if (e.key === 'c' || e.key === 'C' || e.key === 'l' || e.key === 'L') setToolMode('connect')
      if (e.key === 'Escape') { setToolMode('select'); setEdgeMenu(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Dismiss edge context menu on outside click
  useEffect(() => {
    if (!edgeMenu) return
    function onDown(e: MouseEvent) {
      if (edgeMenuRef.current && !edgeMenuRef.current.contains(e.target as HTMLElement)) setEdgeMenu(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [edgeMenu])

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const typeKey = e.dataTransfer.getData('application/lsc-node-type')
    if (!typeKey) return
    const def = NODE_REGISTRY[typeKey]
    if (!def) return
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    addNode({
      id: `${typeKey}-${Date.now()}`,
      typeKey,
      position: pos,
      params: { ...def.defaultParams },
      bypassed: false,
      label: def.label,
    })
  }

  function onConnect(conn: Connection) {
    const isDup = graphEdges.some(
      (e) =>
        e.source === conn.source &&
        e.sourceHandle === (conn.sourceHandle ?? 'out') &&
        e.target === conn.target &&
        e.targetHandle === (conn.targetHandle ?? 'in')
    )
    if (isDup) return
    addEdge({
      id: `e-${conn.source}-${conn.target}-${Date.now()}`,
      source: conn.source!,
      sourceHandle: conn.sourceHandle ?? 'out',
      target: conn.target!,
      targetHandle: conn.targetHandle ?? 'in',
    })
  }

  function onEdgeContextMenu(e: React.MouseEvent, edge: Edge) {
    e.preventDefault()
    setEdgeMenu({ edgeId: edge.id, x: e.clientX + 4, y: e.clientY })
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
        const sourceStage  = stages[edge.source]
        const healthColor  = sourceStage
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

  return (
    <div className="w-full h-full relative">
      <ToolBar mode={toolMode} onChange={setToolMode} />
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={toolMode === 'select'}
        nodesConnectable={toolMode === 'connect'}
        elementsSelectable={toolMode === 'select'}
        nodeOrigin={[0, 0.5]}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
        style={{ background: 'var(--lsc-canvas)' }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onConnect={onConnect}
        onEdgeContextMenu={onEdgeContextMenu}
        onEdgesDelete={(eds) => eds.forEach((e) => removeEdge(e.id))}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color="var(--lsc-grid)"
        />
      </ReactFlow>

      {/* Edge right-click delete menu */}
      {edgeMenu && createPortal(
        <div
          ref={edgeMenuRef}
          style={{
            position: 'fixed',
            left: edgeMenu.x,
            top: edgeMenu.y,
            zIndex: 9999,
            background: 'var(--lsc-node-bg)',
            border: '1px solid var(--lsc-border)',
            borderRadius: 'var(--lsc-radius-md)',
            boxShadow: 'var(--lsc-shadow-popup)',
            overflow: 'hidden',
            fontSize: 12,
            color: 'var(--lsc-text)',
            minWidth: 140,
          }}
        >
          <button
            style={{
              display: 'block', width: '100%',
              padding: '7px 12px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--signal-clipping)', textAlign: 'left', fontSize: 12,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--lsc-sunken)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            onClick={() => { removeEdge(edgeMenu.edgeId); setEdgeMenu(null) }}
          >
            Delete connection
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
