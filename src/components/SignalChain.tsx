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

import { MicNode }            from './nodes/MicNode'
import { GainNode }           from './nodes/GainNode'
import { FaderNode }          from './nodes/FaderNode'
import { MasterBusNode }      from './nodes/MasterBusNode'
import { AmpNode }            from './nodes/AmpNode'
import { SpeakerNode }        from './nodes/SpeakerNode'
import { SwitchNode }         from './nodes/SwitchNode'
import { SplitterNode }       from './nodes/SplitterNode'
import { PotentiometerNode }  from './nodes/PotentiometerNode'
import { GenericNode }        from './nodes/GenericNode'
import { HpfNode }           from './nodes/HpfNode'
import { EQNode }             from './nodes/EQNode'
import { GraphicEQNode }      from './nodes/GraphicEQNode'
import { ConnPointNode }           from './nodes/ConnPointNode'
import { ChainEdge }               from './ChainEdge'
import { AddSourcePanel }          from './AddSourcePanel'
import { InsertBusPanel }          from './InsertBusPanel'
import { SplitDrawOverlay }        from './SplitDrawOverlay'

import { useSignalStore }      from '../store/signalStore'
import { useGraphSignal }      from '../hooks/useSignalChain'
import { getHealthStyle }      from '../hooks/useGainStaging'

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
  splitter:      SplitterNode,
  potentiometer: PotentiometerNode,
  'graphic-eq':  GraphicEQNode,
  speaker:       SpeakerNode,
  'conn-point':  ConnPointNode,
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
        <SplitDrawOverlay />
      </ReactFlow>
    </div>
  )
}
