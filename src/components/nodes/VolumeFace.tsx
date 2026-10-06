import type { ReactNode } from 'react'
import { KnobControl } from '../controls/KnobControl'
import { OverviewIcon } from './OverviewFace'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useTranslation } from '../../i18n/useTranslation'
import { cssVar, textWidth } from '../../utils/fitText'
import { widestFormat } from '../../utils/readout'

const GAP = 16
// Value, then label, under the knob
const READOUT_H = 38
const MIN_DB  = -20
const MAX_DB  = 10
const STEP_DB = 0.5

const format = (v: number) => `${v >= 0 ? '+' : ''}${v} dB`

/** The knob's width with its value and, under that, its name (KnobControl `labelBelow`: as `.lsc-knob-label` draws it). */
function knobBlockWidth(size: number, label: string): number {
  const value = textWidth(widestFormat(MIN_DB, MAX_DB, STEP_DB, format), cssVar('--lsc-font-mono'), 700) * (size >= 52 ? 15 : 13)
  const name  = textWidth(label.toUpperCase(), cssVar('--lsc-font-sans'), 600, 0.06) * 11
  return Math.ceil(Math.max(size, value, name))
}

/**
 * A face-only card's icon with its Volume knob beside it — the Active Speaker, the Guitar Amp — in the
 * box they are given: the knob as big as the height allows, its value and then its name under it (one
 * above the other: a long name — Bulgarian's — leaves the icon its room), and the icon as big as the
 * room that leaves.
 */
export function VolumeFace({ nodeId, typeKey, icon, box }: {
  nodeId: string
  typeKey: 'active-speaker' | 'guitar-amp'
  icon: ReactNode
  box: { w: number; h: number }
}) {
  const p                = useParams(nodeId, typeKey)
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const label = t.nodes[typeKey].volume
  const knob  = Math.max(40, Math.min(72, Math.round(box.h - READOUT_H)))
  const size  = Math.max(0, Math.min(box.h, box.w - knobBlockWidth(knob, label) - GAP))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: GAP }}>
      <OverviewIcon icon={icon} box={{ w: size, h: size }} />
      {/* The face ignores the pointer; the knob takes it back */}
      <div className="nodrag nopan" style={{ pointerEvents: 'auto' }}>
        <KnobControl
          value={p('volumeDb')}
          min={MIN_DB}
          max={MAX_DB}
          step={STEP_DB}
          label={label}
          formatValue={format}
          onChange={(v) => updateNodeParams(nodeId, { volumeDb: v })}
          color="var(--signal-good)"
          size={knob}
          labelBelow
        />
      </div>
    </div>
  )
}
