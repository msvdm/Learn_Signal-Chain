import type { NodeProps, Node } from '@xyflow/react'
import { Mic } from 'lucide-react'
import { NodeWrapper, ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useMultiChannelSignal } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import type { ChannelNodeData } from './nodeTypes'

export function MicrophoneNode({ id, data }: NodeProps<Node<ChannelNodeData>>) {
  const { allStages } = useMultiChannelSignal()
  const channel = useSignalStore((s) => s.channels.find((c) => c.id === data.channelId))
  const updateChannelNodeState = useSignalStore((s) => s.updateChannelNodeState)
  const { t } = useTranslation()

  const nodeState = channel?.nodeState
  const result = allStages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  if (!nodeState) return null

  return (
    <NodeWrapper
      nodeId={id}
      channelId={data.channelId}
      typeKey="source"
      accentColor={data.color}
      icon={<Mic size={14} />}
      label={data.label ?? t.nodes.mic.label}
      hasTarget={false}
    >
      <div className="space-y-2">
        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
        <ControlSlider
          value={nodeState.micSensitivityDb}
          min={-70}
          max={-40}
          label={t.nodes.mic.sensitivity}
          formatValue={(v) => `${v} dBu`}
          onChange={(v) => updateChannelNodeState(data.channelId, { micSensitivityDb: v })}
        />
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--lsc-text)' }}>
          {t.nodes.mic.micInfo}
        </p>
      </div>
    </NodeWrapper>
  )
}
