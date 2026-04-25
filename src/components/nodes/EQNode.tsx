import type { NodeProps, Node } from '@xyflow/react'
import { Activity } from 'lucide-react'
import { NodeWrapper, ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { KnobControl } from '../controls/KnobControl'
import { EQInlineGraph } from '../controls/EQInlineGraph'
import { useMultiChannelSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import type { ChannelNodeData } from './nodeTypes'

const BAND_COLORS = ['#6366f1', '#f59e0b', '#10b981']

export function EQNode({ id, data }: NodeProps<Node<ChannelNodeData>>) {
  const { allStages, allInputDb } = useMultiChannelSignal()
  const channel = useSignalStore((s) => s.channels.find((c) => c.id === data.channelId))
  const updateChannelNodeState = useSignalStore((s) => s.updateChannelNodeState)
  const updateChannelEQBand = useSignalStore((s) => s.updateChannelEQBand)
  const { t } = useTranslation()

  const nodeState = channel?.nodeState
  const input = allInputDb[id] ?? -Infinity
  const result = allStages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  if (!nodeState) return null

  return (
    <NodeWrapper
      nodeId={id}
      channelId={data.channelId}
      typeKey="eq"
      accentColor={data.color}
      icon={<Activity size={14} />}
      label={t.nodes.eq.label}
    >
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        <EQInlineGraph
          bands={nodeState.eqBands}
          hpfHz={nodeState.eqHpfHz}
          onBandChange={(index, patch) => updateChannelEQBand(data.channelId, index, patch)}
          height={80}
        />

        <ControlSlider
          value={nodeState.eqHpfHz}
          min={20}
          max={500}
          label={t.nodes.eq.highPass}
          formatValue={(v) => `${v} Hz`}
          onChange={(v) => updateChannelNodeState(data.channelId, { eqHpfHz: v })}
        />

        <div className="flex justify-around py-1">
          {nodeState.eqBands.map((band, i) => (
            <KnobControl
              key={i}
              value={band.gainDb}
              min={-12}
              max={12}
              step={0.5}
              label={`${band.freqHz >= 1000 ? `${band.freqHz / 1000}k` : band.freqHz}Hz`}
              formatValue={(v) => `${v >= 0 ? '+' : ''}${v}dB`}
              onChange={(v) => updateChannelEQBand(data.channelId, i, { gainDb: v })}
              color={BAND_COLORS[i]}
              size={44}
            />
          ))}
        </div>

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
