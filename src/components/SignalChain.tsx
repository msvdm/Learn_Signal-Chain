import { useState, useRef } from 'react'
import {
  ReactFlow,
  Background,
  type Edge,
  type Node,
  type NodeChange,
  BackgroundVariant,
  MarkerType,
  applyNodeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { MicrophoneNode } from './nodes/MicrophoneNode'
import { PreampNode } from './nodes/PreampNode'
import { EQNode } from './nodes/EQNode'
import { CompressorNode } from './nodes/CompressorNode'
import { FaderNode } from './nodes/FaderNode'
import { MasterBusNode } from './nodes/MasterBusNode'
import { SpeakerNode } from './nodes/SpeakerNode'
import { BusNode } from './nodes/BusNode'
import { EdgeContextMenu } from './EdgeContextMenu'

import { useSignalStore } from '../store/signalStore'
import { useSignalChain } from '../hooks/useSignalChain'
import { getHealthStyle } from '../hooks/useGainStaging'
import { CHAIN_ORDER } from '../data/levels'

// Node types must be defined outside the component to avoid re-registration
const nodeTypes = {
  microphone: MicrophoneNode,
  preamp: PreampNode,
  eq: EQNode,
  compressor: CompressorNode,
  fader: FaderNode,
  masterBus: MasterBusNode,
  speaker: SpeakerNode,
  bus: BusNode,
}

const NODE_TYPE_MAP: Record<string, string> = {
  mic: 'microphone',
  preamp: 'preamp',
  eq: 'eq',
  comp: 'compressor',
  fader: 'fader',
  master: 'masterBus',
  speaker: 'speaker',
}

const NODE_SPACING = 240

function computeNodePositions(order: string[]): Record<string, number> {
  return Object.fromEntries(order.map((id, i) => [id, i * NODE_SPACING]))
}

function buildChainEdge(
  source: string,
  target: string,
  healthColor: string,
  isBypassed: boolean
): Edge {
  const style = isBypassed
    ? { stroke: 'var(--lsc-fg-fainter)', strokeDasharray: '6 3', strokeWidth: 2 }
    : { stroke: healthColor, strokeWidth: 3 }
  const markerColor = isBypassed ? 'var(--lsc-fg-fainter)' : healthColor
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    type: 'step',
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: markerColor, width: 18, height: 18 },
    style,
  }
}

interface EdgeMenuState {
  edge: Edge
  position: { x: number; y: number }
}

