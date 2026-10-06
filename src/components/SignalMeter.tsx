import { useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { healthColor, dbToPercent, getHealth, shifted, SPL_SCALE_DB, UNITY_DBU, ALIGNMENT_DB } from '../signal/levels'
import type { SideLevels, SignalHealth, SignalDomain } from '../signal/levels'
import { useReadingsShown } from '../hooks/useReadingsShown'
import { useLiveMeter } from '../hooks/useLiveMeter'
import { useSignalStore } from '../store/signalStore'
import { StableText } from './controls/StableText'
import { LEVEL_SAMPLE, levelParts } from '../utils/readout'
import type { MeterAt, MeterSide, MeterSource } from './meterPaint'
import { alongScale, paintBar, readingOf } from './meterPaint'

// The meters, as a DAW draws them: three readings in one bar. The solid bar is the average (RMS);
// from Intermediate up (useReadingsShown) a mark in the bar's colour shows the peaks and a grey fog
// from the quiet end the noise, once it is loud enough to reach the scale (−60 dBu). Beginner sees
// the bar alone. React draws the still picture — the render's readings over the whole loop; while
// the chain plays (from Intermediate, hooks/useLiveMeter.ts) the bar moves as an RMS over 300 ms,
// a light bar shows the peak falling back, and the mark becomes the peak hold (audio/meters.ts).

/**
 * Tick marks at the zone edges: where "too quiet" ends and unity (the strong one). Digital also
 * marks its ceiling, 0 dBFS; analog clips at +20 dBu, the end of the scale.
 */
function zoneTicks(domain: SignalDomain): { db: number; strong: boolean }[] {
  const unity = domain === 'digital' ? UNITY_DBU - ALIGNMENT_DB : UNITY_DBU
  const ticks = [{ db: unity - 40, strong: false }, { db: unity, strong: true }]
  return domain === 'digital' ? [...ticks, { db: 0, strong: false }] : ticks
}

/** On the scale: louder than its quiet end (−60). */
const onScale = (db: number | undefined): db is number => db !== undefined && dbToPercent(db) > 0

/** Thickness of a peak mark across an upright bar (px) */
const PEAK_MARK = 3

/**
 * Width of a card's upright meter (px): the same in every language, so a card's size and its
 * controls' room never change with it — the longest health word, "Изкривяване!", fits in 11px bold.
 */
export const STRIP_W = 76

/**
 * One meter bar on the −60…+20 dB scale: `up` from the bottom (a desk's or a DAW's meter) or
 * `right` from the left. The still picture: `side.rms` (the bar), its peaks and noise when
 * `detailed`. With a `source` it moves while the chain plays. `shift`: every reading moved by this
 * on the bar (a dB SPL meter's scale).
 */
function MeterTrack({ side: levels, color, domain, detailed, direction, thickness, length, source, shift = 0, style }: {
  side: SideLevels
  color: string
  domain: SignalDomain
  detailed: boolean
  direction: 'up' | 'right'
  /** Across the bar (px, its border in) */
  thickness: number
  /** Along it (px); none: it fills its box */
  length?: number
  source?: MeterSource
  shift?: number
  style?: CSSProperties
}) {
  const side = shift ? shifted(levels, shift) : levels
  const ref  = useRef<HTMLDivElement>(null)
  const rms  = useRef<HTMLDivElement>(null)
  const peak = useRef<HTMLDivElement>(null)
  const hold = useRef<HTMLDivElement>(null)
  const up = direction === 'up'
  useLiveMeter(source && detailed ? source.nodeId : undefined, ref, (live, i) => {
    const r = source ? readingOf(live, source.at, source.side, i) : null
    if (source) paintBar({ rms: rms.current, peak: peak.current, hold: hold.current }, up, r && shift ? { rms: r.rms + shift, peak: r.peak + shift, hold: r.hold + shift } : r)
  })
  // Ticks widen with a thick bar (the overview meter), so they stay visible zoomed out
  const tick = Math.max(1, Math.round(thickness / 8))
  const mark = up ? PEAK_MARK : tick * 3
  const vars = {
    '--rms': alongScale(side.rms),
    '--peak': alongScale(side.peak),
    '--peak-on': detailed && onScale(side.peak) ? 1 : 0,
    '--mark': `${mark}px`,
    '--bar': color,
  } as CSSProperties
  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${up ? 'lsc-meter-up' : 'lsc-meter-right'}`}
      style={{
        ...(up ? { width: thickness, height: length ?? '100%' } : { height: thickness, width: length ?? '100%' }),
        borderRadius: up ? 4 : 9999, background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border-soft)',
        ...vars, ...style,
      }}
    >
      {detailed && source && <div ref={peak} aria-hidden className="lsc-meter-fill lsc-meter-peak" />}
      <div ref={rms} className="lsc-meter-fill lsc-meter-rms" />
      {detailed && onScale(side.noise) && (
        <div
          aria-hidden
          className="lsc-meter-fog"
          style={{
            [up ? 'height' : 'width']: `${dbToPercent(side.noise)}%`,
            background: `linear-gradient(to ${up ? 'top' : 'right'}, var(--lsc-noise-fog) 75%, transparent)`,
          }}
        />
      )}
      {zoneTicks(domain).map(({ db: at, strong }) => (
        <div
          key={at}
          className="absolute"
          style={{
            ...(up
              ? { left: 0, right: 0, bottom: `${dbToPercent(at)}%`, height: 2 }
              : { top: 0, bottom: 0, left: `${dbToPercent(at)}%`, width: tick }),
            background: strong ? 'var(--lsc-fg-muted)' : 'var(--lsc-border)',
          }}
        />
      ))}
      {detailed && (
        // Slides along the bar less the mark's own size: the mark stays inside the bar at both ends
        <div aria-hidden className="lsc-meter-hold-track"><div ref={hold} className="lsc-meter-hold" /></div>
      )}
    </div>
  )
}

/** A horizontal level bar (the overview face): the average, and from Intermediate its peaks and noise (`peak` / `noise` set). */
export function MeterBar({ db, color, height = 6, domain = 'analog', peak, noise, source, shift }: {
  db: number
  color: string
  height?: number
  domain?: SignalDomain
  peak?: number
  noise?: number
  source?: MeterSource
  /** Every reading moved by this on the bar (a dB SPL meter) */
  shift?: number
}) {
  const detailed = peak !== undefined
  return (
    <MeterTrack
      side={{ rms: db, peak: peak ?? -Infinity, noise: noise ?? -Infinity, hum: -Infinity }}
      color={color} domain={domain} detailed={detailed} direction="right" thickness={height} source={source} shift={shift}
    />
  )
}

/**
 * A card's upright meter, on its side of the card: what arrives (left) or leaves (right). Its name,
 * the bar — two, L and R, for a stereo signal — then the level (the average over the loop) and the
 * health word. It takes the height its card gives it; its width is its longest word.
 */
export function MeterStrip({ l, r, health, domain = 'analog', label, nodeId, at, spl }: {
  /** The signal, or its left side when `r` is set */
  l: SideLevels
  /** Right side: two bars */
  r?: SideLevels
  health: SignalHealth
  domain?: SignalDomain
  label: string
  /** The card and which of its signals: it moves while the chain plays */
  nodeId: string
  at: MeterAt
  /** Reads dB SPL, the sound in the air (its card's SPL_DB): the number, and the bar on 40 … 120 dB SPL */
  spl?: number
}) {
  const { t }    = useTranslation()
  const detailed = useReadingsShown()
  // Zoomed out the card shows its face, and this meter is hidden: it need not move
  const shown    = !useSignalStore((s) => s.overview)
  const color    = healthColor(health)
  const sides: [string, SideLevels, MeterSide][] = r ? [['L', l, 'l'], ['R', r, 'r']] : [['', l, 'l']]
  const [value, unit] = levelParts(l.rms, domain, spl)
  const words    = Object.values(t.health)
  const tip      = detailed ? t.meters.tip : t.meters.tipBeginner

  return (
    <div
      className="lsc-meter-strip"
      title={spl === undefined ? tip : `${t.meters.splTip}\n\n${tip}`}
      style={{ width: STRIP_W, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}
    >
      <span style={{ fontSize: 'var(--node-text-sm)', color: 'var(--lsc-fg-muted)', whiteSpace: 'nowrap' }}>{label}</span>

      {/* The bars: one, or L and R — each with its letter under it (kept, unseen, in mono: the same height) */}
      <div style={{ flex: 1, minHeight: 110, display: 'flex', gap: 4 }}>
        {sides.map(([ch, side, which]) => (
          <div key={which} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <MeterTrack
              side={side}
              // Two sides: each in the colour of its own health (clipping from its own peaks)
              color={r ? (isFinite(side.rms) ? healthColor(getHealth(side.rms, domain, side.peak)) : 'var(--lsc-border)') : color}
              domain={domain} detailed={detailed} direction="up" thickness={r ? 11 : 16}
              source={shown ? { nodeId, at, side: which } : undefined} shift={spl === undefined ? 0 : spl - SPL_SCALE_DB}
              style={{ flex: '1 1 auto', height: 'auto', minHeight: 0 }}
            />
            <span style={{ fontSize: 10, fontWeight: 700, lineHeight: '11px', color: 'var(--lsc-fg-muted)', visibility: ch ? 'visible' : 'hidden' }}>
              {ch || 'L'}
            </span>
          </div>
        ))}
      </div>

      {/* The level: one line in mono, an L and an R line in stereo — the same height either way */}
      <div style={{ fontSize: 'var(--node-text-sm)', lineHeight: '15px', fontFamily: 'var(--lsc-font-mono)', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {r ? sides.map(([ch, side]) => (
          <div key={ch} style={{ color: 'var(--lsc-fg-muted)' }}>
            <span style={{ fontWeight: 700 }}>{ch}</span>{' '}
            <StableText reserve={[LEVEL_SAMPLE]} align="end">{levelParts(side.rms, domain, spl)[0]}</StableText>
          </div>
        )) : <>
          <div style={{ color }}><StableText reserve={[LEVEL_SAMPLE]} align="center">{value}</StableText></div>
          <div style={{ fontSize: 11, color: 'var(--lsc-fg-muted)', fontFamily: 'var(--lsc-font-sans)', fontWeight: 400 }}>{unit}</div>
        </>}
      </div>

      {/* The health word: as tall as the tallest of them (a long one wraps), so a new one never resizes the card */}
      <Reserved words={words} style={{ fontSize: 11, lineHeight: '14px', fontWeight: 700, color }}>{t.health[health]}</Reserved>
    </div>
  )
}

/** A word in the space of the biggest of `words` (each may wrap onto lines of its own). */
function Reserved({ words, style, children }: { words: string[]; style: CSSProperties; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', justifyItems: 'center', width: '100%', ...style }}>
      <span style={{ gridArea: '1 / 1' }}>{children}</span>
      {words.map((w) => <span key={w} aria-hidden style={{ gridArea: '1 / 1', visibility: 'hidden' }}>{w}</span>)}
    </div>
  )
}
