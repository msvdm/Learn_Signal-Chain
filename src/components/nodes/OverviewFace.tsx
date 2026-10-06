import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '@xyflow/react'
import { MeterBar } from '../SignalMeter'
import { levelParts } from '../../utils/readout'
import { StableText } from '../controls/StableText'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { healthColor, getHealth, louder, SPL_SCALE_DB } from '../../signal/levels'
import type { SideLevels } from '../../signal/levels'
import { useReadingsShown } from '../../hooks/useReadingsShown'
import { useTranslation } from '../../i18n/useTranslation'
import { fitText, textWidth, cssVar } from '../../utils/fitText'
import type { TypeKey } from '../../data/nodeRegistry'
import { NODE_LOOK } from './nodeLook'
import { FaceNote, WithNote } from './FaceNote'

// ── Geometry (all sizes follow the card's measured width W) ─────────────────────
const PAD         = 20     // around the name and the level block
const NAME_GAP    = 12     // between the name area and the level block
const METER_GAP   = 10     // between the meter and the level row
const SIDES_BAR   = 0.7    // stereo: each of the L and R bars, relative to the one mono bar
const SIDES_GAP   = 0.35   // stereo: between them, relative to the mono bar
const HEALTH_GAP  = 12     // between the level number and the health word
const NAME_MAX    = 96
const NUMBER_MIN  = 24
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
  /**
   * Said instead of the level ("Not connected": a source with nothing on its output — D11): in the
   * level block's place, or under the art when there is none.
   */
  status?: string
  /** Fully visible (zoomed out); otherwise faded out and hidden. */
  shown: boolean
  bypassed: boolean
  /** Height of the face (px) when it covers only the top of the card (a face-only card's readings below it). */
  height?: number
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
export function OverviewFace({ nodeId, typeKey, label, art, showLevel = true, status, shown, bypassed, height, reserveRight = 0, spl }: OverviewFaceProps) {
  const { t }    = useTranslation()
  const detailed = useReadingsShown()
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
    const [W, cardH] = sizeKey.split('x').map(Number)
    const H = height ?? cardH
    const sans = cssVar('--lsc-font-sans')
    const mono = cssVar('--lsc-font-mono')
    // Inside the 1px border
    const innerW = W - 2 - PAD * 2 - reserveRight

    const number = Math.round(Math.min(NUMBER_MAX, Math.max(NUMBER_MIN, W * 0.1)))
    const unit   = Math.round(number * UNIT_RATIO)
    const meter  = Math.round(number / 2)
    const bar    = stereo ? Math.round(meter * SIDES_BAR) : meter
    const meterH = stereo ? bar * 2 + Math.round(meter * SIDES_GAP) : meter

    // The health word: one size for all four words (the longest fits), so it never resizes the row
    const longest  = Math.max(...Object.values(t.health).map((w) => textWidth(w, sans, 700)))
    const numberW  = textWidth(NUMBER_SAMPLE, mono, 700) * number + unit * 0.25 + textWidth(spl === undefined ? 'dBu' : 'dB SPL', sans, 600) * unit
    const beside   = Math.floor(Math.min(number * HEALTH_MAX, ((innerW - numberW - HEALTH_GAP) * 0.96) / longest))
    const ownRow   = beside < number * HEALTH_MIN
    const health   = ownRow ? Math.floor(Math.min(number * HEALTH_MAX, (innerW * 0.96) / longest)) : beside

    const levelH = showLevel ? meterH + METER_GAP + number + (ownRow ? 4 + health : 0) + NAME_GAP : 0
    const tag    = Math.round(number * 0.5)
    const tagH   = bypassed ? tag * 1.4 + 2 + 8 : 0
    const nameH  = H - 2 - PAD * 2 - levelH - tagH
    const name   = fitText(label, innerW, nameH, {
      family: sans, weight: 600, letterSpacing: -0.02, lineHeight: 1.1,
      maxSize: NODE_LOOK[typeKey].nameMax ?? NAME_MAX, maxLines: 2,
    })
    return { number, unit, bar, meterH, health, ownRow, nameW: innerW, nameH: nameH + tagH, name, tag }
  }, [sizeKey, label, t, bypassed, typeKey, showLevel, height, stereo, reserveRight, spl])

  if (!layout) return null

  // The level leaving the card (its louder side)
  const { l, r } = levels.output
  const side   = r ? louder(l, r) : l
  const db     = side.rms
  const state  = levels.outHealth
  const [value, unitText] = levelParts(db, levels.outDomain, spl)
  // One bar: the louder side in the card's colour; L / R each in the colour of its own health
  const bar = (s: SideLevels, which: 'l' | 'r' | 'louder', color?: string) => (
    <MeterBar
      db={s.rms} height={layout.bar} domain={levels.outDomain} shift={spl === undefined ? undefined : spl - SPL_SCALE_DB}
      color={color ?? (isFinite(s.rms) ? healthColor(getHealth(s.rms, levels.outDomain, s.peak)) : 'var(--lsc-border)')}
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
        position: 'absolute', top: 0, left: 0, right: 0, height: height ?? '100%', pointerEvents: 'none',
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
            height: layout.meterH + METER_GAP + layout.number + (layout.ownRow ? 4 + layout.health : 0),
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
        ) : bar(side, 'louder', healthColor(state))}
        <div
          style={{
            marginTop: METER_GAP, height: layout.number,
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: HEALTH_GAP,
            lineHeight: 1, whiteSpace: 'nowrap',
          }}
        >
          <span>
            <StableText
              reserve={[NUMBER_SAMPLE]}
              align="end"
              style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: layout.number, fontWeight: 700, color: 'var(--lsc-fg)' }}
            >
              {value}
            </StableText>
            <span style={{ fontSize: layout.unit, fontWeight: 600, marginLeft: layout.unit * 0.25, color: 'var(--lsc-fg-muted)' }}>
              {unitText}
            </span>
          </span>
          {!layout.ownRow && healthWord}
        </div>
        {layout.ownRow && <div style={{ marginTop: 4, height: layout.health, display: 'flex' }}>{healthWord}</div>}
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
