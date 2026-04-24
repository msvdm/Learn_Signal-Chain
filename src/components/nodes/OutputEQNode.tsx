import { Activity } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { EQInlineGraph } from '../controls/EQInlineGraph'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

const BAND_COLORS = ['#6366f1', '#f59e0b', '#10b981']

export function OutputEQNode({ id }: { id: string }) {
  const { stages, inputDb } = useSignalChain()
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateOutputEQBand = useSignalStore((s) => s.updateOutputEQBand)
  const { t } = useTranslation()

  const input = inputDb[id] ?? -Infinity
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  return (
    <NodeWrapper nodeId={id} icon={<Activity size={14} />} label="Output EQ">
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        <EQInlineGraph
          bands={nodeState.outputEqBands}
          hpfHz={20}
          onBandChange={updateOutputEQBand}
          height={80}
        />

        <div className="flex justify-around py-1">
          {nodeState.outputEqBands.map((band, i) => (
            <KnobControl
              key={i}
              value={band.gainDb}
              min={-12}
              max={12}
              step={0.5}
              label={`${band.freqHz >= 1000 ? `${band.freqHz / 1000}k` : band.freqHz}Hz`}
              formatValue={(v) => `${v >= 0 ? '+' : ''}${v}dB`}
              onChange={(v) => updateOutputEQBand(i, { gainDb: v })}
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
