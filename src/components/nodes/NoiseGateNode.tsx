import type { NodeProps, Node } from '@xyflow/react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal } from '../../hooks/useGraphSignal'
import { getHealth } from '../../signal/levels'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useParams } from '../../hooks/useParams'
import { twoColumns } from '../../utils/twoColumns'
import { KnobStack, ReductionReadout, TransferCurve } from './DynamicsLayout'
import { noiseGate } from '../../signal/process'

interface GraphNoiseGateData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function NoiseGateNode({ id, data }: NodeProps<Node<GraphNoiseGateData>>) {
  const { stages }       = useGraphSignal()
  const p                = useParams(id, 'noise-gate')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()
  const tg               = t.nodes['noise-gate']

  const threshold  = p('thresholdDb')
  const range      = p('rangeDb')
  // Shown and stored, but timings are not part of the sound yet
  const holdMs     = p('holdMs')
  const attackMs   = p('attackMs')
  const releaseMs  = p('releaseMs')
  const levels     = useStereoLevels(id)
  const inputLevel = levels.inPeak
  const result     = stages[id]
  const isOpen     = isFinite(inputLevel) && inputLevel >= threshold

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="noise-gate"
      label={data.label ?? tg.label}
    >
      <div style={twoColumns}>
        <SignalMeter db={levels.in} dbR={levels.inR} health={getHealth(levels.inPeak, levels.inDomain)} domain={levels.inDomain} label={t.meters.input} />
        <SignalMeter db={levels.out} dbR={levels.outR} domain={levels.outDomain} health={result?.health ?? 'too-quiet'} label={t.meters.output} />

        <KnobStack>
          <KnobControl
            value={threshold}
            min={-80}
            max={0}
            step={1}
            label={tg.threshold}
            formatValue={(v) => `${v} dB`}
            onChange={(v) => updateNodeParams(id, { thresholdDb: v })}
            color={isOpen ? 'var(--signal-good)' : 'var(--signal-hot)'}
            size={44}
            layout="side"
          />
          {/* How far it turns down when closed: −80 dB = silence */}
          <KnobControl
            value={range}
            min={-80}
            max={0}
            step={1}
            label={tg.range}
            formatValue={(v) => `${v} dB`}
            onChange={(v) => updateNodeParams(id, { rangeDb: v })}
            color="var(--signal-hot)"
            size={44}
            layout="side"
          />
          <KnobControl
            value={holdMs}
            min={0}
            max={500}
            step={5}
            label={tg.hold}
            formatValue={(v) => `${v} ms`}
            onChange={(v) => updateNodeParams(id, { holdMs: v })}
            color="var(--lsc-accent)"
            size={44}
            layout="side"
          />
        </KnobStack>

        <div>
          {/* Below the threshold turned down by the Range, from it on 1:1: the hard step is the gate */}
          <TransferCurve
            transfer={noiseGate(threshold, range)}
            thresholdDb={threshold}
            inputDb={inputLevel}
            badge={isOpen
              ? { text: tg.statusOpen, color: 'var(--signal-good)', opacity: 1 }
              : { text: tg.statusClosed, color: 'var(--lsc-fg)', opacity: 0.45 }}
            pointColor={isOpen ? 'var(--signal-good)' : 'var(--lsc-fg)'}
            pointOpacity={isOpen ? 1 : 0.5}
          />
          <ReductionReadout db={result?.gainReductionDb ?? 0} maxDb={80} label={t.nodes.comp.turningDown} style={{ marginTop: 12 }} />
        </div>

        {/* How fast it opens (Attack) and closes again (Release) */}
        <KnobControl
          value={attackMs}
          min={1}
          max={50}
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
