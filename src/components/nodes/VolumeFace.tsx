import type { ReactNode } from 'react'
import { ParamKnob } from '../controls/ParamKnob'
import { OverviewIcon } from './OverviewFace'
import { useTranslation } from '../../i18n/useTranslation'
import { cssVar, textWidth } from '../../utils/fitText'
import { widestFormat } from '../../utils/readout'
import { GUITAR_AMP_MAX } from '../../signal/gains'

const GAP = 16
// Value, then label, under the knob
const READOUT_H = 38

/** The Volume knob: a speaker's in dB; a Guitar Amp's goes to 11 (process.ts guitarAmpGainDb). */
interface VolumeKnob {
  param: 'volumeDb' | 'volume'
  min: number
  max: number
  step: number
  format: (v: number) => string
}
const SPEAKER_KNOB: VolumeKnob = { param: 'volumeDb', min: -20, max: 10, step: 0.5, format: (v) => `${v >= 0 ? '+' : ''}${v} dB` }
const KNOBS: Record<'active-speaker' | 'headphones' | 'guitar-amp', VolumeKnob> = {
  'active-speaker': SPEAKER_KNOB,
  headphones:       SPEAKER_KNOB,
  'guitar-amp':     { param: 'volume', min: 0, max: GUITAR_AMP_MAX, step: 0.5, format: (v) => `${v}` },
}

/** The knob's width with its value and, under that, its name (KnobControl `labelBelow`: as `.lsc-knob-label` draws it). */
function knobBlockWidth(size: number, label: string, k: VolumeKnob): number {
  const value = textWidth(widestFormat(k.min, k.max, k.step, k.format), cssVar('--lsc-font-mono'), 700) * (size >= 52 ? 15 : 13)
  const name  = textWidth(label.toUpperCase(), cssVar('--lsc-font-sans'), 600, 0.06) * 11
  return Math.ceil(Math.max(size, value, name))
}

/**
 * A face-only card's icon with its Volume knob beside it — the Active Speaker, Headphones, the Guitar Amp — in the
 * box they are given: the knob as big as the height allows, its value and then its name under it (one
 * above the other: a long name — Bulgarian's — leaves the icon its room), and the icon as big as the
 * room that leaves.
 */
export function VolumeFace({ nodeId, typeKey, icon, box }: {
  nodeId: string
  typeKey: 'active-speaker' | 'headphones' | 'guitar-amp'
  icon: ReactNode
  box: { w: number; h: number }
}) {
  const { t } = useTranslation()

  const k     = KNOBS[typeKey]
  const label = t.nodes[typeKey].volume
  const knob  = Math.max(40, Math.min(72, Math.round(box.h - READOUT_H)))
  const size  = Math.max(0, Math.min(box.h, box.w - knobBlockWidth(knob, label, k) - GAP))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: GAP }}>
      <OverviewIcon icon={icon} box={{ w: size, h: size }} />
      {/* The face ignores the pointer; the knob takes it back */}
      <div className="nodrag nopan" style={{ pointerEvents: 'auto' }}>
        <ParamKnob
          nodeId={nodeId}
          typeKey={typeKey}
          param={k.param}
          min={k.min}
          max={k.max}
          step={k.step}
          label={label}
          formatValue={k.format}
          color="var(--signal-good)"
          size={knob}
          labelBelow
        />
      </div>
    </div>
  )
}
