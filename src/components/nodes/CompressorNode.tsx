import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { ParamKnob } from '../controls/ParamKnob'
import { useStage } from '../../hooks/useGraphSignal'
import { louderSide } from '../../signal/engine'
import { SILENT } from '../../signal/levels'
import { graphOf } from '../../graph/graph'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useParams } from '../../hooks/useParams'
import { twoColumns } from '../../utils/twoColumns'
import { AttackRelease, DYNAMICS_KNOB, KnobStack, ReductionReadout, TransferCurve } from './DynamicsLayout'
import { MeterSides } from './MeterSides'
import { compressor } from '../../signal/process'

export function CompressorNode({ id }: CardProps) {
  const p                = useParams(id, 'comp')
  const { t }            = useTranslation()

  const levels      = useStereoLevels(id)
  const result      = useStage(id)
  const bypassed    = useSignalStore((s) => graphOf(s).node(id)?.bypassed ?? false)
  const threshold   = p('thresholdDb')
  const ratio       = p('ratio')
  const makeupGain  = p('makeupGainDb')
  const gainReduction = result?.gainReductionDb ?? 0

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="comp"
      label={useNodeName(id, 'comp')}
    >
      <MeterSides nodeId={id}>
        <div style={twoColumns}>
          <KnobStack>
            <ParamKnob
              nodeId={id}
              typeKey="comp"
              param="thresholdDb"
              min={-60}
              max={0}
              step={0.5}
              label={t.nodes.comp.threshold}
              formatValue={(v) => `${v} dB`}
              color="var(--signal-hot)"
              size={DYNAMICS_KNOB}
              layout="side"
            />
            <ParamKnob
              nodeId={id}
              typeKey="comp"
              param="ratio"
              min={1}
              max={20}
              step={0.5}
              label={t.nodes.comp.ratio}
              formatValue={(v) => `${v}:1`}
              color="var(--lsc-accent)"
              size={DYNAMICS_KNOB}
              layout="side"
            />
            <ParamKnob
              nodeId={id}
              typeKey="comp"
              param="makeupGainDb"
              min={0}
              max={20}
              step={0.5}
              label={t.nodes.comp.makeupGain}
              formatValue={(v) => `+${v} dB`}
              color="var(--signal-good)"
              size={DYNAMICS_KNOB}
              layout="side"
            />
          </KnobStack>

          <div>
            <TransferCurve
              nodeId={id}
              transfer={compressor(threshold, ratio, makeupGain)}
              thresholdDb={threshold}
              signal={result ? louderSide(result.in) : SILENT}
              leaving={result && !bypassed ? louderSide(result.out) : undefined}
              domain={levels.inDomain}
            />
            <ReductionReadout nodeId={id} db={gainReduction} maxDb={20} label={t.nodes.comp.turningDown} style={{ marginTop: 12 }} />
          </div>

          {/* How fast it starts turning down (Attack) and lets go again (Release) */}
          <AttackRelease nodeId={id} typeKey="comp" attack={{ min: 1, max: 100, step: 1 }} release={{ min: 10, max: 1000, step: 10 }} />
        </div>
      </MeterSides>
    </NodeWrapper>
  )
}
