import type { NodeProps, Node } from '@xyflow/react'
import { Minimize2 } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { CompressorCurve } from '../controls/CompressorCurve'
import { SignalMeter } from '../SignalMeter'
import { useMultiChannelSignal, getHealth, DEFAULT_COMP } from '../../hooks/useSignalChain'
import type { CompressorResult } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import type { ChannelNodeData } from './nodeTypes'

const RATIOS = [2, 4, 8, 100] as const
const RATIO_LABELS: Record<number, string> = { 2: '2:1', 4: '4:1', 8: '8:1', 100: '∞:1' }

export function CompressorNode({ id, data }: NodeProps<Node<ChannelNodeData>>) {
  const { allStages, allInputDb } = useMultiChannelSignal()
  const channel = useSignalStore((s) => s.channels.find((c) => c.id === data.channelId))
  const updateChannelNodeState = useSignalStore((s) => s.updateChannelNodeState)
  const { t } = useTranslation()

  const nodeState = channel?.nodeState
  const input = allInputDb[id] ?? -Infinity
  const comp = (allStages[id] as CompressorResult) ?? DEFAULT_COMP

  if (!nodeState) return null

  return (
    <NodeWrapper
      nodeId={id}
      channelId={data.channelId}
      typeKey="comp"
      accentColor={data.color}
      icon={<Minimize2 size={14} />}
      label={t.nodes.comp.label}
    >
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        <CompressorCurve
          thresholdDb={nodeState.compThresholdDb}
          ratio={nodeState.compRatio}
          makeupGainDb={nodeState.compMakeupGainDb}
          inputDb={input}
          height={72}
        />

        <div className="flex justify-around py-1">
          <KnobControl
            value={nodeState.compThresholdDb}
            min={-60}
            max={0}
            label={t.nodes.comp.threshold}
            formatValue={(v) => `${v}dBu`}
            onChange={(v) => updateChannelNodeState(data.channelId, { compThresholdDb: v })}
            color="var(--signal-hot)"
            size={48}
          />
          <KnobControl
            value={nodeState.compMakeupGainDb}
            min={0}
            max={20}
            label={t.nodes.comp.makeupGain}
            formatValue={(v) => `+${v}dB`}
            onChange={(v) => updateChannelNodeState(data.channelId, { compMakeupGainDb: v })}
            color="var(--signal-good)"
            size={48}
          />
        </div>

        {/* Ratio selector */}
        <div className="nodrag space-y-1">
          <span className="text-[10px]" style={{ color: 'var(--lsc-fg-dim)' }}>
            {t.nodes.comp.ratio}
          </span>
          <div className="flex gap-1">
            {RATIOS.map((r) => (
              <button
                key={r}
                onClick={() => updateChannelNodeState(data.channelId, { compRatio: r })}
                className="flex-1 rounded text-[10px] py-1 font-semibold transition-colors"
                style={{
                  background: nodeState.compRatio === r ? 'var(--lsc-accent)' : 'var(--lsc-sunken)',
                  border: `1px solid ${nodeState.compRatio === r ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
                  color: nodeState.compRatio === r ? 'white' : 'var(--lsc-fg-dim)',
                  cursor: 'pointer',
                }}
              >
                {RATIO_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {/* GR readout */}
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: 'var(--lsc-fg-dim)' }}>
            {t.nodes.comp.gainReduction}
          </span>
          <span
            className="text-[10px] font-mono font-semibold"
            style={{ color: comp.gainReductionDb > 6 ? 'var(--signal-hot)' : 'var(--lsc-fg)' }}
          >
            -{comp.gainReductionDb.toFixed(1)} dB
          </span>
        </div>

        <SignalMeter db={comp.out} health={comp.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
