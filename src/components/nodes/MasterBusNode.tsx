import { Handle, Position } from '@xyflow/react'
import { Layers } from 'lucide-react'
import { NodeWrapper, ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'

export function MasterBusNode() {
  const { fader, master } = useSignalChain()
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateNodeState = useSignalStore((s) => s.updateNodeState)

  return (
    <NodeWrapper nodeId="master" icon={<Layers size={14} />} label="Master Bus">
      <div className="space-y-2">
        <SignalMeter db={fader.out} health={fader.health} label="Input" />

        <ControlSlider
          value={nodeState.masterTrimDb}
          min={-12}
          max={12}
          step={0.5}
          label="Output trim"
          formatValue={(v) => `${v >= 0 ? '+' : ''}${v} dB`}
          onChange={(v) => updateNodeState({ masterTrimDb: v })}
        />

        <SignalMeter db={master.out} health={master.health} label="Output" />

        <div className={`rounded-lg px-2 py-1.5 text-center text-[10px] font-semibold ${
          master.health === 'good'
            ? 'bg-green-50 text-green-700 border border-green-100'
            : master.health === 'clipping'
            ? 'bg-red-50 text-red-700 border border-red-100'
            : master.health === 'hot'
            ? 'bg-yellow-50 text-yellow-700 border border-yellow-100'
            : 'bg-blue-50 text-blue-700 border border-blue-100'
        }`}>
          {master.health === 'good' && 'Gain staging: Good'}
          {master.health === 'hot' && 'Signal is hot — watch headroom'}
          {master.health === 'clipping' && 'CLIPPING — reduce gain!'}
          {master.health === 'too-quiet' && 'Too quiet — increase gain'}
        </div>
      </div>
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />
    </NodeWrapper>
  )
}
