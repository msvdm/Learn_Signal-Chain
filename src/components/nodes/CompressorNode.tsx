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
import { twoColumns } from '../../utils/twoColumns'
import { KnobStack, ReductionReadout, TransferCurve } from './DynamicsLayout'
import { compressor } from '../../signal/process'

export function CompressorNode({ id }: CardProps) {
  const p                = useParams(id, 'comp')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const levels      = useStereoLevels(id)
  const result      = useStage(id)
  const threshold   = p('thresholdDb')
  const ratio       = p('ratio')
  const makeupGain  = p('makeupGainDb')
  // Shown and stored, but not part of the sound yet
  const attackMs    = p('attackMs')
  const releaseMs   = p('releaseMs')
  const gainReduction = result?.gainReductionDb ?? 0

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="comp"
      label={useNodeName(id, 'comp')}
    >
      <div style={twoColumns}>
        <SignalMeter db={levels.in} dbR={levels.inR} health={levels.inHealth} domain={levels.inDomain} label={t.meters.input} />
        <SignalMeter db={levels.out} dbR={levels.outR} domain={levels.outDomain} health={result?.health ?? 'too-quiet'} label={t.meters.output} />

        <KnobStack>
          <KnobControl
            value={threshold}
            min={-60}
            max={0}
            step={0.5}
            label={t.nodes.comp.threshold}
            formatValue={(v) => `${v} dB`}
            onChange={(v) => updateNodeParams(id, { thresholdDb: v })}
            color="var(--signal-hot)"
            size={44}
            layout="side"
          />
          <KnobControl
            value={ratio}
            min={1}
            max={20}
            step={0.5}
            label={t.nodes.comp.ratio}
            formatValue={(v) => `${v}:1`}
            onChange={(v) => updateNodeParams(id, { ratio: v })}
            color="var(--lsc-accent)"
            size={44}
            layout="side"
          />
          <KnobControl
            value={makeupGain}
            min={0}
            max={20}
            step={0.5}
            label={t.nodes.comp.makeupGain}
            formatValue={(v) => `+${v} dB`}
            onChange={(v) => updateNodeParams(id, { makeupGainDb: v })}
            color="var(--signal-good)"
            size={44}
            layout="side"
          />
        </KnobStack>

        <div>
          <TransferCurve
            transfer={compressor(threshold, ratio, makeupGain)}
            thresholdDb={threshold}
            inputDb={levels.inLevel}
            outMaxDb={20}
          />
          <ReductionReadout db={gainReduction} maxDb={20} label={t.nodes.comp.turningDown} style={{ marginTop: 12 }} />
        </div>

        {/* How fast it starts turning down (Attack) and lets go again (Release) */}
        <KnobControl
          value={attackMs}
          min={1}
          max={100}
          step={1}
          label={t.nodes.comp.attack}
          formatValue={(v) => `${v} ms`}
          onChange={(v) => updateNodeParams(id, { attackMs: v })}
          color="var(--lsc-accent)"
          size={44}
          layout="side"
        />
        <KnobControl
          value={releaseMs}
          min={10}
          max={1000}
          step={10}
          label={t.nodes.comp.release}
          formatValue={(v) => `${v} ms`}
          onChange={(v) => updateNodeParams(id, { releaseMs: v })}
          color="var(--lsc-accent)"
          size={44}
          layout="side"
        />
      </div>
    </NodeWrapper>
  )
}
