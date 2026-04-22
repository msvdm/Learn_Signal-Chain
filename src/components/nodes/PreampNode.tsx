import { Handle, Position } from '@xyflow/react'
import { Zap } from 'lucide-react'
import { NodeWrapper, ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'

export function PreampNode() {
  const { mic, preamp } = useSignalChain()
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateNodeState = useSignalStore((s) => s.updateNodeState)

  return (
    <NodeWrapper nodeId="preamp" icon={<Zap size={14} />} label="Preamp / Gain">
      <div className="space-y-2">
        <SignalMeter db={mic.out} health={mic.health} label="Input" />
        <ControlSlider
          value={nodeState.preampGainDb}
          min={0}
          max={60}
          label="Gain"
          formatValue={(v) => `+${v} dB`}
          onChange={(v) => updateNodeState({ preampGainDb: v })}
        />
        <SignalMeter db={preamp.out} health={preamp.health} label="Output" />
      </div>
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />
    </NodeWrapper>
  )
}
