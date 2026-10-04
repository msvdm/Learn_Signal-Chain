import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { KnobControl } from '../controls/KnobControl'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useTranslation } from '../../i18n/useTranslation'

const GAP = 16
// Value and label under the knob
const READOUT_H = 34
const Icon      = NODE_LOOK['guitar-amp'].icon

/**
 * Guitar Amp: fed a guitar (an Instrument, or a DI Box's Direct Out), it plays it in the room. Like
 * the Active Speaker: a big icon, its Volume knob and the level it plays, at every zoom. Its Sound
 * reaches only a microphone placed in front of it (a dotted wire).
 */
export function GuitarAmpNode({ id }: CardProps) {
  const p                = useParams(id, 'guitar-amp')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()
  const volumeDb         = p('volumeDb')

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="guitar-amp"
      label={useNodeName(id, 'guitar-amp')}
      faceOnly
      overviewArt={(box) => {
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
                label={t.nodes['guitar-amp'].volume}
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
