import type { NodeProps, Node } from '@xyflow/react'
import { Gauge } from 'lucide-react'
import { GraphInlineNode } from './GraphInlineNode'
import { KnobControl } from '../controls/KnobControl'
import { useSignalStore } from '../../store/signalStore'

interface GraphPotentiometerData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function GraphPotentiometerNode({ id, data }: NodeProps<Node<GraphPotentiometerData>>) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)

  const attenuationDb = (node?.params.attenuationDb as number) ?? 0

  return (
    <GraphInlineNode
      nodeId={id}
      typeKey="potentiometer"
      icon={<Gauge size={20} />}
      label={data.label ?? 'Potentiometer'}
      accentColor={data.color}
    >
      <KnobControl
        value={attenuationDb}
        min={0}
        max={80}
        label="Attn"
        formatValue={(v) => v === 0 ? '0 dB' : `−${v} dB`}
        onChange={(v) => updateNodeParams(id, { attenuationDb: v })}
        color="var(--lsc-accent)"
        size={40}
      />
    </GraphInlineNode>
  )
}
