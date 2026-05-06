import type { NodeProps, Node } from '@xyflow/react'
import { Minus } from 'lucide-react'
import { InlineNode } from './InlineNode'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphPadData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function PadNode({ id, data }: NodeProps<Node<GraphPadData>>) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const engaged = (node?.params.engaged as boolean) !== false

  return (
    <InlineNode
      nodeId={id}
      typeKey="pad"
      icon={<Minus size={18} />}
      label={data.label ?? t.nodes.pad?.label ?? 'Pad'}
      accentColor={data.color}
    >
      <button
        className="nodrag nopan w-full rounded py-1"
        style={{
          fontSize: 'var(--node-text-xs)',
          fontWeight: 700,
          fontFamily: 'var(--lsc-font-mono)',
          background: engaged ? 'var(--signal-hot-bg)' : 'var(--lsc-sunken)',
          border: `1px solid ${engaged ? 'var(--signal-hot)' : 'var(--lsc-border)'}`,
          color: engaged ? 'var(--signal-hot)' : 'var(--lsc-text)',
          opacity: engaged ? 1 : 0.55,
          cursor: 'pointer',
        }}
        onClick={() => updateNodeParams(id, { engaged: !engaged })}
      >
        {engaged ? '−20 dB' : 'OFF'}
      </button>
    </InlineNode>
  )
}
