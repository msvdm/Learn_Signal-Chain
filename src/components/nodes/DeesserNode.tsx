import type { NodeProps, Node } from '@xyflow/react'
import { AudioWaveform } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import type { DeesserResult } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { twoColumnCard, twoColumns } from '../../utils/twoColumns'
import { KnobStack, ReductionReadout } from './DynamicsLayout'

interface GraphDeesserData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function DeesserNode({ id, data }: NodeProps<Node<GraphDeesserData>>) {
  const { stages }          = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const threshold  = (node?.params.thresholdDb as number) ?? -20
  const frequency  = (node?.params.frequencyHz as number) ?? 6000
  const levels     = useStereoLevels(id)
  const result     = stages[id] as DeesserResult | undefined
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
      icon={<AudioWaveform size={16} />}
      label={data.label ?? t.nodes.deesser?.label ?? 'De-esser'}
    >
      <div style={twoColumns}>
        <SignalMeter
          db={levels.in}
          dbR={levels.inR}
          health={getHealth(levels.inPeak)}
          label={t.meters.input}
        />
        <SignalMeter
          db={levels.out}
          dbR={levels.outR}
          health={result?.health ?? 'too-quiet'}
          label={t.meters.output}
        />

        <KnobStack>
          <KnobControl
            value={threshold}
            min={-60}
            max={0}
            label={t.nodes.deesser?.threshold ?? 'Threshold'}
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
            label={t.nodes.deesser?.frequency ?? 'Frequency'}
            formatValue={(v) => `${formatFreq(v)} Hz`}
            onChange={(v) => updateNodeParams(id, { frequencyHz: v })}
            color="var(--lsc-accent)"
            size={44}
            layout="side"
          />
        </KnobStack>

        <ReductionReadout db={gr} maxDb={12} label={t.nodes.deesser?.gainReduction ?? 'Sibilance reduction'} />
      </div>
    </NodeWrapper>
  )
}
