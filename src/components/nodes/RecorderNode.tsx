import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FaceCard } from './FaceCard'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { FaceNote, WithNote } from './FaceNote'
import { noteLines } from './noteLayout'
import { useStage } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'

/**
 * The Recorder and Stream / Broadcast: end points that take the signal in as it arrives — a card with
 * a big icon and its meter, in dBu (what it records or sends: no sound in the air here). A signal
 * clipped on its way here says "Bad sound" (`distorted`: the recording keeps the distortion, however
 * green its meter); a hum from a DI Box ground loop shows too.
 */
export function RecorderNode({ id, type }: CardProps) {
  const typeKey = type as 'recorder' | 'broadcast'
  const Icon    = NODE_LOOK[typeKey].icon
  const stage   = useStage(id)
  const { t }   = useTranslation()

  const note = stage?.distorted ? t.nodes.speaker.distorted
    : stage?.hum !== undefined ? t.nodes.speaker.hum
    : undefined

  return (
    <FaceCard
      nodeId={id}
      typeKey={typeKey}
      label={useNodeName(id, typeKey)}
      art={(box) => {
        const face = (h: number) => <OverviewIcon icon={<Icon />} box={{ w: box.w, h }} />
        if (!note) return face(box.h)
        return (
          <WithNote
            box={box} lines={noteLines(note, box)} face={face}
            note={<FaceNote box={box} color="var(--signal-clipping-text)">{note}</FaceNote>}
          />
        )
      }}
    />
  )
}
