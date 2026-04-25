import type { NodeProps, Node } from '@xyflow/react'
import { Zap } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'
import { useMultiChannelSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import type { ChannelNodeData } from './nodeTypes'

export function PreampNode({ id, data }: NodeProps<Node<ChannelNodeData>>) {
  const { allStages, allInputDb } = useMultiChannelSignal()
  const channel = useSignalStore((s) => s.channels.find((c) => c.id === data.channelId))
  const updateChannelNodeState = useSignalStore((s) => s.updateChannelNodeState)
  const { t } = useTranslation()

  const nodeState = channel?.nodeState
  const input = allInputDb[id] ?? -Infinity
  const result = allStages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  if (!nodeState) return null

  return (
    <NodeWrapper
      nodeId={id}
      channelId={data.channelId}
      typeKey="preamp"
      accentColor={data.color}
      icon={<Zap size={14} />}
      label={t.nodes.preamp.label}
    >
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        <div className="flex justify-center py-1">
          <KnobControl
            value={nodeState.preampGainDb}
            min={0}
            max={60}
            label={t.nodes.preamp.gain}
            formatValue={(v) => `+${v} dB`}
            onChange={(v) => updateChannelNodeState(data.channelId, { preampGainDb: v })}
            color="var(--signal-good)"
            size={56}
          />
        </div>

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
