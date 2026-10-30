import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '@xyflow/react'
import { shallow } from 'zustand/shallow'
import { LiveLevel, MeterBars, STEREO_BARS_W } from '../SignalMeter'
import type { MeterAt } from '../meterPaint'
import { StableText } from '../controls/StableText'
import { zoneTextColor } from '../meterPaint'
import { useDetailShown } from '../../hooks/useDetailShown'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useTranslation } from '../../i18n/useTranslation'
import { louder } from '../../signal/levels'
import { levelParts } from '../../utils/readout'
import { cssVar, textWidth } from '../../utils/fitText'
import type { TypeKey } from '../../data/nodeRegistry'
import { NODE_LOOK } from './nodeLook'
import { NUMBER_SAMPLE, PAD, fitNameRows } from './overviewLayout'
import { BIG_TOGGLE_H } from './StereoToggle'
import { CONDITIONS } from './conditionText'
import { useStage } from '../../hooks/useGraphSignal'
import type { StageCondition } from '../../signal/process'

/** Between a side column and the name (px) */
const SIDE_GAP = 16
/** A side's name (Input / Output), its level number and the number's unit (px) */
const SIDE_LABEL = 24
const SIDE_NUMBER = 36
const SIDE_UNIT = 22
/** The health word under the name, and the Bypassed tag (px) */
const HEALTH = 28
const TAG = 20
/** A condition's words, in the health word's place (px) */
const CONDITION_TEXT = 21
/** Between a level number and its unit (px) */
const UNIT_GAP = 6
/** A level row's height (its number's size), and the gaps between the name, health word and tag (px) */
const LEVEL_ROW = SIDE_NUMBER
const MIDDLE_GAP = 14
/** A bus's Peak, RMS and Noise rows: a row's name, its number, between the rows (px) */
const ROW_NAME = 20
const ROW_NUMBER = 30
const ROW_GAP = 6
const ROW_UNIT = 19
const rowNumber = { fontFamily: 'var(--lsc-font-mono)', fontSize: ROW_NUMBER, fontWeight: 700 } as const

/**
 * A card's zoomed-out face with its meters at its sides, as the sound flows through it (D31): what
 * arrives on the left, what leaves on the right — each the card's own upright meter (as thin as
 * the Computer's), its name above it and its average under it, moving with the sound (wider than
 * the meter, it reaches in under the card's name: the name keeps the room a one-word name needs). Between them
 * the card's name, a word on each row, as big as it fits, and the health word of
 * what leaves. A bus (`input` false) has its Output alone, as zoomed in — what arrives is many
 * wires, added up into what leaves —, and beside it its Peak, RMS and Noise (from Intermediate). A layer over the card's hidden controls, so the card keeps
 * exactly its size (NodeWrapper's `overviewSides`).
 */
