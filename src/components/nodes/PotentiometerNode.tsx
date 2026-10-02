import type { NodeProps, Node } from '@xyflow/react'
import { Gauge } from 'lucide-react'
import { InlineNode } from './InlineNode'
import { KnobControl } from '../controls/KnobControl'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { formatPotDb } from '../../utils/readout'

interface GraphPotentiometerData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function PotentiometerNode({ id, data }: NodeProps<Node<GraphPotentiometerData>>) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const position = (node?.params.position as number) ?? 75

  return (
    <InlineNode
      nodeId={id}
      typeKey="potentiometer"
      icon={<Gauge size={20} />}
      label={data.label ?? t.palette.items['potentiometer']}
      accentColor={data.color}
    >
      <KnobControl
        value={position}
        min={0}
        max={100}
        step={0.5}
        label="Level"
        formatValue={formatPotDb}
        onChange={(v) => updateNodeParams(id, { position: v })}
        color="var(--lsc-accent)"
        size={52}
      />
    </InlineNode>
  )
}
