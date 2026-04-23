import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { MicrophoneNode } from './nodes/MicrophoneNode'
import { PreampNode } from './nodes/PreampNode'
import { EQNode } from './nodes/EQNode'
import { CompressorNode } from './nodes/CompressorNode'
import { FaderNode } from './nodes/FaderNode'
import { MasterBusNode } from './nodes/MasterBusNode'
import { SpeakerNode } from './nodes/SpeakerNode'

import { useSignalStore } from '../store/signalStore'
import { useSignalChain, getHealth } from '../hooks/useSignalChain'
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

// Fixed horizontal positions for each stage
const NODE_X: Record<string, number> = {
  mic: 0,
  preamp: 240,
  eq: 480,
  comp: 720,
  fader: 960,
  master: 1200,
  speaker: 1440,
}

function makeNode(id: string): Node {
  return {
    id,
    type: NODE_TYPE_MAP[id],
    position: { x: NODE_X[id], y: 0 },
    data: {},
  }
}

const ALL_NODES: Node[] = CHAIN_ORDER.map(makeNode)

function buildEdge(source: string, target: string, healthColor: string): Edge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    animated: true,
    style: { stroke: healthColor, strokeWidth: 3 },
  }
}

export function SignalChain() {
  const unlockedNodes = useSignalStore((s) => s.unlockedNodes)
  const chain = useSignalChain()

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_nodes, _setNodes, onNodesChange] = useNodesState(ALL_NODES)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_edges, _setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Filter to only unlocked nodes in chain order
  const displayNodes = CHAIN_ORDER
    .filter((id) => unlockedNodes.includes(id))
    .map((id) => ALL_NODES.find((n) => n.id === id)!)
    .filter(Boolean)

  // Health color per source node
  const healthColorMap: Record<string, string> = {
    mic: getHealthStyle(chain.mic.health).color,
    preamp: getHealthStyle(chain.preamp.health).color,
    eq: getHealthStyle(chain.eq.health).color,
    comp: getHealthStyle(chain.comp.health).color,
    fader: getHealthStyle(chain.fader.health).color,
    master: getHealthStyle(getHealth(chain.master.out)).color,
  }

  // Build edges between consecutive unlocked nodes
  const displayEdges: Edge[] = []
  for (let i = 0; i < displayNodes.length - 1; i++) {
    const src = displayNodes[i].id
    const tgt = displayNodes[i + 1].id
    displayEdges.push(buildEdge(src, tgt, healthColorMap[src] ?? 'var(--lsc-fg-fainter)'))
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
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
