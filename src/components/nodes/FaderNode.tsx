import type { NodeProps, Node } from '@xyflow/react'
import { SlidersHorizontal } from 'lucide-react'
import { InlineNode } from './InlineNode'
import { VerticalFader } from '../controls/VerticalFader'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphFaderData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function FaderNode({ id, data }: NodeProps<Node<GraphFaderData>>) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const faderDb = (node?.params.faderDb as number) ?? 0

  return (
    <InlineNode
      nodeId={id}
      typeKey="fader"
      icon={<SlidersHorizontal size={30} />}
      label={data.label ?? t.nodes.fader.label}
      accentColor={data.color}
    >
      <VerticalFader
        value={faderDb}
        min={-80}
        max={10}
        step={1}
        formatValue={(v) => (v <= -80 ? '−∞' : `${v >= 0 ? '+' : ''}${v} dB`)}
        onChange={(v) => updateNodeParams(id, { faderDb: v })}
        height={150}
        marks={[
          { db: 10,  label: '+10' },
          { db: 0,   label:  '0'  },
          { db: -10, label: '-10' },
          { db: -20, label: '-20' },
          { db: -30, label: '-30' },
          { db: -40, label: '-40' },
          { db: -60, label: '-60' },
          { db: -80, label: '−∞'  },
        ]}
      />
    </InlineNode>
  )
}