export function SignalChain() {
  const chainOrder        = useSignalStore((s) => s.chainOrder)
  const bypassedNodes     = useSignalStore((s) => s.bypassedNodes)
  const sends             = useSignalStore((s) => s.sends)
  const placingSend       = useSignalStore((s) => s.placingSend)
  const insertNode        = useSignalStore((s) => s.insertNode)
  const startPlacingSend  = useSignalStore((s) => s.startPlacingSend)
  const cancelSend        = useSignalStore((s) => s.cancelSend)
  const updateBusPosition = useSignalStore((s) => s.updateBusPosition)
  const { stages }        = useSignalChain()

  const [hoverTarget, setHoverTarget] = useState<'pane' | 'node' | 'edge'>('pane')
  const [edgeMenu, setEdgeMenu] = useState<EdgeMenuState | null>(null)
  // Track viewport for screen→canvas coordinate conversion
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Nodes available to insert = known chain nodes not currently in the chain
  const availableInserts = CHAIN_ORDER.filter((id) => !chainOrder.includes(id))

  const nodePositions = computeNodePositions(chainOrder)

  // Main-chain nodes (non-draggable)
  const chainNodes: Node[] = chainOrder
    .filter((id) => NODE_TYPE_MAP[id] !== undefined)
    .map((id) => ({
      id,
      type: NODE_TYPE_MAP[id],
      position: { x: nodePositions[id] ?? 0, y: 0 },
      data: {},
      draggable: false,
    }))

  // Bus nodes (draggable, positioned wherever the user placed them)
  const busNodes: Node[] = sends.map((send) => ({
    id: `bus-${send.id}`,
    type: 'bus' as const,
    position: send.busPosition,
    data: { send },
    draggable: true,
  }))

  const displayNodes: Node[] = [...chainNodes, ...busNodes]

  // Main-chain edges
  const chainEdges: Edge[] = []
  for (let i = 0; i < chainOrder.length - 1; i++) {
    const src = chainOrder[i]
    const tgt = chainOrder[i + 1]
    if (!NODE_TYPE_MAP[src] || !NODE_TYPE_MAP[tgt]) continue
    const stage = stages[src]
    const healthColor = stage
      ? getHealthStyle(stage.health).color
      : 'var(--lsc-fg-fainter)'
    chainEdges.push(buildChainEdge(src, tgt, healthColor, bypassedNodes.has(src)))
  }

  // Send edges (dashed, animated — from tap node to bus node)
  const sendEdges: Edge[] = sends.map((send) => ({
    id: `send-edge-${send.id}`,
    source: send.fromNodeId,
    target: `bus-${send.id}`,
    type: 'step',
    animated: true,
    style: { stroke: 'var(--lsc-accent-soft)', strokeDasharray: '6 3', strokeWidth: 2 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: 'var(--lsc-accent-soft)',
      width: 14,
      height: 14,
    },
  }))

  const displayEdges: Edge[] = [...chainEdges, ...sendEdges]

  const cursorClass = placingSend
    ? 'cursor-crosshair'
    : ({ pane: 'cursor-grab', node: 'cursor-default', edge: 'cursor-crosshair' } as const)[hoverTarget]

  function handleNodesChange(changes: NodeChange<Node>[]) {
    // Only handle position changes for draggable bus nodes
    for (const change of changes) {
      if (change.type === 'position' && change.id.startsWith('bus-') && change.position) {
        const sendId = change.id.slice(4) // remove 'bus-' prefix
        updateBusPosition(sendId, change.position)
      }
    }
    // Apply changes to keep React Flow internal state in sync
    // (React Flow needs this even for externally-controlled nodes)
    void applyNodeChanges(changes, displayNodes)
  }

  function handleEdgeClick(event: React.MouseEvent, edge: Edge) {
    if (edge.id.startsWith('send-edge-')) return
    event.stopPropagation()
    setEdgeMenu({ edge, position: { x: event.clientX, y: event.clientY } })
  }

  function handlePaneClick(event: React.MouseEvent) {
    if (placingSend) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        // Convert screen → canvas coordinates using tracked viewport transform
        const canvasPos = {
          x: (event.clientX - rect.left - viewport.x) / viewport.zoom,
          y: (event.clientY - rect.top - viewport.y) / viewport.zoom,
        }
        useSignalStore.getState().placeSend(canvasPos)
      }
    } else {
      setEdgeMenu(null)
    }
  }

  return (
    <div ref={containerRef} className={`w-full h-full ${cursorClass} relative`}>
      {/* "Place bus" overlay hint */}
      {placingSend && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: 'var(--lsc-node-bg)',
            border: '1px solid var(--lsc-border)',
            borderRadius: 'var(--lsc-radius-md)',
            padding: '6px 14px',
            fontSize: 12,
            color: 'var(--lsc-fg-dim)',
            pointerEvents: 'none',
            boxShadow: 'var(--lsc-shadow-popup)',
            whiteSpace: 'nowrap',
          }}
        >
          Click anywhere to place the{' '}
          <strong style={{ color: 'var(--lsc-fg)' }}>
            {placingSend.busType === 'aux' ? 'Aux Bus'
              : placingSend.busType === 'fx' ? 'FX Engine'
              : 'PFL Monitor'}
          </strong>
          {' '}— press{' '}
          <kbd style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: 10 }}>Esc</kbd>
          {' '}to cancel
        </div>
      )}

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodesChange={handleNodesChange}
        onNodeMouseEnter={() => setHoverTarget('node')}
        onNodeMouseLeave={() => setHoverTarget('pane')}
        onEdgeMouseEnter={() => setHoverTarget('edge')}
        onEdgeMouseLeave={() => setHoverTarget('pane')}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onMove={(_e, vp) => setViewport(vp)}
        onKeyDown={(e) => { if (e.key === 'Escape') cancelSend() }}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
        style={{ background: 'var(--lsc-canvas)' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color="var(--lsc-grid)"
        />
      </ReactFlow>

      {edgeMenu && (
        <EdgeContextMenu
          edge={edgeMenu.edge}
          position={edgeMenu.position}
          availableInserts={availableInserts}
          onInsert={(nodeId) => {
            insertNode(nodeId, edgeMenu.edge.source)
            setEdgeMenu(null)
          }}
          onSend={(busType) => {
            startPlacingSend(edgeMenu.edge.source, busType)
            setEdgeMenu(null)
          }}
          onClose={() => setEdgeMenu(null)}
        />
      )}
    </div>
  )
}
