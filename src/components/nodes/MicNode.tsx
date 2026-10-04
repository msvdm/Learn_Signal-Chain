import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import type { TypeKey } from '../../data/nodeRegistry'
import { NodeWrapper } from './NodeWrapper'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { useParams } from '../../hooks/useParams'

/**
 * Microphone and Instrument: a card with just a big icon and the level they send out, at every
 * zoom (nothing to set on them). Line Input keeps a full card: it has a Mono / Stereo switch.
 */
export function MicNode({ id, type }: CardProps) {

  const typeKey = type as TypeKey
  const p       = useParams(id, typeKey)
  const levelDb = typeKey === 'mic' ? p('sensitivityDb') : p('levelDb')
  const Icon    = NODE_LOOK[typeKey].icon
  const label   = useNodeName(id, typeKey)
  const art     = (box: { w: number; h: number }) => <OverviewIcon icon={<Icon />} box={box} />

  if (typeKey !== 'line-in') {
    return <NodeWrapper nodeId={id} typeKey={typeKey} label={label} overviewArt={art} faceOnly />
  }

  return (
    <NodeWrapper nodeId={id} typeKey={typeKey} label={label} align="start" overviewArt={art}>
      <span style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>
        {levelDb} dBu
      </span>
    </NodeWrapper>
  )
}
