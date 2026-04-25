import type { NodeProps, Node } from '@xyflow/react'
import { SlidersHorizontal } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { VerticalFader } from '../controls/VerticalFader'
import { SignalMeter } from '../SignalMeter'
import { useMultiChannelSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import type { ChannelNodeData } from './nodeTypes'

export function FaderNode({ id, data }: NodeProps<Node<ChannelNodeData>>) {
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
      typeKey="fader"
      accentColor={data.color}
      icon={<SlidersHorizontal size={14} />}
      label={t.nodes.fader.label}
    >
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        <VerticalFader
          value={nodeState.faderDb}
          min={-80}
          max={10}
          step={1}
          formatValue={(v) => (v <= -80 ? '−∞' : `${v >= 0 ? '+' : ''}${v} dB`)}
          onChange={(v) => updateChannelNodeState(data.channelId, { faderDb: v })}
        />

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
