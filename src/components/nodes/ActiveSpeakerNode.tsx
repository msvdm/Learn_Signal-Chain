import type { CardProps } from './cardProps'
import type { CSSProperties } from 'react'
import { NODE_LOOK } from './nodeLook'
import { BareOutput } from './BareOutput'
import { ParamKnob } from '../controls/ParamKnob'
import { StableText } from '../controls/StableText'
import { useParams } from '../../hooks/useParams'
import { useTranslation } from '../../i18n/useTranslation'
import { widestFormat } from '../../utils/readout'

/** Its Volume knob (px), big enough to read zoomed out, and its range (dB) */
const KNOB = 110
const VOLUME = { min: -20, max: 10, step: 0.5 }
const formatVolume = (v: number) => `${v >= 0 ? '+' : ''}${v} dB`

/** A blown speaker: a crack through it and smoke where the sound should be (lucide style). */
function BlownSpeakerIcon({ size = 24, color = 'currentColor', strokeWidth = 2, style }: {
  size?: number
  color?: string
  strokeWidth?: number
  style?: CSSProperties
}) {
  return (
    <svg
      aria-hidden viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}
    >
      <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
      <path d="M8 8.5 6.5 11l2 1.5L7 15.5" />
      <path d="M15.5 16c1.3-.9 1.3-2.1 0-3s-1.3-2.1 0-3 1.3-2.1 0-3" />
      <path d="M19.5 18c1.3-.9 1.3-2.1 0-3s-1.3-2.1 0-3 1.3-2.1 0-3 -1.3-2.1 0-3" />
    </svg>
  )
}

/**
 * Active speaker (amplifier built in), and the Studio Monitor, which works the same: no card around
 * them (D28) — the icon with its Volume knob beside it (from Intermediate), the name and the meter
 * in dB SPL under them (BareOutput). Fed from an Amplifier it blows (condition 'blown'): the icon
 * cracks and smokes, red, and a note says why; a digital signal, a bad sound or a hum is said under it.
 */
export function ActiveSpeakerNode({ id, type }: CardProps) {
  const typeKey = type as 'active-speaker' | 'studio-monitor'
  const Icon    = NODE_LOOK[typeKey].icon
  return (
    <BareOutput
      id={id} typeKey={typeKey}
      look={({ condition }) => condition === 'blown'
        ? { Icon: BlownSpeakerIcon, color: 'var(--signal-clipping-text)' }
        : { Icon }}
      beside={<VolumeKnob id={id} typeKey={typeKey} />}
    />
  )
}

/** The Volume knob, its value and its name printed under it (as big as the element's name). */
function VolumeKnob({ id, typeKey }: { id: string; typeKey: 'active-speaker' | 'studio-monitor' }) {
  const { t } = useTranslation()
  const p     = useParams(id, typeKey)
  const label = t.nodes[typeKey].volume
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <ParamKnob
        nodeId={id} typeKey={typeKey} param="volumeDb" {...VOLUME}
        label={label} formatValue={formatVolume} color="var(--signal-good)" size={KNOB} showReadout={false}
      />
      <StableText
        reserve={[widestFormat(VOLUME.min, VOLUME.max, VOLUME.step, formatVolume)]} align="center"
        style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}
      >
        {formatVolume(p('volumeDb'))}
      </StableText>
      <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--lsc-fg-muted)', textAlign: 'center' }}>
        {label}
      </span>
    </div>
  )
}
