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
import { DYNAMICS_KNOB_BIG, KnobStack, ReductionReadout, TransferCurve } from './DynamicsLayout'
import { MeterSides } from './MeterSides'
import { limiter } from '../../signal/process'

/** At a moment of the loop the limiter is limiting while it turns down more than this (dB) */
const LIMITING_DB = 0.5

export function LimiterNode({ id }: CardProps) {
  const p                = useParams(id, 'limiter')
  const { t }            = useTranslation()

  const ceiling       = p('thresholdDb')
  const makeupGain    = p('makeupGainDb')
  const levels        = useStereoLevels(id)
  const result        = useStage(id)
  const bypassed      = useSignalStore((s) => graphOf(s).node(id)?.bypassed ?? false)
  const gainReduction = result?.gainReductionDb ?? 0
  const limiting      = gainReduction > 0

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="limiter"
      label={useNodeName(id, 'limiter')}
    >
      <MeterSides nodeId={id}>
        <div style={twoColumns}>
          <KnobStack>
            <ParamKnob
              nodeId={id}
              typeKey="limiter"
              param="thresholdDb"
              min={-20}
              max={0}
              step={0.5}
              label={t.nodes.limiter.ceiling}
              formatValue={(v) => `${v} dB`}
              color="var(--signal-hot)"
              size={DYNAMICS_KNOB_BIG}
              layout="side"
            />
            <ParamKnob
              nodeId={id}
              typeKey="limiter"
              param="makeupGainDb"
              min={0}
              max={20}
              step={0.5}
              label={t.nodes.limiter.makeupGain}
              formatValue={(v) => `+${v} dB`}
              color="var(--signal-good)"
              size={DYNAMICS_KNOB_BIG}
              layout="side"
            />
          </KnobStack>

          <div>
            {/* Below the ceiling 1:1, at it a flat line: the brick wall (a compressor only leans over) */}
            <TransferCurve
              nodeId={id}
              transfer={limiter(ceiling, makeupGain)}
              thresholdDb={ceiling}
              signal={result ? louderSide(result.in) : SILENT}
              leaving={result && !bypassed ? louderSide(result.out) : undefined}
              domain={levels.inDomain}
              ceilingDb={ceiling + makeupGain}
              state={{
                on:  { text: t.nodes.limiter.limiting, color: 'var(--signal-hot)', opacity: 1, ring: 'var(--signal-hot)' },
                off: { text: t.nodes.limiter.pass, color: 'var(--lsc-fg)', opacity: 0.4, ring: 'var(--lsc-accent)' },
                active: limiting,
                // Limiting at a moment: a peak caught, that moment turned down
                activeAt: (reductionDb) => reductionDb > LIMITING_DB,
              }}
            />
            <ReductionReadout nodeId={id} db={gainReduction} maxDb={20} label={t.nodes.comp.turningDown} style={{ marginTop: 12 }} />
          </div>
        </div>
      </MeterSides>
    </NodeWrapper>
  )
}
