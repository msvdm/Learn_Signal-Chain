import { useMemo } from 'react'
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

import { SourceNode } from './nodes/SourceNode'
import { PreampNode } from './nodes/PreampNode'
import { EQNode } from './nodes/EQNode'
import { CompressorNode } from './nodes/CompressorNode'
import { FaderNode } from './nodes/FaderNode'
import { MasterBusNode } from './nodes/MasterBusNode'
import { MasterFaderNode } from './nodes/MasterFaderNode'
import { OutputEQNode } from './nodes/OutputEQNode'
import { SpeakerNode } from './nodes/SpeakerNode'
import { BusNode } from './nodes/BusNode'
import { EndNode } from './nodes/EndNode'
import { ChainEdge } from './ChainEdge'
import { AddSourcePanel } from './AddSourcePanel'
import { InsertBusPanel } from './InsertBusPanel'

import { useSignalStore } from '../store/signalStore'
import { useMultiChannelSignal, getHealth } from '../hooks/useSignalChain'
import { getHealthStyle } from '../hooks/useGainStaging'

// Must be defined outside component to avoid re-registration on every render
const nodeTypes = {
  source:      SourceNode,
  preamp:      PreampNode,
  eq:          EQNode,
  compressor:  CompressorNode,
  fader:       FaderNode,
  masterBus:   MasterBusNode,
  masterFader: MasterFaderNode,
  outputEq:    OutputEQNode,
  speaker:     SpeakerNode,
  bus:         BusNode,
  end:         EndNode,
}

const edgeTypes = {
  chain: ChainEdge,
}

// Maps channel-level type-key → React Flow node type name
const CHANNEL_TYPE_MAP: Record<string, string> = {
  source:  'source',
  preamp:  'preamp',
  eq:      'eq',
  comp:    'compressor',
  fader:   'fader',
}

// Maps master-section node ID → React Flow node type name
const MASTER_TYPE_MAP: Record<string, string> = {
  'master-bus':   'masterBus',
  'master-fader': 'masterFader',
  'output-eq':    'outputEq',
  'speaker':      'speaker',
}

const MASTER_CHAIN = ['master-bus', 'master-fader', 'output-eq', 'speaker']

const H_SPACING       = 300
const V_SPACING       = 320
const MASTER_X_OFFSET = 80

