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

import { GraphMicNode }        from './nodes/GraphMicNode'
import { GraphGainNode }       from './nodes/GraphGainNode'
import { GraphFaderNode }      from './nodes/GraphFaderNode'
import { GraphMasterBusNode }  from './nodes/GraphMasterBusNode'
import { GraphAmpNode }        from './nodes/GraphAmpNode'
import { GraphSpeakerNode }    from './nodes/GraphSpeakerNode'
import { GraphGenericNode }    from './nodes/GraphGenericNode'
import { ChainEdge }           from './ChainEdge'

import { useSignalStore }      from '../store/signalStore'
import { useGraphSignal }      from '../hooks/useSignalChain'
import { getHealthStyle }      from '../hooks/useGainStaging'

// nodeTypes must be defined outside the component to avoid re-registration on every render
const nodeTypes = {
  mic:           GraphMicNode,
  'line-in':     GraphMicNode,
  instrument:    GraphMicNode,
  gain:          GraphGainNode,
  preamp:        GraphGainNode,
  amp:           GraphAmpNode,
  fader:         GraphFaderNode,
  'master-fader': GraphFaderNode,
  'master-bus':  GraphMasterBusNode,
  bus:           GraphGenericNode,
  hpf:           GraphGenericNode,
  eq:            GraphGenericNode,
  comp:          GraphGenericNode,
  switch:        GraphGenericNode,
  splitter:      GraphGenericNode,
  potentiometer: GraphGenericNode,
  'graphic-eq':  GraphGenericNode,
  speaker:       GraphSpeakerNode,
}

const edgeTypes = {
  chain: ChainEdge,
}

export function SignalChain() {
  const graphNodes         = useSignalStore((s) => s.nodes)
  const graphEdges         = useSignalStore((s) => s.edges)
  const updateNodePosition = useSignalStore((s) => s.updateNodePosition)
  const { stages }         = useGraphSignal()

  const displayNodes: Node[] = useMemo(
    () =>
      graphNodes.map((node) => ({
        id:       node.id,
        type:     node.typeKey,
        position: node.position,
        data:     { color: node.color, label: node.label, typeKey: node.typeKey },
        draggable: node.draggable,
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

  function handleNodesChange(changes: NodeChange<Node>[]) {
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        updateNodePosition(change.id, change.position)
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
        nodesDraggable={true}
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
      </ReactFlow>
    </div>
  )
}
