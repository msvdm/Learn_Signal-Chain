import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'
import { useStage } from '../../hooks/useGraphSignal'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useParams } from '../../hooks/useParams'
import { twoColumnCard, twoColumns } from '../../utils/twoColumns'
import { KnobStack, ReductionReadout } from './DynamicsLayout'

export function DeesserNode({ id }: CardProps) {
  const p                = useParams(id, 'deesser')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const threshold  = p('thresholdDb')
  const frequency  = p('frequencyHz')
  const levels     = useStereoLevels(id)
  const result     = useStage(id)
  const gr         = result?.gainReductionDb ?? 0
  const isActive   = gr > 0.1

  function formatFreq(hz: number): string {
    return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${hz}`
  }

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="deesser"
      style={twoColumnCard}
      label={useNodeName(id, 'deesser')}
    >
      <div style={twoColumns}>
        <SignalMeter {...levels.input} label={t.meters.input} />
        <SignalMeter {...levels.output} label={t.meters.output} />

        <KnobStack>
          <KnobControl
            value={threshold}
            min={-60}
            max={0}
            label={t.nodes.deesser.threshold}
            formatValue={(v) => `${v} dB`}
            onChange={(v) => updateNodeParams(id, { thresholdDb: v })}
            color={isActive ? 'var(--signal-hot)' : 'var(--signal-good)'}
            size={44}
            layout="side"
          />
          <KnobControl
            value={frequency}
            min={2000}
            max={12000}
            step={100}
            label={t.nodes.deesser.frequency}
            formatValue={(v) => `${formatFreq(v)} Hz`}
            onChange={(v) => updateNodeParams(id, { frequencyHz: v })}
            color="var(--lsc-accent)"
            size={44}
            layout="side"
          />
        </KnobStack>

        <ReductionReadout db={gr} maxDb={12} label={t.nodes.deesser.gainReduction} />
      </div>
    </NodeWrapper>
  )
}
