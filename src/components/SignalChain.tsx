import { useState, useRef, useMemo } from 'react'
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
import { MasterFaderNode } from './nodes/MasterFaderNode'
import { OutputEQNode } from './nodes/OutputEQNode'
import { OutputGainNode } from './nodes/OutputGainNode'
import { SpeakerNode } from './nodes/SpeakerNode'
import { BusNode } from './nodes/BusNode'
import { BusFaderNode } from './nodes/BusFaderNode'
import { EndNode } from './nodes/EndNode'
import { ChainEdge } from './ChainEdge'

import { useSignalStore } from '../store/signalStore'
import { useSignalChain, getHealth } from '../hooks/useSignalChain'
import { getHealthStyle } from '../hooks/useGainStaging'

// Must be defined outside component to avoid re-registration on every render
const nodeTypes = {
  microphone: MicrophoneNode,
  preamp: PreampNode,
  eq: EQNode,
  compressor: CompressorNode,
  fader: FaderNode,
  masterBus: MasterBusNode,
  masterFader: MasterFaderNode,
  outputEq: OutputEQNode,
  outputGain: OutputGainNode,
  speaker: SpeakerNode,
  bus: BusNode,
  busFader: BusFaderNode,
  end: EndNode,
}

const edgeTypes = {
  chain: ChainEdge,
}

const NODE_TYPE_MAP: Record<string, string> = {
  mic: 'microphone',
  preamp: 'preamp',
  eq: 'eq',
  comp: 'compressor',
  fader: 'fader',
  'master-bus': 'masterBus',
  'master-fader': 'masterFader',
  'output-eq': 'outputEq',
  'output-gain': 'outputGain',
  speaker: 'speaker',
}

const NODE_SPACING = 300

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
    type: 'chain',
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: markerColor, width: 18, height: 18 },
    style,
  }
}

export function SignalChain() {
  const chainOrder        = useSignalStore((s) => s.chainOrder)
  const bypassedNodes     = useSignalStore((s) => s.bypassedNodes)
  const sends             = useSignalStore((s) => s.sends)
  const placingSend       = useSignalStore((s) => s.placingSend)
  const cancelSend        = useSignalStore((s) => s.cancelSend)
  const updateBusPosition = useSignalStore((s) => s.updateBusPosition)
  const { stages }        = useSignalChain()

  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 })
  const containerRef = useRef<HTMLDivElement>(null)

  const displayNodes: Node[] = useMemo(() => {
    const nodePositions = computeNodePositions(chainOrder)
    const chainNodes: Node[] = chainOrder
      .filter((id) => NODE_TYPE_MAP[id] !== undefined)
      .map((id) => ({
        id,
        type: NODE_TYPE_MAP[id],
        position: { x: nodePositions[id] ?? 0, y: 0 },
        data: {},
        draggable: false,
      }))

    if (!chainOrder.includes('speaker')) {
      const lastId = chainOrder[chainOrder.length - 1]
      const lastX = nodePositions[lastId] ?? 0
      chainNodes.push({
        id: '__end',
        type: 'end' as const,
        position: { x: lastX + NODE_SPACING, y: 0 },
        data: {},
        draggable: false,
      })
    }

    const busNodes: Node[] = sends.map((send) => ({
      id: `bus-${send.id}`,
      type: 'bus' as const,
      position: send.busPosition,
      data: { send },
      draggable: true,
    }))

    const busFaderNodes: Node[] = sends.map((send) => ({
      id: `bus-fader-${send.id}`,
      type: 'busFader' as const,
      position: { x: send.busPosition.x + 220, y: send.busPosition.y },
      data: { send },
      draggable: false,
    }))

    return [...chainNodes, ...busNodes, ...busFaderNodes]
  }, [chainOrder, sends])

  const displayEdges: Edge[] = useMemo(() => {
    const chainEdges: Edge[] = []
    for (let i = 0; i < chainOrder.length - 1; i++) {
      const src = chainOrder[i]
      const tgt = chainOrder[i + 1]
      if (!NODE_TYPE_MAP[src] || !NODE_TYPE_MAP[tgt]) continue
      const stage = stages[src]
      const healthColor = stage ? getHealthStyle(stage.health).color : 'var(--lsc-fg-fainter)'
      chainEdges.push(buildChainEdge(src, tgt, healthColor, bypassedNodes.has(src)))
    }

    if (!chainOrder.includes('speaker') && chainOrder.length > 0) {
      const lastId = chainOrder[chainOrder.length - 1]
      chainEdges.push({
        id: 'e-end',
        source: lastId,
        target: '__end',
        animated: false,
        style: { stroke: 'var(--lsc-border)', strokeDasharray: '5 3', strokeWidth: 2, opacity: 0.45 },
      })
    }

    const sendEdges: Edge[] = sends.map((send) => ({
      id: `send-edge-${send.id}`,
      source: send.fromNodeId,
      target: `bus-${send.id}`,
      type: 'smoothstep',
      animated: true,
      style: { stroke: 'var(--lsc-accent-soft)', strokeDasharray: '6 3', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'var(--lsc-accent-soft)',
        width: 14,
        height: 14,
      },
    }))

    const busFaderEdges: Edge[] = sends.map((send) => {
      const tapDb = stages[send.fromNodeId]?.out ?? -Infinity
      const color = getHealthStyle(getHealth(tapDb)).color
      return {
        id: `bus-fader-edge-${send.id}`,
        source: `bus-${send.id}`,
        target: `bus-fader-${send.id}`,
        animated: false,
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
      }
    })

    return [...chainEdges, ...sendEdges, ...busFaderEdges]
  }, [chainOrder, sends, stages, bypassedNodes])

  function handleNodesChange(changes: NodeChange<Node>[]) {
    for (const change of changes) {
      if (change.type === 'position' && change.id.startsWith('bus-') && !change.id.startsWith('bus-fader-') && change.position) {
        updateBusPosition(change.id.slice(4), change.position)
      }
    }
    void applyNodeChanges(changes, displayNodes)
  }

  function handlePaneClick(event: React.MouseEvent) {
    if (!placingSend) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      useSignalStore.getState().placeSend({
        x: (event.clientX - rect.left - viewport.x) / viewport.zoom,
        y: (event.clientY - rect.top - viewport.y) / viewport.zoom,
      })
    }
  }

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative ${placingSend ? 'cursor-crosshair' : 'cursor-grab'}`}
    >
      {placingSend && (
        <div
          style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 50,
            background: 'var(--lsc-node-bg)',
            border: '1px solid var(--lsc-border)',
            borderRadius: 'var(--lsc-radius-md)',
            padding: '6px 14px', fontSize: 12, color: 'var(--lsc-fg-dim)',
            pointerEvents: 'none',
            boxShadow: 'var(--lsc-shadow-popup)',
            whiteSpace: 'nowrap',
          }}
        >
          Click anywhere to place the{' '}
          <strong style={{ color: 'var(--lsc-fg)' }}>
            {placingSend.busType === 'aux' ? 'Aux Bus'
              : placingSend.busType === 'fx' ? 'FX Bus'
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
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodesChange={handleNodesChange}
        onPaneClick={handlePaneClick}
        onMove={(_e, vp) => setViewport(vp)}
        onKeyDown={(e) => { if (e.key === 'Escape') cancelSend() }}
        nodeOrigin={[0, 0.5]}
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
    </div>
  )
}
