import type { NodeProps, Node } from '@xyflow/react'
import { Volume2 } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { OverviewIcon } from './OverviewFace'
import { KnobControl } from '../controls/KnobControl'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphActiveSpeakerData extends Record<string, unknown> {
  color?: string
  label?: string
}

const GAP = 16
// Value and label under the knob
const READOUT_H = 34

/**
 * Active speaker (amplifier built in): a card with a big icon, its Volume knob and the level
 * it plays, at every zoom.
 */
export function ActiveSpeakerNode({ id, data }: NodeProps<Node<GraphActiveSpeakerData>>) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const volumeDb = (node?.params.volumeDb as number) ?? 0

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="active-speaker"
      icon={<Volume2 size={16} />}
      label={data.label ?? t.nodes.activeSpeaker.label}
      faceOnly
      overviewArt={(box) => {
        const knob = Math.max(40, Math.min(72, Math.round(box.h - READOUT_H)))
        const icon = Math.min(box.h, box.w - knob - GAP)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: GAP }}>
            <OverviewIcon icon={<Volume2 />} box={{ w: icon, h: icon }} />
            {/* The face ignores the pointer; the knob takes it back */}
            <div className="nodrag nopan" style={{ pointerEvents: 'auto' }}>
              <KnobControl
                value={volumeDb}
                min={-20}
                max={10}
                step={0.5}
                label={t.nodes.activeSpeaker.volume}
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
