import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { VolumeX } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { FaceNote, WithNote } from './FaceNote'
import { useStage } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'

const Icon = NODE_LOOK.speaker.icon

/**
 * Passive speaker: a card with a big icon and the level it plays, at every zoom.
 * It has no amplifier inside — fed without an Amplifier before it, it stays silent,
 * and the card says so (crossed-out speaker + a note). A hum from a DI Box ground loop shows too.
 */
export function SpeakerNode({ id }: CardProps) {
  const stage      = useStage(id)
  const { t }      = useTranslation()
  const needsAmp   = stage?.condition === 'needsAmp'
  const hum        = stage?.hum !== undefined

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="speaker"
      label={useNodeName(id, 'speaker')}
      faceOnly
      overviewArt={(box) => {
        if (needsAmp) {
          return (
            <WithNote
              box={box} lines={2}
              face={(h) => <OverviewIcon icon={<VolumeX />} box={{ w: box.w, h }} color="var(--signal-hot-text)" />}
              note={<FaceNote box={box} color="var(--signal-hot-text)">{t.nodes.speaker.needsAmp}</FaceNote>}
            />
          )
        }
        if (hum) {
          return (
            <WithNote
              box={box} lines={1}
              face={(h) => <OverviewIcon icon={<Icon />} box={{ w: box.w, h }} />}
              note={<FaceNote box={box} color="var(--signal-clipping-text)">{t.nodes.speaker.hum}</FaceNote>}
            />
          )
        }
        return <OverviewIcon icon={<Icon />} box={box} />
      }}
    />
  )
}
