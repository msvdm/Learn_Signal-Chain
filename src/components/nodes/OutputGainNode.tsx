import { Gauge } from 'lucide-react'
import { NodeWrapper, ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

export function OutputGainNode({ id }: { id: string }) {
  const { stages, inputDb } = useSignalChain()
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateNodeState = useSignalStore((s) => s.updateNodeState)
  const { t } = useTranslation()

  const input = inputDb[id] ?? -Infinity
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  return (
    <NodeWrapper nodeId={id} icon={<Gauge size={14} />} label="Output Gain">
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        <ControlSlider
          value={nodeState.outputGainDb}
          min={-12}
          max={6}
          step={0.5}
          label="Gain trim"
          formatValue={(v) => `${v >= 0 ? '+' : ''}${v} dB`}
          onChange={(v) => updateNodeState({ outputGainDb: v })}
        />

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
