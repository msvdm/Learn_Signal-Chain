import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { KnobControl } from '../controls/KnobControl'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useGraphSignal } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'

const GAP = 16
// Value and label under the knob
const READOUT_H = 34
const NOTE_LINE = 1.25
const Icon      = NODE_LOOK['active-speaker'].icon

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
 * Active speaker (amplifier built in): a card with a big icon, its Volume knob and the level
 * it plays, at every zoom. Fed from an Amplifier it blows (condition 'blown'): the level goes red, the
 * icon cracks and smokes, and a note says why.
 */
export function ActiveSpeakerNode({ id }: CardProps) {
  const p                = useParams(id, 'active-speaker')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { stages }       = useGraphSignal()
  const { t }            = useTranslation()

  const volumeDb = p('volumeDb')
  const blown    = stages[id]?.condition === 'blown'

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="active-speaker"
      label={useNodeName(id, 'active-speaker')}
      faceOnly
      overviewArt={(box) => {
        if (blown) {
          // Room for a two-line note under the icon
          const note  = Math.max(13, Math.min(18, Math.round(box.w * 0.065)))
          const noteH = note * NOTE_LINE * 2 + 6
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <OverviewIcon icon={<BlownSpeakerIcon />} box={{ w: box.w, h: box.h - noteH }} color="var(--signal-clipping-text)" />
              <span
                style={{
                  fontSize: note, fontWeight: 700, lineHeight: NOTE_LINE, textAlign: 'center',
                  color: 'var(--signal-clipping-text)', maxWidth: box.w,
                }}
              >
                {t.nodes['active-speaker'].blown}
              </span>
            </div>
          )
        }
        const knob = Math.max(40, Math.min(72, Math.round(box.h - READOUT_H)))
        const icon = Math.min(box.h, box.w - knob - GAP)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: GAP }}>
            <OverviewIcon icon={<Icon />} box={{ w: icon, h: icon }} />
            {/* The face ignores the pointer; the knob takes it back */}
            <div className="nodrag nopan" style={{ pointerEvents: 'auto' }}>
              <KnobControl
                value={volumeDb}
                min={-20}
                max={10}
                step={0.5}
                label={t.nodes['active-speaker'].volume}
                formatValue={(v) => `${v >= 0 ? '+' : ''}${v} dB`}
                onChange={(v) => updateNodeParams(id, { volumeDb: v })}
                color="var(--signal-good)"
                size={knob}
              />
            </div>
          </div>
        )
      }}
    />
  )
}
