import type { NodeProps, Node } from '@xyflow/react'
import { InlineNode } from './InlineNode'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphPadData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function PadNode({ id, data }: NodeProps<Node<GraphPadData>>) {
  const p                = useParams(id, 'pad')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const engaged = p('engaged')

  return (
    <InlineNode
      nodeId={id}
      typeKey="pad"
      label={data.label ?? t.nodes.pad.label}
    >
      <button
        className="nodrag nopan w-full rounded py-1"
        style={{
          fontSize: 'var(--node-text-xs)',
          fontWeight: 700,
          fontFamily: 'var(--lsc-font-mono)',
          background: engaged ? 'var(--signal-hot-bg)' : 'var(--lsc-sunken)',
          border: `1px solid ${engaged ? 'var(--signal-hot)' : 'var(--lsc-border)'}`,
          color: engaged ? 'var(--signal-hot)' : 'var(--lsc-fg)',
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
