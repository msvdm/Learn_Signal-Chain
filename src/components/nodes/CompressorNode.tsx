import type { CardProps } from './cardProps'
import { ONE_KNOB_MAX, isBareAt, oneKnobAt, oneKnobComp } from '../../data/nodeRegistry'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { ParamKnob } from '../controls/ParamKnob'
import { KnobControl } from '../controls/KnobControl'
import { StableText } from '../controls/StableText'
import { FreeControl } from './FreeControl'
import { widestFormat } from '../../utils/readout'
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

// The one knob below Advanced: the Gain's and Pan's size, big enough to read zoomed out
const KNOB = 110
/** Every knob on the card the Threshold's yellow, as the one knob below Advanced (the user's call, 2026-10-31) */
const KNOBS = 'var(--signal-hot)'

const formatAmount = (v: number) => `${v}`

/**
 * The Compressor. Advanced: its card — five knobs (Threshold, Ratio, Makeup gain, Attack, Release)
 * and its curve. Below: one bare knob, as on a small desk (data/nodeRegistry.ts oneKnobComp), with
 * how far it turns the signal down under it.
 */
export function CompressorNode({ id }: CardProps) {
  const oneKnob = useSignalStore((s) => isBareAt('comp', s.complexityLevel))
  return oneKnob ? <OneKnobCompressor id={id} /> : <CompressorCard id={id} />
}

/** One knob, 0 … 10: it sets the threshold, the ratio and the makeup gain together (and Attack / Release). */
function OneKnobCompressor({ id }: { id: string }) {
  const p                = useParams(id, 'comp')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const gainReduction    = useStage(id)?.gainReductionDb ?? 0
  const { t }            = useTranslation()
  const label  = useNodeName(id, 'comp')
  const amount = oneKnobAt(p('thresholdDb'))

  return (
    <FreeControl
      nodeId={id}
      typeKey="comp"
      label={label}
      portLine={KNOB / 2}
      textScale={2}
      value={<StableText reserve={[widestFormat(0, ONE_KNOB_MAX, 0.5, formatAmount)]} align="center">{formatAmount(amount)}</StableText>}
      // Like a desk's compression light: how far it turns the loud moments down
      footer={<ReductionReadout nodeId={id} db={gainReduction} maxDb={20} label={t.nodes.comp.turningDown} />}
    >
      <KnobControl
        value={amount} min={0} max={ONE_KNOB_MAX} step={0.5}
        label={label} formatValue={formatAmount}
        onChange={(v) => updateNodeParams(id, oneKnobComp(v))}
        color="var(--signal-hot)" size={KNOB} showReadout={false}
      />
    </FreeControl>
  )
}

function CompressorCard({ id }: { id: string }) {
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
      overviewSides
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
              color={KNOBS}
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
              color={KNOBS}
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
              color={KNOBS}
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
          <AttackRelease nodeId={id} typeKey="comp" attack={{ min: 1, max: 100, step: 1 }} release={{ min: 10, max: 1000, step: 10 }} color={KNOBS} />
        </div>
      </MeterSides>
    </NodeWrapper>
  )
}
