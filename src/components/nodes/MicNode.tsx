import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import type { TypeKey } from '../../data/nodeRegistry'
import { NodeWrapper } from './NodeWrapper'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { FaceNote, WithNote } from './FaceNote'
import { DullToneIcon } from './icons'
import { useParams } from '../../hooks/useParams'
import { useStage } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'

/**
 * Microphone and Instrument: a card with just a big icon and the level they send out, at every
 * zoom (nothing to set on them). An Instrument going into the desk without a DI Box says so
 * (condition 'needsDi': a dull-tone curve and a note). Line Input keeps a full card: it has a
 * Mono / Stereo switch.
 */
export function MicNode({ id, type }: CardProps) {

  const typeKey  = type as TypeKey
  const p        = useParams(id, typeKey)
  const stage      = useStage(id)
  const { t }    = useTranslation()
  const levelDb  = typeKey === 'mic' ? p('sensitivityDb') : p('levelDb')
  const needsDi  = stage?.condition === 'needsDi'
  const Icon     = NODE_LOOK[typeKey].icon
  const label    = useNodeName(id, typeKey)

  const art = (box: { w: number; h: number }) => {
    if (!needsDi) return <OverviewIcon icon={<Icon />} box={box} />
    return (
      <WithNote
        box={box} lines={2}
        face={(h) => <OverviewIcon icon={<Icon />} box={{ w: box.w, h }} />}
        note={
          <FaceNote box={box} color="var(--signal-hot-text)" icon={(size) => <DullToneIcon size={size} />}>
            {t.nodes.instrument.needsDi}
          </FaceNote>
        }
      />
    )
  }

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
