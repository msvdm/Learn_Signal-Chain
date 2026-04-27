import { useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  type Edge,
  type Node,
  BackgroundVariant,
  MarkerType,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { GraphMicNode }            from './nodes/GraphMicNode'
import { GraphGainNode }           from './nodes/GraphGainNode'
import { GraphFaderNode }          from './nodes/GraphFaderNode'
import { GraphMasterBusNode }      from './nodes/GraphMasterBusNode'
import { GraphAmpNode }            from './nodes/GraphAmpNode'
import { GraphSpeakerNode }        from './nodes/GraphSpeakerNode'
import { GraphSwitchNode }         from './nodes/GraphSwitchNode'
import { GraphSplitterNode }       from './nodes/GraphSplitterNode'
import { GraphPotentiometerNode }  from './nodes/GraphPotentiometerNode'
import { GraphGenericNode }        from './nodes/GraphGenericNode'
import { ChainEdge }               from './ChainEdge'
import { AddSourcePanel }          from './AddSourcePanel'
import { InsertBusPanel }          from './InsertBusPanel'

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
  switch:        GraphSwitchNode,
  splitter:      GraphSplitterNode,
  potentiometer: GraphPotentiometerNode,
  'graphic-eq':  GraphGenericNode,
  speaker:       GraphSpeakerNode,
}

const edgeTypes = {
  chain: ChainEdge,
}

// Rendered inside ReactFlow — calls fitView when a bus node is added
function FitOnBusAdd() {
  const busCount = useSignalStore((s) => s.nodes.filter((n) => n.typeKey === 'bus').length)
  const { fitView } = useReactFlow()
  useEffect(() => {
    fitView({ padding: 0.25, duration: 300 })
  }, [busCount, fitView])
  return null
}

export function SignalChain() {
  const graphNodes = useSignalStore((s) => s.nodes)
  const graphEdges = useSignalStore((s) => s.edges)
  const { stages } = useGraphSignal()

  const displayNodes: Node[] = useMemo(
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
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
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
        <FitOnBusAdd />
        <AddSourcePanel />
        <InsertBusPanel />
      </ReactFlow>
    </div>
  )
}
