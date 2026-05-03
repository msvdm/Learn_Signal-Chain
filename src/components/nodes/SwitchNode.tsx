import type { NodeProps, Node } from '@xyflow/react'
import { ToggleLeft, ToggleRight } from 'lucide-react'
import { InlineNode } from './InlineNode'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphSwitchData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function SwitchNode({ id, data }: NodeProps<Node<GraphSwitchData>>) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const isOn = (node?.params.on as boolean) !== false

  return (
    <InlineNode
      nodeId={id}
      typeKey="switch"
      icon={isOn ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
      label={data.label ?? t.palette.items['switch']}
      accentColor={data.color}
    >
      <button
        className="nodrag nopan w-full rounded py-1"
        style={{
          fontSize: 'var(--node-text-xs)',
          fontWeight: 700,
          background: isOn ? 'var(--signal-good-bg)' : 'var(--lsc-sunken)',
          border: `1px solid ${isOn ? 'var(--signal-good)' : 'var(--lsc-border)'}`,
          color: isOn ? 'var(--signal-good)' : 'var(--lsc-text)',
          cursor: 'pointer',
        }}
        onClick={() => updateNodeParams(id, { on: !isOn })}
      >
        {isOn ? 'ON' : 'OFF'}
      </button>
    </InlineNode>
  )
}
