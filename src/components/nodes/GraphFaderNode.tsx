import type { NodeProps, Node } from '@xyflow/react'
import { SlidersHorizontal } from 'lucide-react'
import { GraphNodeWrapper } from './GraphNodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { VerticalFader } from '../controls/VerticalFader'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphFaderData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function GraphFaderNode({ id, data }: NodeProps<Node<GraphFaderData>>) {
  const { stages, inputDb } = useGraphSignal()
  const node                = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams    = useSignalStore((s) => s.updateNodeParams)
  const { t }               = useTranslation()

  const params  = node?.params ?? {}
  const input   = inputDb[id] ?? -Infinity
  const result  = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const faderDb = (params.faderDb as number) ?? 0

  return (
    <GraphNodeWrapper
      nodeId={id}
      typeKey="fader"
      icon={<SlidersHorizontal size={14} />}
      label={data.label ?? t.nodes.fader.label}
      accentColor={data.color}
    >
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        <VerticalFader
          value={faderDb}
          min={-80}
          max={10}
          step={1}
          formatValue={(v) => (v <= -80 ? '−∞' : `${v >= 0 ? '+' : ''}${v} dB`)}
          onChange={(v) => updateNodeParams(id, { faderDb: v })}
        />

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </GraphNodeWrapper>
  )
}
