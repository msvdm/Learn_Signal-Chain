import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { VolumeFace } from './VolumeFace'
import { useStage } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'
import { FaceNote, WithNote } from './FaceNote'

/** A blown speaker: a crack through it and smoke where the sound should be (lucide style). */
function BlownSpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
      <path d="M8 8.5 6.5 11l2 1.5L7 15.5" />
      <path d="M15.5 16c1.3-.9 1.3-2.1 0-3s-1.3-2.1 0-3 1.3-2.1 0-3" />
      <path d="M19.5 18c1.3-.9 1.3-2.1 0-3s-1.3-2.1 0-3 1.3-2.1 0-3 -1.3-2.1 0-3" />
    </svg>
  )
}

/**
 * Active speaker (amplifier built in), and Headphones, which work the same: a card with a big icon
 * and its Volume knob, at every zoom (no level — D11). Fed from an Amplifier it blows (condition
 * 'blown'): the icon cracks and smokes (Headphones: turn red), and a note says why. A hum from a DI
 * Box ground loop shows under it.
 */
export function ActiveSpeakerNode({ id, type }: CardProps) {
  const typeKey = type as 'active-speaker' | 'headphones'
  const Icon    = NODE_LOOK[typeKey].icon
  const stage   = useStage(id)
  const { t }   = useTranslation()

  const blown = stage?.condition === 'blown'
  const hum   = stage?.hum !== undefined

  return (
    <NodeWrapper
      nodeId={id}
      typeKey={typeKey}
      label={useNodeName(id, typeKey)}
      faceOnly
      overviewArt={(box) => {
        if (blown) {
          return (
            <WithNote
              box={box} lines={2}
              face={(h) => <OverviewIcon icon={typeKey === 'headphones' ? <Icon /> : <BlownSpeakerIcon />} box={{ w: box.w, h }} color="var(--signal-clipping-text)" />}
              note={<FaceNote box={box} color="var(--signal-clipping-text)">{t.nodes[typeKey].blown}</FaceNote>}
            />
          )
        }
        // The icon and the Volume knob, side by side, in the height they are given
        const face = (h: number) => <VolumeFace nodeId={id} typeKey={typeKey} icon={<Icon />} box={{ w: box.w, h }} />
        if (!hum) return face(box.h)
        return (
          <WithNote
            box={box} lines={1} face={face}
            note={<FaceNote box={box} color="var(--signal-clipping-text)">{t.nodes.speaker.hum}</FaceNote>}
          />
        )
      }}
    />
  )
}
