import { useMemo } from 'react'
import { useStore } from '@xyflow/react'
import { shallow } from 'zustand/shallow'
import { LiveLevel, MeterBars, STEREO_BARS_W } from '../SignalMeter'
import type { MeterAt } from '../meterPaint'
import { StableText } from '../controls/StableText'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useTranslation } from '../../i18n/useTranslation'
import { louder } from '../../signal/levels'
import { levelParts } from '../../utils/readout'
import { cssVar, textWidth } from '../../utils/fitText'
import type { TypeKey } from '../../data/nodeRegistry'
import { NODE_LOOK } from './nodeLook'
import { NUMBER_SAMPLE, PAD, fitNameRows } from './overviewLayout'

/** Between a side column and the name (px) */
const SIDE_GAP = 16
/** A side's name (Input / Output), its level number and the number's unit (px) */
const SIDE_LABEL = 24
const SIDE_NUMBER = 36
const SIDE_UNIT = 22
/** The health word under the name, and the Bypassed tag (px) */
const HEALTH = 28
const TAG = 20
/** Between a level number and its unit (px) */
const UNIT_GAP = 6
/** A level row's height (its number's size), and the gaps between the name, health word and tag (px) */
const LEVEL_ROW = SIDE_NUMBER
const MIDDLE_GAP = 14

/**
 * A card's zoomed-out face with its meters at its sides, as the sound flows through it (D31): what
 * arrives on the left, what leaves on the right — each the card's own upright meter (as thin as
 * the Computer's), its name above it and its average under it, moving with the sound (wider than
 * the meter, it reaches in under the card's name: the name keeps the room a one-word name needs). Between them
 * the card's name, as big as it fits on two rows (NODE_LOOK's `nameRows`), and the health word of
 * what leaves. A bus (`input` false) has its Output alone, as zoomed in: what arrives is many
 * wires, added up into what leaves. A layer over the card's hidden controls, so the card keeps
 * exactly its size (NodeWrapper's `overviewSides`).
 */
export function SidesFace({ nodeId, typeKey, label, input = true, shown, bypassed }: {
  nodeId: string
  typeKey: TypeKey
  label: string
  /** false: no Input meter (a bus) */
  input?: boolean
  /** Fully visible (zoomed out); otherwise faded out and hidden */
  shown: boolean
  bypassed: boolean
}) {
  const { t }  = useTranslation()
  const levels = useStereoLevels(nodeId)
  // Compared by its numbers, so dragging the card (a new internal node each frame) does not re-render it
  const size = useStore((s) => {
    const m = s.nodeLookup.get(nodeId)?.measured
    return m?.width && m?.height ? { w: m.width, h: m.height } : null
  }, shallow)
  const fit = useMemo(() => {
    if (!size) return null
    const sans = cssVar('--lsc-font-sans')
    // A side column is as wide as its meter (stereo, the wider) or its name; its level row,
    // wider, reaches in under the card's name
    const sideW = Math.ceil(Math.max(STEREO_BARS_W, ...[t.meters.input, t.meters.output].map((w) => textWidth(w, sans, 600) * SIDE_LABEL)))
    const sides = input ? 2 : 1
    // The name's box: between the side columns, above the level rows, the health word (and the
    // Bypassed tag) under it
    const name = fitNameRows(
      label,
      size.w - 2 - PAD * 2 - (sideW + SIDE_GAP) * sides,
      size.h - 2 - PAD * 2 - LEVEL_ROW - MIDDLE_GAP * 2 - HEALTH - (bypassed ? TAG * 1.4 + 2 + MIDDLE_GAP : 0),
      sans, textWidth, NODE_LOOK[typeKey].nameMax, NODE_LOOK[typeKey].nameRows,
    )
    return { sideW, name }
  }, [size, label, typeKey, input, bypassed, t])
  if (!fit) return null
  const { sideW, name } = fit

  /** One side: its name, its upright meter (L and R in stereo), its average reaching in under the name. */
  const side = (at: MeterAt) => {
    const m     = at === 'in' ? levels.input : levels.output
    const whole = m.r ? louder(m.l, m.r) : m.l
    return (
      <div style={{ width: sideW, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: SIDE_LABEL, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap', color: 'var(--lsc-fg-muted)' }}>
          {at === 'in' ? t.meters.input : t.meters.output}
        </span>
        <MeterBars l={m.l} r={m.r} domain={m.domain} nodeId={nodeId} at={at} moving={shown} style={{ flex: 1, minHeight: 0 }} />
        <div style={{ height: LEVEL_ROW, lineHeight: 1, whiteSpace: 'nowrap', alignSelf: at === 'in' ? 'flex-start' : 'flex-end' }}>
          <LiveLevel
            db={whole.rms} reading="rms" source={shown ? { nodeId, at, side: m.r ? 'louder' : 'l' } : undefined}
            domain={m.domain} noise={whole.noise} reserve={NUMBER_SAMPLE} align="end"
            style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: SIDE_NUMBER, fontWeight: 700 }}
          />
          <span style={{ fontSize: SIDE_UNIT, fontWeight: 600, marginLeft: UNIT_GAP, color: 'var(--lsc-fg-muted)' }}>
            {levelParts(whole.rms, m.domain)[1]}
          </span>
        </div>
      </div>
    )
  }

  const health = levels.output.health
  return (
    <div
      aria-hidden={!shown}
      className="lsc-fade"
      style={{
        position: 'absolute', inset: 0, padding: PAD, pointerEvents: 'none',
        display: 'flex', gap: SIDE_GAP,
        opacity: shown ? (bypassed ? 0.5 : 1) : 0,
        visibility: shown ? 'visible' : 'hidden',
      }}
    >
      {input && side('in')}
      {/* Above the level rows, which reach in under it */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: LEVEL_ROW + MIDDLE_GAP, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: MIDDLE_GAP }}>
        <div style={{ fontSize: name.fontSize, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, textAlign: 'center', whiteSpace: 'nowrap', color: 'var(--lsc-fg)' }}>
          {name.lines.map((line) => <div key={line}>{line}</div>)}
        </div>
        <StableText
          reserve={Object.values(t.health)} align="center"
          style={{ fontSize: HEALTH, fontWeight: 700, lineHeight: 1, color: `var(--signal-${health}-text)` }}
        >
          {t.health[health]}
        </StableText>
        {bypassed && (
          <span
            style={{
              fontSize: TAG, fontWeight: 700, lineHeight: 1.4, whiteSpace: 'nowrap', padding: '0 0.5em', borderRadius: 9999,
              background: 'var(--signal-hot-bg)', color: 'var(--signal-hot-text)', border: '1px solid var(--signal-hot-border)',
            }}
          >
            {t.nodeControls.bypassedShort}
          </span>
        )}
      </div>
      {side('out')}
    </div>
  )
}
