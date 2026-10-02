import type { NodeProps, Node } from '@xyflow/react'
import { Radio } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { ControlSlider } from './ControlSlider'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useStereoLevels } from '../../hooks/useStereoLevels'

interface GraphAmpData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function AmpNode({ id, data }: NodeProps<Node<GraphAmpData>>) {
  const { stages }          = useGraphSignal()
  const node                = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams    = useSignalStore((s) => s.updateNodeParams)
  const { t }               = useTranslation()

  const params = node?.params ?? {}
  const levels = useStereoLevels(id)
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const gainDb = (params.gainDb as number) ?? 20

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="amp"
      icon={<Radio size={16} />}
      label={data.label ?? t.palette.items['amp']}
      accentColor={data.color}
    >
      <div className="space-y-3">
        <SignalMeter db={levels.in} dbR={levels.inR} health={getHealth(levels.inPeak)} label={t.meters.input} />

        <ControlSlider
          value={gainDb}
          min={0}
          max={40}
          label={t.nodes.preamp.gain}
          formatValue={(v) => `+${v} dB`}
          onChange={(v) => updateNodeParams(id, { gainDb: v })}
        />

        <SignalMeter db={levels.out} dbR={levels.outR} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
