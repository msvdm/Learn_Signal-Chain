import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '@xyflow/react'
import { MeterBar } from '../SignalMeter'
import { StableText } from '../controls/StableText'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { healthColor, formatDb } from '../../signal/levels'
import { useTranslation } from '../../i18n/useTranslation'
import { fitText, textWidth, cssVar } from '../../utils/fitText'
import type { TypeKey } from '../../data/nodeRegistry'
import { NODE_LOOK } from './nodeLook'

// ── Geometry (all sizes follow the card's measured width W) ─────────────────────
const PAD         = 20     // around the name and the level block
const NAME_GAP    = 12     // between the name area and the level block
const METER_GAP   = 10     // between the meter and the level row
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
  /** false = no level block: the art fills the card. */
  showLevel?: boolean
  /** Fully visible (zoomed out); otherwise faded out and hidden. */
  shown: boolean
  bypassed: boolean
  /** Cards without an output (speakers) show the level they play: silent for a passive speaker without an amp. */
  hasOutput: boolean
}

/**
 * What a card shows when zoomed out (overview): its name, as big as it fits, and the level
 * leaving it. A layer over the card — the card's controls stay in place underneath, hidden,
 * so the card keeps exactly the same size and its ports stay where they are.
 */
export function OverviewFace({ nodeId, typeKey, label, art, showLevel = true, shown, bypassed, hasOutput }: OverviewFaceProps) {
  const { t } = useTranslation()
  // A string, so dragging the card (a new internal node each frame) does not re-render it
  const sizeKey = useStore((s) => {
    const m = s.nodeLookup.get(nodeId)?.measured
    return m?.width && m?.height ? `${m.width}x${m.height}` : ''
  })
  const levels = useStereoLevels(nodeId)

  const layout = useMemo(() => {
    if (!sizeKey) return null
    const [W, H] = sizeKey.split('x').map(Number)
    const sans = cssVar('--lsc-font-sans')
    const mono = cssVar('--lsc-font-mono')
    // Inside the 1px border
    const innerW = W - 2 - PAD * 2

    const number = Math.round(Math.min(NUMBER_MAX, Math.max(NUMBER_MIN, W * 0.1)))
    const unit   = Math.round(number * UNIT_RATIO)
    const meter  = Math.round(number / 2)

    // The health word: one size for all four words (the longest fits), so it never resizes the row
    const longest  = Math.max(...Object.values(t.health).map((w) => textWidth(w, sans, 700)))
    const numberW  = textWidth(NUMBER_SAMPLE, mono, 700) * number + unit * 0.25 + textWidth('dBu', sans, 600) * unit
    const beside   = Math.floor(Math.min(number * HEALTH_MAX, ((innerW - numberW - HEALTH_GAP) * 0.96) / longest))
    const ownRow   = beside < number * HEALTH_MIN
    const health   = ownRow ? Math.floor(Math.min(number * HEALTH_MAX, (innerW * 0.96) / longest)) : beside

    const levelH = showLevel ? meter + METER_GAP + number + (ownRow ? 4 + health : 0) + NAME_GAP : 0
    const tag    = Math.round(number * 0.5)
    const tagH   = bypassed ? tag * 1.4 + 2 + 8 : 0
    const nameH  = H - 2 - PAD * 2 - levelH - tagH
    const name   = fitText(label, innerW, nameH, {
      family: sans, weight: 600, letterSpacing: -0.02, lineHeight: 1.1,
      maxSize: NODE_LOOK[typeKey].nameMax ?? NAME_MAX, maxLines: 2,
    })
    return { number, unit, meter, health, ownRow, nameW: innerW, nameH: nameH + tagH, name, tag }
  }, [sizeKey, label, t, bypassed, typeKey, showLevel])

  if (!layout) return null

  // The level leaving the card; a speaker's is the sound it plays (its stage result)
  const db     = Math.max(levels.out, hasOutput ? (levels.outR ?? -Infinity) : -Infinity)
  const state  = levels.outHealth
  const [value, unitText] = formatDb(db, levels.outDomain).split(' ')
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
        position: 'absolute', inset: 0, pointerEvents: 'none',
        opacity: shown ? (bypassed ? 0.5 : 1) : 0,
        visibility: shown ? 'visible' : 'hidden',
      }}
    >
      {/* Name, centred both ways in the space above the level block */}
      <div
        style={{
          position: 'absolute', left: PAD, right: PAD, top: PAD, height: layout.nameH,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {art ? art({ w: layout.nameW, h: layout.nameH }) : (
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

      {/* Level leaving the card: meter, then reading + health word */}
      {showLevel && <div style={{ position: 'absolute', left: PAD, right: PAD, bottom: PAD }}>
        <MeterBar db={db} color={healthColor(state)} height={layout.meter} domain={levels.outDomain} />
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
