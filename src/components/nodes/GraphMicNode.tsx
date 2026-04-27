import type { NodeProps, Node } from '@xyflow/react'
import { Mic, Cable, Guitar } from 'lucide-react'
import { GraphInlineNode } from './GraphInlineNode'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphMicData extends Record<string, unknown> {
  color?: string
  label?: string
  typeKey?: string
}

const ICONS: Record<string, typeof Mic> = {
  mic: Mic,
  'line-in': Cable,
  instrument: Guitar,
}

export function GraphMicNode({ id, data }: NodeProps<Node<GraphMicData>>) {
  const node  = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const { t } = useTranslation()

  const resolvedTypeKey = (data.typeKey as string) ?? 'mic'
  const params          = node?.params ?? {}
  const levelDb         = (params.sensitivityDb as number) ?? (params.levelDb as number) ?? -60
  const Icon            = ICONS[resolvedTypeKey] ?? Mic

  return (
    <GraphInlineNode
      nodeId={id}
      typeKey={resolvedTypeKey}
      icon={<Icon size={20} />}
      label={data.label ?? t.nodes.mic.label}
      accentColor={data.color}
      value={`${levelDb} dBu`}
    />
  )
}
