import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  useReactFlow,
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
import { useTranslation } from '../i18n/useTranslation'
import { levels, PALETTE_NODES } from '../data/levels'
import { Zap, Activity, Minimize2, SlidersHorizontal, Layers } from 'lucide-react'

// Node types must be stable (outside component)
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

function makeNode(id: string, x: number, y = 0): Node {
  return {
    id,
    type: NODE_TYPE_MAP[id],
    position: { x, y },
    data: {},
  }
}

const INITIAL_NODES: Node[] = [
  makeNode('mic', 0),
  makeNode('preamp', 220),
  makeNode('eq', 440),
  makeNode('comp', 660),
  makeNode('fader', 880),
  makeNode('master', 1100),
  makeNode('speaker', 1320),
]

function buildEdge(source: string, target: string, healthColor: string): Edge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    animated: true,
    style: { stroke: healthColor, strokeWidth: 3 },
  }
}

const PALETTE_ICONS: Record<string, React.ReactNode> = {
  preamp: <Zap size={14} />,
  eq: <Activity size={14} />,
  comp: <Minimize2 size={14} />,
  fader: <SlidersHorizontal size={14} />,
  master: <Layers size={14} />,
}

function NodePalette() {
  const placedNodeIds = useSignalStore((s) => s.placedNodeIds)
  const { t } = useTranslation()

  const handleDragStart = (e: React.DragEvent, nodeId: string) => {
    e.dataTransfer.setData('application/reactflow-nodeid', nodeId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const unplaced = PALETTE_NODES.filter((n) => !placedNodeIds.includes(n.id))

  return (
    <div className="absolute left-4 top-4 z-20 w-40 rounded-xl border border-slate-200 bg-white shadow-lg p-3">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
        {t.palette.heading}
      </p>
      {unplaced.length === 0 ? (
        <p className="text-[10px] text-slate-400">{t.palette.empty}</p>
      ) : (
        <div className="space-y-1.5">
          {unplaced.map((n) => (
            <div
              key={n.id}
              draggable
              onDragStart={(e) => handleDragStart(e, n.id)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 cursor-grab text-xs text-slate-700 hover:border-slate-300 hover:bg-white transition-colors"
            >
              <span className="text-slate-400">{PALETTE_ICONS[n.id]}</span>
              {t.palette.nodes[n.id as keyof typeof t.palette.nodes]}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SignalChain() {
  const level = useSignalStore((s) => s.level)
  const addPlacedNode = useSignalStore((s) => s.addPlacedNode)
  const levelConfig = levels[level]
  const chain = useSignalChain()

  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  // Build edges with health-based colors for levels 1-2
  const computedEdges: Edge[] =
    level <= 2
      ? [
          buildEdge('mic', 'preamp', getHealthStyle(chain.mic.health).color),
          buildEdge('preamp', 'eq', getHealthStyle(chain.preamp.health).color),
          buildEdge('eq', 'comp', getHealthStyle(chain.eq.health).color),
          buildEdge('comp', 'fader', getHealthStyle(chain.comp.health).color),
          buildEdge('fader', 'master', getHealthStyle(chain.fader.health).color),
          buildEdge('master', 'speaker', getHealthStyle(chain.master.health).color),
        ]
      : edges

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge({ ...params, animated: true, style: { strokeWidth: 3 } } as Edge, eds)
      ),
    [setEdges]
  )

  const { screenToFlowPosition } = useReactFlow()

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const nodeId = e.dataTransfer.getData('application/reactflow-nodeid')
      if (!nodeId) return

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const newNode: Node = {
        id: nodeId,
        type: NODE_TYPE_MAP[nodeId],
        position,
        data: {},
      }

      setNodes((nds) => {
        const exists = nds.find((n) => n.id === nodeId)
        return exists ? nds : [...nds, newNode]
      })
      addPlacedNode(nodeId)
    },
    [screenToFlowPosition, setNodes, addPlacedNode]
  )

  // For levels 1-2: filter nodes to only visible ones and reset positions
  const displayNodes =
    level <= 2
      ? INITIAL_NODES.filter((n) => levelConfig.visibleNodes.includes(n.id))
      : nodes.filter((n) => levelConfig.visibleNodes.includes(n.id) || levelConfig.showPalette)

  const displayEdges = level <= 2 ? computedEdges : computedEdges

  return (
    <div ref={reactFlowWrapper} className="w-full h-full relative">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={level >= 3 ? onNodesChange : undefined}
        onEdgesChange={level >= 3 ? onEdgesChange : undefined}
        onConnect={level >= 3 ? onConnect : undefined}
        nodeTypes={nodeTypes}
        nodesDraggable={levelConfig.nodesDraggable}
        nodesConnectable={levelConfig.nodesConnectable}
        elementsSelectable={level >= 2}
        onDragOver={level >= 3 ? onDragOver : undefined}
        onDrop={level >= 3 ? onDrop : undefined}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const id = n.id
            const stageMap: Record<string, () => string> = {
              mic: () => getHealthStyle(chain.mic.health).color,
              preamp: () => getHealthStyle(chain.preamp.health).color,
              eq: () => getHealthStyle(chain.eq.health).color,
              comp: () => getHealthStyle(chain.comp.health).color,
              fader: () => getHealthStyle(chain.fader.health).color,
              master: () => getHealthStyle(chain.master.health).color,
              speaker: () => getHealthStyle(getHealth(chain.master.out)).color,
            }
            return stageMap[id]?.() ?? '#94a3b8'
          }}
          style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
        />
      </ReactFlow>

      {levelConfig.showPalette && <NodePalette />}
    </div>
  )
}
