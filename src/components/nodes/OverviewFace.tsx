import { useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useStore } from '@xyflow/react'
import { shallow } from 'zustand/shallow'
import { LiveLevel, MeterBar, MeterScaleRow } from '../SignalMeter'
import { zoneTextColor } from '../meterPaint'
import type { LiveReading } from '../SignalMeter'
import { levelParts } from '../../utils/readout'
import { StableText } from '../controls/StableText'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { getHealth, louder, SPL_SCALE_DB } from '../../signal/levels'
import type { SideLevels } from '../../signal/levels'
import { useDetailShown } from '../../hooks/useDetailShown'
import { useTranslation } from '../../i18n/useTranslation'
import { textWidth, cssVar } from '../../utils/fitText'
import { HEALTH_GAP, METER_GAP, NUMBER_SAMPLE, PAD, ROW_GAP, SCALE_GAP, overviewLayout } from './overviewLayout'
import type { TypeKey } from '../../data/nodeRegistry'
import { NODE_LOOK } from './nodeLook'
import { FaceNote, WithNote } from './FaceNote'

/** Drawn instead of the name, given the box it may fill (px). */
export type OverviewArt = (box: { w: number; h: number }) => ReactNode

interface OverviewFaceProps {
  nodeId: string
  typeKey: TypeKey
  label: string
  /** Shown instead of the name (a big icon, the control itself). */
  art?: OverviewArt
  /** false = no level block: the art fills the card (a face-only card zoomed in). */
  showLevel?: boolean
  /** The level block is the meter alone: its bar(s) and scale, no numbers or health word */
  barOnly?: boolean
  /**
   * Said instead of the level ("Not connected": a source with nothing on its output — D11): in the
   * level block's place, or under the art when there is none.
   */
  status?: string
  /** Fully visible (zoomed out); otherwise faded out and hidden. */
  shown: boolean
  bypassed: boolean
  /** Room kept free on the right (px): a face-only card's upright meter, zoomed in */
  reserveRight?: number
  /** The level reads dB SPL, the sound in the air (its card's SPL_DB) */
  spl?: number
}

/**
 * What a card shows when zoomed out (overview): its name, as big as it fits, and the level
 * leaving it. A layer over the card — the card's controls stay in place underneath, hidden,
 * so the card keeps exactly the same size and its ports stay where they are. A face-only card
 * (a source or a speaker: its icon) shows this face at every zoom: zoomed in beside its upright
 * meter, without the level block; zoomed out with it (D13).
 */