export function SidesFace({ nodeId, typeKey, label, input = true, shown, bypassed, top }: {
  nodeId: string
  typeKey: TypeKey
  label: string
  /** false: no Input meter (a bus) */
  input?: boolean
  /** Fully visible (zoomed out); otherwise faded out and hidden */
  shown: boolean
  bypassed: boolean
  /** Over the name, between the meters: the Aux Bus's Mono | Stereo switch (StereoToggle `big`, BIG_TOGGLE_H tall) */
  top?: ReactNode
}) {
  const { t }  = useTranslation()
  const levels = useStereoLevels(nodeId)
  // What is wrong (a bus fed analog and digital at once): said instead of the health word
  const condition = useStage(nodeId)?.condition
  // A bus: its Peak, RMS and Noise in a column of their own beside its meter, as zoomed in (from
  // Intermediate) — the bus card is wide enough for them (D31): the name keeps the card's height
  const detailed = useDetailShown()
  const readings = !input && detailed
  // Under the name, the room the level rows take as they reach in (none beside a bus's readings)
  const bottomH  = readings ? 0 : LEVEL_ROW + MIDDLE_GAP
  // Compared by its numbers, so dragging the card (a new internal node each frame) does not re-render it
  const size = useStore((s) => {
    const m = s.nodeLookup.get(nodeId)?.measured
    return m?.width && m?.height ? { w: m.width, h: m.height } : null
  }, shallow)
  const hasTop = top !== undefined
  const fit = useMemo(() => {
    if (!size) return null
    const sans = cssVar('--lsc-font-sans')
    // A side column is as wide as its meter (stereo, the wider) or its name; its level row,
    // wider, reaches in under the card's name
    const sideW = Math.ceil(Math.max(STEREO_BARS_W, ...[t.meters.input, t.meters.output].map((w) => textWidth(w, sans, 600) * SIDE_LABEL)))
    // A bus's readings: a row's name as wide as the longest (Peak, RMS, Noise), the widest number and unit
    const rowNameW  = Math.ceil(Math.max(...[t.meters.peak, t.meters.rms, t.meters.noise].map((w) => textWidth(w, sans, 600))) * ROW_NAME) + 8
    const readingsW = Math.ceil(rowNameW + textWidth(NUMBER_SAMPLE, cssVar('--lsc-font-mono'), 700) * ROW_NUMBER + UNIT_GAP
      + Math.max(...['dBu', 'dBFS'].map((u) => textWidth(u, sans, 600))) * ROW_UNIT)
    const sides   = input ? 2 : 1
    const middleW = size.w - 2 - PAD * 2 - (sideW + SIDE_GAP) * sides - (readings ? readingsW + SIDE_GAP : 0)
    // A condition's words in the health word's place: as many lines as they take at that width
    // (a tenth more for the room a wrap leaves at a line's end)
    const conditionH = condition
      ? Math.ceil((textWidth(CONDITIONS[condition].text(t, typeKey), sans, 700) * CONDITION_TEXT * 1.1) / middleW) * Math.ceil(CONDITION_TEXT * 1.15)
      : HEALTH
    // The name's box: between the side columns, above the level rows, the switch (the Aux Bus) over
    // it, the health word (or what is wrong) and the Bypassed tag under it
    const name = fitNameRows(
      label, middleW,
      size.h - 2 - PAD * 2 - bottomH - MIDDLE_GAP - conditionH
        - (bypassed ? TAG * 1.4 + 2 + MIDDLE_GAP : 0) - (hasTop ? BIG_TOGGLE_H + MIDDLE_GAP : 0),
      sans, textWidth, NODE_LOOK[typeKey].nameMax,
    )
    return { sideW, name, rowNameW, readingsW }
  }, [size, label, typeKey, input, bypassed, t, hasTop, condition, readings, bottomH])
  if (!fit) return null
  const { sideW, name, rowNameW, readingsW } = fit

  /** One side: its name, its upright meter (L and R in stereo), its average reaching in under the name (not beside a bus's readings). */
  const side = (at: MeterAt) => {
    const m     = at === 'in' ? levels.input : levels.output
    const whole = m.r ? louder(m.l, m.r) : m.l
    return (
      <div style={{ width: sideW, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: SIDE_LABEL, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap', color: 'var(--lsc-fg-muted)' }}>
          {at === 'in' ? t.meters.input : t.meters.output}
        </span>
        <MeterBars l={m.l} r={m.r} domain={m.domain} nodeId={nodeId} at={at} moving={shown} style={{ flex: 1, minHeight: 0 }} />
        {!readings && (
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
        )}
      </div>
    )
  }

  /** A bus's Peak and RMS, moving with the sound, and its Noise, still (measured with the music stopped): beside its meter, at its foot. */
  const readingRows = () => {
    const m     = levels.output
    const whole = m.r ? louder(m.l, m.r) : m.l
    return (
      <div style={{ width: readingsW, flexShrink: 0, alignSelf: 'flex-end', display: 'flex', flexDirection: 'column', gap: ROW_GAP }}>
        {([['hold', t.meters.peak], ['rms', t.meters.rms], ['noise', t.meters.noise]] as const).map(([which, rowName]) => (
          <div key={which} style={{ height: ROW_NUMBER, display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', lineHeight: 1, whiteSpace: 'nowrap' }}>
            <span style={{ width: rowNameW, fontSize: ROW_NAME, fontWeight: 600, color: 'var(--lsc-fg-muted)' }}>{rowName}</span>
            {which === 'noise' ? (
              <StableText reserve={[NUMBER_SAMPLE]} align="end" style={{ ...rowNumber, color: zoneTextColor(whole.noise, m.domain, whole.noise) }}>
                {levelParts(whole.noise, m.domain)[0]}
              </StableText>
            ) : (
              <LiveLevel
                db={which === 'hold' ? whole.peak : whole.rms} reading={which}
                source={shown ? { nodeId, at: 'out', side: m.r ? 'louder' : 'l' } : undefined}
                domain={m.domain} noise={whole.noise} reserve={NUMBER_SAMPLE} align="end" style={rowNumber}
              />
            )}
            <span style={{ fontSize: ROW_UNIT, fontWeight: 600, marginLeft: UNIT_GAP, color: 'var(--lsc-fg-muted)' }}>
              {levelParts(whole.rms, m.domain)[1]}
            </span>
          </div>
        ))}
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
      <div style={{ flex: 1, minWidth: 0, paddingBottom: bottomH, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: MIDDLE_GAP }}>
        {top}
        <div style={{ fontSize: name.fontSize, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, textAlign: 'center', whiteSpace: 'nowrap', color: 'var(--lsc-fg)' }}>
          {name.lines.map((line) => <div key={line}>{line}</div>)}
        </div>
        {condition ? (
          <ConditionWords condition={condition} typeKey={typeKey} />
        ) : (
          <StableText
            reserve={Object.values(t.health)} align="center"
            style={{ fontSize: HEALTH, fontWeight: 700, lineHeight: 1, color: `var(--signal-${health}-text)` }}
          >
            {t.health[health]}
          </StableText>
        )}
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
      {readings && readingRows()}
      {side('out')}
    </div>
  )
}

/** What is wrong, in its colour, in the health word's place: as big as the health word, wrapping onto two lines. */
function ConditionWords({ condition, typeKey }: { condition: StageCondition; typeKey: TypeKey }) {
  const { t } = useTranslation()
  const c     = CONDITIONS[condition]
  return (
    <div className="lsc-wrap-text" style={{ fontSize: CONDITION_TEXT, fontWeight: 700, lineHeight: 1.15, textAlign: 'center', color: `var(--signal-${c.tone}-text)` }}>
      {c.text(t, typeKey)}
    </div>
  )
}
