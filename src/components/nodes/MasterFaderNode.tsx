import { Sliders } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { VerticalFader } from '../controls/VerticalFader'
import { SignalMeter } from '../SignalMeter'
import { useMultiChannelSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

export function MasterFaderNode({ id }: { id: string }) {
  const { masterStages, allInputDb } = useMultiChannelSignal()
  const masterState = useSignalStore((s) => s.masterState)
  const updateMasterState = useSignalStore((s) => s.updateMasterState)
  const { t } = useTranslation()

  const input = allInputDb[id] ?? -Infinity
  const result = masterStages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  return (
    <NodeWrapper nodeId={id} channelId="master" typeKey="master-fader" icon={<Sliders size={14} />} label="Master Fader">
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        <VerticalFader
          value={masterState.masterFaderDb}
          min={-80}
          max={10}
          step={1}
          formatValue={(v) => (v <= -80 ? '−∞' : `${v >= 0 ? '+' : ''}${v} dB`)}
          onChange={(v) => updateMasterState({ masterFaderDb: v })}
        />

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
