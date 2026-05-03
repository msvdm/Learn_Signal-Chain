import type { ReactNode } from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import { Mic, Guitar } from 'lucide-react'
import { InlineNode } from './InlineNode'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphMicData extends Record<string, unknown> {
  color?: string
  label?: string
  typeKey?: string
}

const JackPlugIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <g transform="rotate(-45 12 12)">
      <line x1="10.5" y1="22" x2="10.5" y2="20" />
      <line x1="13.5" y1="22" x2="13.5" y2="20" />
      <rect x="8.5" y="13" width="7" height="7.5" rx="1.5" />
      <line x1="10" y1="13" x2="10" y2="11" />
      <line x1="14" y1="13" x2="14" y2="11" />
      <line x1="10" y1="11" x2="14" y2="11" />
      <path d="M10 11 L10 6.5 Q10 4 12 4 Q14 4 14 6.5 L14 11" />
      <line x1="10" y1="8.5" x2="14" y2="8.5" />
    </g>
  </svg>
)

const ICONS: Record<string, ReactNode> = {
  mic:        <Mic size={20} />,
  'line-in':  JackPlugIcon,
  instrument: <Guitar size={20} />,
}

export function MicNode({ id, data }: NodeProps<Node<GraphMicData>>) {
  const node  = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const { t } = useTranslation()

  const resolvedTypeKey = (data.typeKey as string) ?? 'mic'
  const params          = node?.params ?? {}
  const levelDb         = (params.sensitivityDb as number) ?? (params.levelDb as number) ?? -60

  return (
    <InlineNode
      nodeId={id}
      typeKey={resolvedTypeKey}
      icon={ICONS[resolvedTypeKey] ?? <Mic size={20} />}
      label={data.label ?? t.palette.items[resolvedTypeKey] ?? t.nodes.mic.label}
      accentColor={data.color}
      value={`${levelDb} dBu`}
      width={200}
    />
  )
}
