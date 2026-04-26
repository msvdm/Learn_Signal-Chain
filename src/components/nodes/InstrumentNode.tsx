import type { NodeProps, Node } from '@xyflow/react'
import { Guitar } from 'lucide-react'
import { NodeWrapper, ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useMultiChannelSignal } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import type { ChannelNodeData } from './nodeTypes'

export function InstrumentNode({ id, data }: NodeProps<Node<ChannelNodeData>>) {
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
      icon={<Guitar size={14} />}
      label={data.label ?? 'Instrument'}
      hasTarget={false}
    >
      <div className="space-y-2">
        <SignalMeter db={result.out} health={result.health} label="Output" />
        <ControlSlider
          value={nodeState.instrumentInputDb}
          min={-40}
          max={-10}
          step={1}
          label="Pickup level"
          formatValue={(v) => `${v} dBu`}
          onChange={(v) => updateChannelNodeState(data.channelId, { instrumentInputDb: v })}
        />
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--lsc-text)' }}>
          Instruments output a high-impedance signal. The preamp boosts it to line level.
        </p>
      </div>
    </NodeWrapper>
  )
}
