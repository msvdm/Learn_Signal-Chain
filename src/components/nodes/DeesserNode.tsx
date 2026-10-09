import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { ParamKnob } from '../controls/ParamKnob'
import { useStage } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'
import { COLUMN_W } from '../../utils/twoColumns'
import { DYNAMICS_KNOB_BIG, KnobStack, ReductionReadout } from './DynamicsLayout'
import { MeterSides } from './MeterSides'

export function DeesserNode({ id }: CardProps) {
  const { t }      = useTranslation()

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
      label={useNodeName(id, 'deesser')}
    >
      <MeterSides nodeId={id}>
        {/* Its knobs, then how far it turns the "s" down */}
        <div style={{ width: COLUMN_W, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <KnobStack>
            <ParamKnob
              nodeId={id}
              typeKey="deesser"
              param="thresholdDb"
              min={-60}
              max={0}
              label={t.nodes.deesser.threshold}
              formatValue={(v) => `${v} dB`}
              color={isActive ? 'var(--signal-hot)' : 'var(--signal-good)'}
              size={DYNAMICS_KNOB_BIG}
              layout="side"
            />
            <ParamKnob
              nodeId={id}
              typeKey="deesser"
              param="frequencyHz"
              min={2000}
              max={12000}
              step={100}
              label={t.nodes.deesser.frequency}
              formatValue={(v) => `${formatFreq(v)} Hz`}
              color="var(--lsc-accent)"
              size={DYNAMICS_KNOB_BIG}
              layout="side"
            />
          </KnobStack>

          <ReductionReadout nodeId={id} db={gr} maxDb={12} label={t.nodes.deesser.gainReduction} />
        </div>
      </MeterSides>
    </NodeWrapper>
  )
}
