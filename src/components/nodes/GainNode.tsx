import type { NodeProps, Node } from '@xyflow/react'
import { Zap } from 'lucide-react'
import { InlineNode } from './InlineNode'
import { KnobControl } from '../controls/KnobControl'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphGainData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function GainNode({ id, data }: NodeProps<Node<GraphGainData>>) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const gainDb = (node?.params.gainDb as number) ?? 40

  return (
    <InlineNode
      nodeId={id}
      typeKey="gain"
      icon={<Zap size={20} />}
      label={data.label ?? t.nodes.preamp.label}
      accentColor={data.color}
      width={200}
    >
      <KnobControl
        value={gainDb}
        min={0}
        max={60}
        label={t.nodes.preamp.gain}
        formatValue={(v) => `+${v} dB`}
        onChange={(v) => updateNodeParams(id, { gainDb: v })}
        color="var(--signal-good)"
        size={40}
      />
    </InlineNode>
  )
}
