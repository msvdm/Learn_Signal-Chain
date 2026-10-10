import type { CardProps } from './cardProps'
import { ONE_KNOB_MAX, oneKnobAt, oneKnobComp } from '../../data/nodeRegistry'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { ParamKnob } from '../controls/ParamKnob'
import { KnobControl } from '../controls/KnobControl'
import { StableText } from '../controls/StableText'
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

// The one knob below Advanced: as big as its column lets it be
const ONE_KNOB_SIZE = 100

/**
 * The Compressor. Advanced: its five knobs (Threshold, Ratio, Makeup gain, Attack, Release) and its
 * curve. Below: one knob, as on a small desk (data/nodeRegistry.ts oneKnobComp), the three settings
 * it turns under it, and the same curve, which shows what the knob did.
 */
export function CompressorNode({ id }: CardProps) {
  const p                = useParams(id, 'comp')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const oneKnob          = useSignalStore((s) => s.complexityLevel !== 'advanced')
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
          {oneKnob ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <KnobControl
                value={oneKnobAt(threshold)} min={0} max={ONE_KNOB_MAX} step={0.5}
                label={t.nodes.comp.amount} formatValue={(v) => `${v}`}
                onChange={(v) => updateNodeParams(id, oneKnobComp(v))}
                color="var(--signal-hot)" size={ONE_KNOB_SIZE}
              />
              {/* What the one knob turned */}
              <div style={{ alignSelf: 'stretch', fontSize: 'var(--node-text-xs)', lineHeight: '20px' }}>
                <SetRow label={t.nodes.comp.threshold} value={`${threshold > 0 ? '+' : threshold < 0 ? '−' : ''}${Math.abs(threshold).toFixed(1)} dB`} reserve="+00.0 dB" />
                <SetRow label={t.nodes.comp.ratio} value={`${ratio.toFixed(1)}:1`} reserve="0.0:1" />
                <SetRow label={t.nodes.comp.makeupGain} value={`+${makeupGain.toFixed(1)} dB`} reserve="+0.0 dB" />
              </div>
            </div>
          ) : (
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
          )}

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

          {/* How fast it starts turning down (Attack) and lets go again (Release) — set for you below Advanced */}
          {!oneKnob && <AttackRelease nodeId={id} typeKey="comp" attack={{ min: 1, max: 100, step: 1 }} release={{ min: 10, max: 1000, step: 10 }} />}
        </div>
      </MeterSides>
    </NodeWrapper>
  )
}

/** One setting the one knob turned: its name, and its value (it keeps the width of its widest). */
function SetRow({ label, value, reserve }: { label: string; value: string; reserve: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ color: 'var(--lsc-fg-muted)' }}>{label}</span>
      <StableText reserve={[reserve]} align="end" style={{ fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-fg)', flexShrink: 0 }}>
        {value}
      </StableText>
    </div>
  )
}
