import { Sliders } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { VerticalFader } from '../controls/VerticalFader'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

export function MasterFaderNode({ id }: { id: string }) {
  const { stages, inputDb } = useSignalChain()
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateNodeState = useSignalStore((s) => s.updateNodeState)
  const { t } = useTranslation()

  const input = inputDb[id] ?? -Infinity
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  return (
    <NodeWrapper nodeId={id} icon={<Sliders size={14} />} label="Master Fader">
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        <VerticalFader
          value={nodeState.masterFaderDb}
          min={-80}
          max={10}
          step={1}
          formatValue={(v) => (v <= -80 ? '−∞' : `${v >= 0 ? '+' : ''}${v} dB`)}
          onChange={(v) => updateNodeState({ masterFaderDb: v })}
        />

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
