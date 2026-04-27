import type { NodeProps, Node } from '@xyflow/react'
import { Split } from 'lucide-react'
import { InlineNode } from './InlineNode'

interface GraphSplitterData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function SplitterNode({ id, data }: NodeProps<Node<GraphSplitterData>>) {
  return (
    <InlineNode
      nodeId={id}
      typeKey="splitter"
      icon={<Split size={20} />}
      label={data.label ?? 'Splitter'}
      accentColor={data.color}
      value="A / B"
    />
  )
}
