import { Gauge } from 'lucide-react'
import { NodeWrapper, ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useMultiChannelSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

export function OutputGainNode({ id }: { id: string }) {
  const { masterStages, allInputDb } = useMultiChannelSignal()
  const masterState = useSignalStore((s) => s.masterState)
  const updateMasterState = useSignalStore((s) => s.updateMasterState)
  const { t } = useTranslation()

  const input = allInputDb[id] ?? -Infinity
  const result = masterStages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  return (
    <NodeWrapper nodeId={id} channelId="master" typeKey="output-gain" icon={<Gauge size={14} />} label="Output Gain">
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        <ControlSlider
          value={masterState.outputGainDb}
          min={-12}
          max={6}
          step={0.5}
          label="Gain trim"
          formatValue={(v) => `${v >= 0 ? '+' : ''}${v} dB`}
          onChange={(v) => updateMasterState({ outputGainDb: v })}
        />

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
