import type { NodeProps, Node } from '@xyflow/react'
import { Gauge } from 'lucide-react'
import { InlineNode } from './InlineNode'
import { KnobControl } from '../controls/KnobControl'
import { useSignalStore } from '../../store/signalStore'
import { potPositionToDb } from '../../hooks/useSignalChain'

interface GraphPotentiometerData extends Record<string, unknown> {
  color?: string
  label?: string
}

function formatDb(position: number): string {
  const db = potPositionToDb(position)
  if (!isFinite(db)) return '−∞'
  if (Math.abs(db) < 0.05) return '0 dB'
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`
}

export function PotentiometerNode({ id, data }: NodeProps<Node<GraphPotentiometerData>>) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)

  const position = (node?.params.position as number) ?? 75

  return (
    <InlineNode
      nodeId={id}
      typeKey="potentiometer"
      icon={<Gauge size={20} />}
      label={data.label ?? 'Potentiometer'}
      accentColor={data.color}
    >
      <KnobControl
        value={position}
        min={0}
        max={100}
        step={0.5}
        label="Level"
        formatValue={formatDb}
        onChange={(v) => updateNodeParams(id, { position: v })}
        color="var(--lsc-accent)"
        size={40}
      />
    </InlineNode>
  )
}
