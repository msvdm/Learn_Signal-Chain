import type { CardProps } from './cardProps'
import { VolumeX } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { useGraphSignal } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'

const NOTE_LINE = 1.25
const Icon      = NODE_LOOK.speaker.icon

/**
 * Passive speaker: a card with a big icon and the level it plays, at every zoom.
 * It has no amplifier inside — fed without an Amplifier before it, it stays silent,
 * and the card says so (crossed-out speaker + a note).
 */
export function SpeakerNode({ id, data }: CardProps) {
  const { stages } = useGraphSignal()
  const { t }      = useTranslation()
  const needsAmp   = stages[id]?.condition === 'needsAmp'

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="speaker"
      label={data.label ?? t.nodes.speaker.label}
      faceOnly
      overviewArt={(box) => {
        if (!needsAmp) return <OverviewIcon icon={<Icon />} box={box} />
        // Room for a two-line note under the icon
        const note = Math.max(13, Math.min(18, Math.round(box.w * 0.065)))
        const noteH = note * NOTE_LINE * 2 + 6
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <OverviewIcon icon={<VolumeX />} box={{ w: box.w, h: box.h - noteH }} color="var(--signal-hot-text)" />
            <span
              style={{
                fontSize: note, fontWeight: 700, lineHeight: NOTE_LINE, textAlign: 'center',
                color: 'var(--signal-hot-text)', maxWidth: box.w,
              }}
            >
              {t.nodes.speaker.needsAmp}
            </span>
          </div>
        )
      }}
    />
  )
}