export function OverviewFace({ nodeId, typeKey, label, art, showLevel = true, barOnly = false, status, shown, bypassed, reserveRight = 0, spl }: OverviewFaceProps) {
  const { t }    = useTranslation()
  const detailed = useDetailShown()
  // The Peak, RMS and Noise rows (from Intermediate), unless the meter stands alone
  const rows     = detailed && !barOnly
  // Compared by its numbers, so dragging the card (a new internal node each frame) does not re-render it
  const size = useStore((s) => {
    const m = s.nodeLookup.get(nodeId)?.measured
    return m?.width && m?.height ? { w: m.width, h: m.height } : null
  }, shallow)
  const levels = useStereoLevels(nodeId)
  // A stereo signal leaving: two bars, L above R
  const stereo = levels.output.r !== undefined

  const layout = useMemo(() => size && overviewLayout({
    W: size.w, H: size.h, label, nameMax: NODE_LOOK[typeKey].nameMax,
    sans: cssVar('--lsc-font-sans'), mono: cssVar('--lsc-font-mono'),
    rows, rowNames: [t.meters.peak, t.meters.rms, t.meters.noise], healthWords: Object.values(t.health),
    showLevel, barOnly, stereo, bypassed, reserveRight, spl: spl !== undefined,
  }, textWidth), [size, label, t, bypassed, typeKey, showLevel, barOnly, stereo, reserveRight, spl, rows])

  if (!layout) return null

  // The level leaving the card (its louder side)
  const { l, r } = levels.output
  const side   = r ? louder(l, r) : l
  const db     = side.rms
  const state  = levels.outHealth
  const unitText = levelParts(db, levels.outDomain, spl)[1]
  // From Intermediate the bar's blue part is its noise (D17); every number takes the colour of its place
  const noise  = detailed ? side.noise : undefined
  const numberFont: CSSProperties = { fontFamily: 'var(--lsc-font-mono)', fontSize: layout.number, fontWeight: 700 }
  /** A row's name (from Intermediate): Peak, RMS or Noise. */
  const rowName = (text: string) => (
    <span style={{ display: 'inline-block', width: layout.labelW, fontSize: layout.unit, fontWeight: 600, color: 'var(--lsc-fg-muted)' }}>{text}</span>
  )
  const unitLabel = (
    <span style={{ fontSize: layout.unit, fontWeight: 600, marginLeft: layout.unit * 0.25, color: 'var(--lsc-fg-muted)' }}>{unitText}</span>
  )
  /** A level row's number and unit — named Peak or RMS from Intermediate, where it moves with the sound. */
  const number = (which: LiveReading) => (
    <span>
      {detailed && rowName(which === 'hold' ? t.meters.peak : t.meters.rms)}
      <LiveLevel
        db={which === 'hold' ? side.peak : db} reading={which}
        source={shown && detailed ? { nodeId, at: 'out', side: 'louder' } : undefined}
        domain={levels.outDomain} spl={spl} noise={noise} reserve={NUMBER_SAMPLE} align="end"
        style={numberFont}
      />
      {unitLabel}
    </span>
  )
  // One bar (L / R each its own), coloured along its scale; the red line at its end while that side clips
  const bar = (s: SideLevels, which: 'l' | 'r' | 'louder') => (
    <MeterBar
      db={s.rms} height={layout.bar} domain={levels.outDomain} shift={spl === undefined ? undefined : spl - SPL_SCALE_DB}
      clipping={getHealth(s.rms, levels.outDomain, s.peak) === 'clipping'}
      peak={detailed ? s.peak : undefined} noise={detailed ? s.noise : undefined}
      // Moves only while it is shown (zoomed out, or a face-only card)
      source={shown ? { nodeId, at: 'out', side: which } : undefined}
    />
  )
  const healthWord = (
    <StableText
      reserve={Object.values(t.health)}
      align={layout.ownRow ? 'start' : 'end'}
      style={{ fontSize: layout.health, fontWeight: 700, lineHeight: 1, color: `var(--signal-${state}-text)` }}
    >
      {t.health[state]}
    </StableText>
  )

  return (
    <div
      aria-hidden={!shown}
      className="lsc-fade"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '100%', pointerEvents: 'none',
        opacity: shown ? (bypassed ? 0.5 : 1) : 0,
        visibility: shown ? 'visible' : 'hidden',
      }}
    >
      {/* Name, centred both ways in the space above the level block */}
      <div
        style={{
          position: 'absolute', left: PAD, right: PAD + reserveRight, top: PAD, height: layout.nameH,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {art ? (
          // With no level block, a status goes under the art (the art takes the height it leaves)
          status && !showLevel ? (
            <WithNote
              box={{ w: layout.nameW, h: layout.nameH }} lines={1}
              face={(h) => art({ w: layout.nameW, h })}
              note={<FaceNote box={{ w: layout.nameW }} color="var(--lsc-fg-muted)">{status}</FaceNote>}
            />
          ) : art({ w: layout.nameW, h: layout.nameH })
        ) : (
          <div
            style={{
              fontSize: layout.name.fontSize, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1,
              textAlign: 'center', whiteSpace: 'nowrap', color: 'var(--lsc-fg)',
            }}
          >
            {layout.name.lines.map((line) => <div key={line}>{line}</div>)}
          </div>
        )}
        {bypassed && (
          <span
            style={{
              fontSize: layout.tag, fontWeight: 700, lineHeight: 1.4, whiteSpace: 'nowrap',
              padding: '0 0.5em', borderRadius: 9999,
              background: 'var(--signal-hot-bg)', color: 'var(--signal-hot-text)',
              border: '1px solid var(--signal-hot-border)',
            }}
          >
            {t.nodeControls.bypassedShort}
          </span>
        )}
      </div>

      {/* A status in the level block's place, in its height: the name keeps its size */}
      {showLevel && status && (
        <div
          style={{
            position: 'absolute', left: PAD, right: PAD, bottom: PAD,
            height: layout.blockH,
            display: 'flex', alignItems: 'center',
            fontSize: Math.round(layout.number * 0.75), fontWeight: 700, lineHeight: 1.1,
            color: 'var(--lsc-fg-muted)',
          }}
        >
          {status}
        </div>
      )}

      {/* Level leaving the card: meter (L and R in stereo), then reading + health word */}
      {showLevel && !status && <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: PAD }}>
        {r ? (
          <div style={{ height: layout.meterH, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            {([['L', l, 'l'], ['R', r, 'r']] as const).map(([letter, s, which]) => (
              <div key={which} style={{ height: layout.bar, display: 'flex', alignItems: 'center', gap: layout.bar * 0.6 }}>
                <span style={{ fontSize: layout.meterH - layout.bar, fontWeight: 700, lineHeight: 1, color: 'var(--lsc-fg-muted)' }}>{letter}</span>
                <div style={{ flex: 1, minWidth: 0 }}>{bar(s, which)}</div>
              </div>
            ))}
          </div>
        ) : bar(side, 'louder')}
        {/* Its scale: −∞, unity and the top — under the bars, past the L / R letters in stereo */}
        <div style={{ marginTop: SCALE_GAP, display: 'flex', gap: r ? layout.bar * 0.6 : 0 }}>
          {r && (
            <span aria-hidden style={{ fontSize: layout.meterH - layout.bar, fontWeight: 700, lineHeight: 1, height: 0, overflow: 'hidden', visibility: 'hidden' }}>L</span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}><MeterScaleRow domain={levels.outDomain} spl={spl} size={layout.scale} /></div>
        </div>
        {!barOnly && <><div
          style={{
            marginTop: METER_GAP, height: layout.number,
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: HEALTH_GAP,
            lineHeight: 1, whiteSpace: 'nowrap',
          }}
        >
          {/* From Intermediate its Peak (the mark), moving with the sound; Beginner the average */}
          {number(detailed ? 'hold' : 'rms')}
          {!layout.ownRow && healthWord}
        </div>
        {detailed && <>
          <div style={{ marginTop: ROW_GAP, height: layout.number, display: 'flex', alignItems: 'baseline', lineHeight: 1, whiteSpace: 'nowrap' }}>
            {number('rms')}
          </div>
          {/* Its noise, measured with the music stopped: still, blue */}
          <div style={{ marginTop: ROW_GAP, height: layout.number, display: 'flex', alignItems: 'baseline', lineHeight: 1, whiteSpace: 'nowrap' }}>
            <span>
              {rowName(t.meters.noise)}
              <StableText reserve={[NUMBER_SAMPLE]} align="end" style={{ ...numberFont, color: zoneTextColor(side.noise, levels.outDomain, side.noise) }}>
                {levelParts(side.noise, levels.outDomain, spl)[0]}
              </StableText>
              {unitLabel}
            </span>
          </div>
        </>}
        {layout.ownRow && <div style={{ marginTop: 4, height: layout.health, display: 'flex' }}>{healthWord}</div>}
        </>}
      </div>}
    </div>
  )
}

/** A card's icon drawn as big as the overview box allows (sources and speakers show this instead of a name). */
export function OverviewIcon({ icon, box, color = 'var(--lsc-fg)' }: {
  icon: ReactNode
  box: { w: number; h: number }
  color?: string
}) {
  const size = Math.floor(Math.min(box.w, box.h))
  return (
    <span className="lsc-overview-icon" style={{ width: size, height: size, display: 'flex', color }}>
      {icon}
    </span>
  )
}
