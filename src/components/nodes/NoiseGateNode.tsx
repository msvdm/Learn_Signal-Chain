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
import { noiseGate } from '../../signal/process'

/** At a moment of the loop the gate is open while it turns down less than this (dB) */
const GATE_OPEN_DB = 3

export function NoiseGateNode({ id }: CardProps) {
  const p                = useParams(id, 'noise-gate')
  const { t }            = useTranslation()
  const tg               = t.nodes['noise-gate']

  const threshold  = p('thresholdDb')
  const range      = p('rangeDb')
  const levels     = useStereoLevels(id)
  const inputLevel = levels.inLevel
  const result     = useStage(id)
  const bypassed   = useSignalStore((s) => graphOf(s).node(id)?.bypassed ?? false)
  const isOpen     = isFinite(inputLevel) && inputLevel >= threshold

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="noise-gate"
      label={useNodeName(id, 'noise-gate')}
    >
      <MeterSides nodeId={id}>
        <div style={twoColumns}>
          <KnobStack>
            <ParamKnob
              nodeId={id}
              typeKey="noise-gate"
              param="thresholdDb"
              min={-80}
              max={0}
              step={1}
              label={tg.threshold}
              formatValue={(v) => `${v} dB`}
              color={isOpen ? 'var(--signal-good)' : 'var(--signal-hot)'}
              size={DYNAMICS_KNOB}
              layout="side"
            />
            {/* How far it turns down when closed: −80 dB = silence */}
            <ParamKnob
              nodeId={id}
              typeKey="noise-gate"
              param="rangeDb"
              min={-80}
              max={0}
              step={1}
              label={tg.range}
              formatValue={(v) => `${v} dB`}
              color="var(--signal-hot)"
              size={DYNAMICS_KNOB}
              layout="side"
            />
            <ParamKnob
              nodeId={id}
              typeKey="noise-gate"
              param="holdMs"
              min={0}
              max={500}
              step={5}
              label={tg.hold}
              formatValue={(v) => `${v} ms`}
              color="var(--lsc-accent)"
              size={DYNAMICS_KNOB}
              layout="side"
            />
          </KnobStack>

          <div>
            {/* Below the threshold turned down by the Range, from it on 1:1: the hard step is the gate */}
            <TransferCurve
              nodeId={id}
              transfer={noiseGate(threshold, range)}
              thresholdDb={threshold}
              signal={result ? louderSide(result.in) : SILENT}
              leaving={result && !bypassed ? louderSide(result.out) : undefined}
              domain={levels.inDomain}
              state={{
                on:  { text: tg.statusOpen, color: 'var(--signal-good)', opacity: 1, ring: 'var(--signal-good)' },
                off: { text: tg.statusClosed, color: 'var(--lsc-fg)', opacity: 0.45, ring: 'var(--lsc-fg)', ringOpacity: 0.5 },
                active: isOpen,
                // Open at a moment: letting the sound through, turned down hardly at all
                activeAt: (reductionDb) => reductionDb < GATE_OPEN_DB,
              }}
            />
            <ReductionReadout nodeId={id} db={result?.gainReductionDb ?? 0} maxDb={80} label={t.nodes.comp.turningDown} style={{ marginTop: 12 }} />
          </div>

          {/* How fast it opens (Attack) and closes again (Release) */}
          <AttackRelease nodeId={id} typeKey="noise-gate" attack={{ min: 1, max: 50, step: 1 }} release={{ min: 10, max: 1000, step: 10 }} />
        </div>
      </MeterSides>
    </NodeWrapper>
  )
}