function buildLayout(channels: ReturnType<typeof useSignalStore.getState>['channels']) {
  const maxColCount = Math.max(...channels.map((ch) => ch.chainOrder.length), 1)
  const masterX = maxColCount * H_SPACING + MASTER_X_OFFSET
  const masterY = ((channels.length - 1) * V_SPACING) / 2
  return { masterX, masterY, maxColCount }
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
  const channels    = useSignalStore((s) => s.channels)
  const buses       = useSignalStore((s) => s.buses)
  const sends       = useSignalStore((s) => s.sends)
  const updateBus   = useSignalStore((s) => s.updateBus)
  const { allStages } = useMultiChannelSignal()

  const { masterX, masterY } = useMemo(() => buildLayout(channels), [channels])

  const displayNodes: Node[] = useMemo(() => {
    const { masterX, masterY } = buildLayout(channels)
    const nodes: Node[] = []

    // Channel rows
    for (const ch of channels) {
      ch.chainOrder.forEach((typeKey, colIndex) => {
        const rfType = CHANNEL_TYPE_MAP[typeKey]
        if (!rfType) return
        nodes.push({
          id: `${ch.id}:${typeKey}`,
          type: rfType,
          position: { x: colIndex * H_SPACING, y: channels.indexOf(ch) * V_SPACING },
          data: {
            channelId: ch.id,
            typeKey,
            color: ch.color,
            label: ch.label,
            sourceType: ch.sourceType,
          },
          draggable: false,
        })
      })
    }

    // Master section (shared, vertically centered)
    let masterSectionX = masterX
    const masterChainInState = MASTER_CHAIN.filter((id) => id in MASTER_TYPE_MAP)
    for (const nodeId of masterChainInState) {
      nodes.push({
        id: nodeId,
        type: MASTER_TYPE_MAP[nodeId],
        position: { x: masterSectionX, y: masterY },
        data: { channelId: 'master' },
        draggable: false,
      })
      masterSectionX += H_SPACING
    }

    // Bus nodes
    for (const bus of buses) {
      nodes.push({
        id: `bus-${bus.id}`,
        type: 'bus',
        position: bus.position,
        data: { bus },
        draggable: true,
      })
    }

    return nodes
  }, [channels, buses])

  const displayEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = []

    // Channel-internal edges
    for (const ch of channels) {
      for (let i = 0; i < ch.chainOrder.length - 1; i++) {
        const srcTypeKey = ch.chainOrder[i]
        const tgtTypeKey = ch.chainOrder[i + 1]
        const srcId = `${ch.id}:${srcTypeKey}`
        const tgtId = `${ch.id}:${tgtTypeKey}`
        const stage = allStages[srcId]
        const healthColor = stage ? getHealthStyle(stage.health).color : 'var(--lsc-fg-fainter)'
        const isBypassed = ch.bypassedNodes.has(srcTypeKey)
        edges.push(buildChainEdge(srcId, tgtId, healthColor, isBypassed))
      }

      // Channel fader → master-bus (converging edge)
      const lastTypeKey = ch.chainOrder[ch.chainOrder.length - 1]
      const lastId = `${ch.id}:${lastTypeKey}`
      edges.push({
        id: `e-${lastId}-master-bus`,
        source: lastId,
        target: 'master-bus',
        type: 'smoothstep',
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: ch.color, width: 16, height: 16 },
        style: { stroke: ch.color, strokeWidth: 2, opacity: 0.75 },
      })
    }

    // Master-internal edges
    for (let i = 0; i < MASTER_CHAIN.length - 1; i++) {
      const src = MASTER_CHAIN[i]
      const tgt = MASTER_CHAIN[i + 1]
      if (!(src in MASTER_TYPE_MAP) || !(tgt in MASTER_TYPE_MAP)) continue
      const stage = allStages[src]
      const healthColor = stage ? getHealthStyle(stage.health).color : 'var(--lsc-fg-fainter)'
      edges.push(buildChainEdge(src, tgt, healthColor, false))
    }

    // Send edges: branch from the bottom of the source node (send-tap handle) → bus node
    for (const send of sends) {
      const bus = buses.find((b) => b.id === send.busId)
      if (!bus) continue
      const tapStage = allStages[send.fromNodeId]
      const tapHealth = tapStage ? getHealth(tapStage.out) : 'too-quiet'
      const tapColor = getHealthStyle(tapHealth).color
      edges.push({
        id: `send-edge-${send.id}`,
        source: send.fromNodeId,
        sourceHandle: 'send-tap',
        target: `bus-${bus.id}`,
        type: 'smoothstep',
        animated: true,
        style: { stroke: tapColor, strokeDasharray: '6 3', strokeWidth: 2, opacity: 0.8 },
        markerEnd: { type: MarkerType.ArrowClosed, color: tapColor, width: 14, height: 14 },
      })
    }

    return edges
  }, [channels, buses, sends, allStages])

  function handleNodesChange(changes: NodeChange<Node>[]) {
    for (const change of changes) {
      if (
        change.type === 'position' &&
        change.id.startsWith('bus-') &&
        change.position
      ) {
        // Extract bus ID (strip 'bus-' prefix)
        const busId = change.id.slice(4)
        updateBus(busId, { position: change.position })
      }
    }
    void applyNodeChanges(changes, displayNodes)
  }

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodesChange={handleNodesChange}
        nodeOrigin={[0, 0.5]}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.15}
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
        <AddSourcePanel />
        <InsertBusPanel masterX={masterX} masterY={masterY} />
      </ReactFlow>
    </div>
  )
}
