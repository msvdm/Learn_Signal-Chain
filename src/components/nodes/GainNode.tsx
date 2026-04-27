import type { NodeProps, Node } from '@xyflow/react'
import { Zap } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { KnobControl } from '../controls/KnobControl'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphGainData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function GainNode({ id, data }: NodeProps<Node<GraphGainData>>) {
  const { stages, inputDb } = useGraphSignal()
  const node                = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams    = useSignalStore((s) => s.updateNodeParams)
  const { t }               = useTranslation()

  const params = node?.params ?? {}
  const input  = inputDb[id] ?? -Infinity
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const gainDb = (params.gainDb as number) ?? 40

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="gain"
      icon={<Zap size={14} />}
      label={data.label ?? t.nodes.preamp.label}
      accentColor={data.color}
    >
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        <div className="flex justify-center py-1">
          <KnobControl
            value={gainDb}
            min={0}
            max={60}
            label={t.nodes.preamp.gain}
            formatValue={(v) => `+${v} dB`}
            onChange={(v) => updateNodeParams(id, { gainDb: v })}
            color="var(--signal-good)"
            size={56}
          />
        </div>

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
