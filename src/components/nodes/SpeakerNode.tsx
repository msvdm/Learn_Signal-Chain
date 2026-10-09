import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { VolumeX } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { FaceNote, WithNote } from './FaceNote'
import { ConditionNote } from './conditions'
import { useStage } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'

const Icon = NODE_LOOK.speaker.icon

/**
 * Passive speaker: a card with a big icon, at every zoom (its meter in dB SPL — D13; from Intermediate its
 * readings under it). It has no amplifier inside — fed without an Amplifier before it, it stays silent,
 * and the card says so (crossed-out speaker + a note); fed a digital signal, a note says so too
 * (conditions.tsx). A signal clipped on its way here says "Bad sound" (`distorted`: its meter may be
 * green); a hum from a DI Box ground loop shows too.
 */
export function SpeakerNode({ id }: CardProps) {
  const stage      = useStage(id)
  const { t }      = useTranslation()
  const condition  = stage?.condition
  const distorted  = stage?.distorted === true
  const hum        = stage?.hum !== undefined

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="speaker"
      label={useNodeName(id, 'speaker')}
      faceOnly
      overviewArt={(box) => {
        if (condition) {
          return (
            <ConditionNote
              condition={condition} typeKey="speaker" box={box}
              // No amplifier: the speaker crossed out
              face={(h) => condition === 'needsAmp'
                ? <OverviewIcon icon={<VolumeX />} box={{ w: box.w, h }} color="var(--signal-hot-text)" />
                : <OverviewIcon icon={<Icon />} box={{ w: box.w, h }} />}
            />
          )
        }
        // Something before it clips: its meter may be green, but you hear it
        if (distorted) {
          return (
            <WithNote
              box={box} lines={2}
              face={(h) => <OverviewIcon icon={<Icon />} box={{ w: box.w, h }} />}
              note={<FaceNote box={box} color="var(--signal-clipping-text)">{t.nodes.speaker.distorted}</FaceNote>}
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
