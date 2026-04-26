import type { NodeProps, Node } from '@xyflow/react'
import { Mic } from 'lucide-react'
import { GraphNodeWrapper } from './GraphNodeWrapper'
import { ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphMicData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function GraphMicNode({ id, data }: NodeProps<Node<GraphMicData>>) {
  const { stages }       = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const params = node?.params ?? {}
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const sensitivity = (params.sensitivityDb as number) ?? -60

  return (
    <GraphNodeWrapper
      nodeId={id}
      typeKey="mic"
      icon={<Mic size={14} />}
      label={data.label ?? t.nodes.mic.label}
      accentColor={data.color}
    >
      <div className="space-y-2">
        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
        <ControlSlider
          value={sensitivity}
          min={-70}
          max={-40}
          label={t.nodes.mic.sensitivity}
          formatValue={(v) => `${v} dBu`}
          onChange={(v) => updateNodeParams(id, { sensitivityDb: v })}
        />
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--lsc-text)' }}>
          {t.nodes.mic.micInfo}
        </p>
      </div>
    </GraphNodeWrapper>
  )
}
