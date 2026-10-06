import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { useStage } from '../../hooks/useGraphSignal'
import { curveInputOf } from '../../signal/engine'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useParams } from '../../hooks/useParams'
import { twoColumns } from '../../utils/twoColumns'
import { KnobStack, ReductionReadout, TransferCurve } from './DynamicsLayout'
import { MeterSides } from './MeterSides'
import { limiter } from '../../signal/process'

/** At a moment of the loop the limiter is limiting while it turns down more than this (dB) */
const LIMITING_DB = 0.5

export function LimiterNode({ id }: CardProps) {
  const p                = useParams(id, 'limiter')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const ceiling       = p('thresholdDb')
  const makeupGain    = p('makeupGainDb')
  const levels        = useStereoLevels(id)
  const result        = useStage(id)
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
            <KnobControl
              value={ceiling}
              min={-20}
              max={0}
              step={0.5}
              label={t.nodes.limiter.ceiling}
              formatValue={(v) => `${v} dB`}
              onChange={(v) => updateNodeParams(id, { thresholdDb: v })}
              color="var(--signal-hot)"
              size={44}
              layout="side"
            />
            <KnobControl
              value={makeupGain}
              min={0}
              max={20}
              step={0.5}
              label={t.nodes.limiter.makeupGain}
              formatValue={(v) => `+${v} dB`}
              onChange={(v) => updateNodeParams(id, { makeupGainDb: v })}
              color="var(--signal-good)"
              size={44}
              layout="side"
            />
          </KnobStack>

          <div>
            {/* Below the ceiling 1:1, at it a flat line: the brick wall (a compressor only leans over) */}
            <TransferCurve
              nodeId={id}
              transfer={limiter(ceiling, makeupGain)}
              thresholdDb={ceiling}
              signal={curveInputOf(result)}
              leaving={result?.curveOut}
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
