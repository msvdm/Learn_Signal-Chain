import type { NodeProps, Node } from '@xyflow/react'
import { Cable } from 'lucide-react'
import { NodeWrapper, ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useMultiChannelSignal } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import type { ChannelNodeData } from './nodeTypes'

export function LineInputNode({ id, data }: NodeProps<Node<ChannelNodeData>>) {
  const { allStages } = useMultiChannelSignal()
  const channel = useSignalStore((s) => s.channels.find((c) => c.id === data.channelId))
  const updateChannelNodeState = useSignalStore((s) => s.updateChannelNodeState)

  const nodeState = channel?.nodeState
  const result = allStages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  if (!nodeState) return null

  return (
    <NodeWrapper
      nodeId={id}
      channelId={data.channelId}
      typeKey="source"
      accentColor={data.color}
      icon={<Cable size={14} />}
      label={data.label ?? 'Line Input'}
      hasTarget={false}
    >
      <div className="space-y-2">
        <SignalMeter db={result.out} health={result.health} label="Output" />
        <ControlSlider
          value={nodeState.lineInputDb}
          min={-20}
          max={4}
          step={0.5}
          label="Input level"
          formatValue={(v) => `${v >= 0 ? '+' : ''}${v} dBu`}
          onChange={(v) => updateChannelNodeState(data.channelId, { lineInputDb: v })}
        />
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--lsc-text)' }}>
          +4 dBu = professional level. −10 dBu = consumer gear.
        </p>
      </div>
    </NodeWrapper>
  )
}
