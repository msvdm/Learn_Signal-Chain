import { useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useStore } from '@xyflow/react'
import { LiveLevel, MeterBar, MeterScaleRow, SCALE_ROW } from '../SignalMeter'
import { zoneTextColor } from '../meterPaint'
import type { LiveReading } from '../SignalMeter'
import { levelParts } from '../../utils/readout'
import { StableText } from '../controls/StableText'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { getHealth, louder, SPL_SCALE_DB } from '../../signal/levels'
import type { SideLevels } from '../../signal/levels'
import { useDetailShown } from '../../hooks/useDetailShown'
import { useTranslation } from '../../i18n/useTranslation'
import { fitText, textWidth, cssVar } from '../../utils/fitText'
import type { TypeKey } from '../../data/nodeRegistry'
import { NODE_LOOK } from './nodeLook'
import { FaceNote, WithNote } from './FaceNote'

// ── Geometry (all sizes follow the card's measured width W) ─────────────────────
const PAD         = 20     // around the name and the level block
const NAME_GAP    = 12     // between the name area and the level block
const METER_GAP   = 10     // between the meter's scale and the level row
const SCALE_GAP   = 4      // between the meter and its scale (−∞, unity, the top — D16)
const SCALE_RATIO = 0.75   // the scale's numbers, relative to the unit
const ROW_GAP     = 6      // between the Peak, RMS and Noise rows (from Intermediate)
const LEVEL_SHARE = 0.5    // the most of the face's height the level block takes
const SIDES_BAR   = 0.7    // stereo: each of the L and R bars, relative to the one mono bar
const SIDES_GAP   = 0.35   // stereo: between them, relative to the mono bar
const HEALTH_GAP  = 12     // between the level number and the health word
const NAME_MAX    = 96
const NUMBER_MIN  = 24
const BAR_H       = 24     // the meter's bar: one thickness on every card (stereo: SIDES_BAR of it each)
const NUMBER_MAX  = 44
const UNIT_RATIO  = 0.65
const HEALTH_MAX  = 0.75   // health word, relative to the number
const HEALTH_MIN  = 0.55   // below this it moves to its own row
const NUMBER_SAMPLE = '-00.0'   // widest level reading (formatDb, mono font)

/** Drawn instead of the name, given the box it may fill (px). */
export type OverviewArt = (box: { w: number; h: number }) => ReactNode

interface OverviewFaceProps {
  nodeId: string
  typeKey: TypeKey
  label: string
  /** Shown instead of the name (a big icon, the control itself). */
  art?: OverviewArt
  /** false = no level block: the art fills the card (a face-only card zoomed in, the Pre / Post switch). */
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
  // A string, so dragging the card (a new internal node each frame) does not re-render it
  const sizeKey = useStore((s) => {
    const m = s.nodeLookup.get(nodeId)?.measured
    return m?.width && m?.height ? `${m.width}x${m.height}` : ''
  })
  const levels = useStereoLevels(nodeId)
  // A stereo signal leaving: two bars, L above R
  const stereo = levels.output.r !== undefined

  const layout = useMemo(() => {
    if (!sizeKey) return null
    const [W, H] = sizeKey.split('x').map(Number)
    const sans = cssVar('--lsc-font-sans')
    const mono = cssVar('--lsc-font-mono')
    // Inside the 1px border
    const innerW = W - 2 - PAD * 2 - reserveRight

    // From Intermediate a Peak and an RMS row, each with its name in front (as wide as the longer, per px of its size)
    const labelEm = rows ? Math.max(...[t.meters.peak, t.meters.rms, t.meters.noise].map((w) => textWidth(w, sans, 600))) : 0
    // The health word: one size for all four words (the longest fits), so it never resizes the row
    const longest = Math.max(...Object.values(t.health).map((w) => textWidth(w, sans, 700)))

    /** The level block at a number size: the meter, the rows, the health word beside them or under. */
    const sized = (number: number) => {
      const unit   = Math.round(number * UNIT_RATIO)
      // One thickness on every card, whatever its size
      const meter  = BAR_H
      const bar    = stereo ? Math.round(meter * SIDES_BAR) : meter
      const meterH = stereo ? bar * 2 + Math.round(meter * SIDES_GAP) : meter
      const scale  = Math.round(unit * SCALE_RATIO)
      const labelW = rows ? Math.ceil(labelEm * unit + unit * 0.4) : 0
      const numberW = labelW + textWidth(NUMBER_SAMPLE, mono, 700) * number + unit * 0.25 + textWidth(spl === undefined ? 'dBu' : 'dB SPL', sans, 600) * unit
      const beside = Math.floor(Math.min(number * HEALTH_MAX, ((innerW - numberW - HEALTH_GAP) * 0.96) / longest))
      const ownRow = beside < number * HEALTH_MIN
      const health = ownRow ? Math.floor(Math.min(number * HEALTH_MAX, (innerW * 0.96) / longest)) : beside
      // The meter, its scale and its numbers (a status, "Not connected", takes the same height)
      const meterBlock = meterH + SCALE_GAP + Math.round(scale * SCALE_ROW)
      const blockH = barOnly ? meterBlock : meterBlock + METER_GAP + number + (rows ? 2 * (ROW_GAP + number) : 0) + (ownRow ? 4 + health : 0)
      return { number, unit, bar, meterH, scale, labelW, ownRow, health, blockH }
    }
    let level = sized(Math.round(Math.min(NUMBER_MAX, Math.max(NUMBER_MIN, W * 0.1))))
    // At most half the face: on a small card the name (or the icon) keeps its room, the numbers get smaller
    while (showLevel && level.number > NUMBER_MIN && level.blockH + NAME_GAP > (H - 2 - PAD * 2) * LEVEL_SHARE) {
      level = sized(level.number - 1)
    }
    const { number, unit, bar, meterH, scale, labelW, ownRow, health, blockH } = level
    const levelH = showLevel ? blockH + NAME_GAP : 0
    const tag    = Math.round(number * 0.5)
    const tagH   = bypassed ? tag * 1.4 + 2 + 8 : 0
    const nameH  = H - 2 - PAD * 2 - levelH - tagH
    const name   = fitText(label, innerW, nameH, {
      family: sans, weight: 600, letterSpacing: -0.02, lineHeight: 1.1,
      maxSize: NODE_LOOK[typeKey].nameMax ?? NAME_MAX, maxLines: 2,
    })
    return { number, unit, bar, meterH, scale, labelW, blockH, health, ownRow, nameW: innerW, nameH: nameH + tagH, name, tag }
  }, [sizeKey, label, t, bypassed, typeKey, showLevel, barOnly, stereo, reserveRight, spl, rows])

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
