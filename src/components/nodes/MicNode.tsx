import type { NodeProps, Node } from '@xyflow/react'
import type { TypeKey } from '../../data/nodeRegistry'
import { NodeWrapper } from './NodeWrapper'
import { InlineNode } from './InlineNode'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { useParams } from '../../hooks/useParams'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphMicData extends Record<string, unknown> {
  color?: string
  label?: string
}

/**
 * Microphone and Instrument: a card with just a big icon and the level they send out, at every
 * zoom (nothing to set on them). Line Input keeps a full card: it has a Mono / Stereo switch.
 */
export function MicNode({ id, type, data }: NodeProps<Node<GraphMicData>>) {
  const { t } = useTranslation()

  const typeKey = type as TypeKey
  const p       = useParams(id, typeKey)
  const levelDb = typeKey === 'mic' ? p('sensitivityDb') : p('levelDb')
  const Icon    = NODE_LOOK[typeKey].icon
  const label   = data.label ?? t.palette.items[typeKey] ?? t.nodes.mic.label
  const art     = (box: { w: number; h: number }) => <OverviewIcon icon={<Icon />} box={box} />

  if (typeKey !== 'line-in') {
    return <NodeWrapper nodeId={id} typeKey={typeKey} label={label} overviewArt={art} faceOnly />
  }

  return (
    <InlineNode
      nodeId={id}
      typeKey={typeKey}
      label={label}
      value={`${levelDb} dBu`}
      align="start"
      overviewArt={art}
    />
  )
}
