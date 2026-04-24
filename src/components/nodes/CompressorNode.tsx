import { Minimize2 } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { CompressorCurve } from '../controls/CompressorCurve'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain, getHealth, DEFAULT_COMP } from '../../hooks/useSignalChain'
import type { CompressorResult } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

const RATIOS = [2, 4, 8, 100] as const
const RATIO_LABELS: Record<number, string> = { 2: '2:1', 4: '4:1', 8: '8:1', 100: '∞:1' }

export function CompressorNode({ id }: { id: string }) {
  const { stages, inputDb } = useSignalChain()
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateNodeState = useSignalStore((s) => s.updateNodeState)
  const { t } = useTranslation()

  const input = inputDb[id] ?? -Infinity
  const comp = (stages[id] as CompressorResult) ?? DEFAULT_COMP

  return (
    <NodeWrapper nodeId={id} icon={<Minimize2 size={14} />} label={t.nodes.comp.label}>
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
            onChange={(v) => updateNodeState({ compThresholdDb: v })}
            color="var(--signal-hot)"
            size={48}
          />
          <KnobControl
            value={nodeState.compMakeupGainDb}
            min={0}
            max={20}
            label={t.nodes.comp.makeupGain}
            formatValue={(v) => `+${v}dB`}
            onChange={(v) => updateNodeState({ compMakeupGainDb: v })}
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
                onClick={() => updateNodeState({ compRatio: r })}
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
