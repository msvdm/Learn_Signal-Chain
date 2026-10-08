import { useMemo, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { healthColor, getHealth, louder, shifted, SPL_SCALE_DB, meterFloorOf, meterZones, scaleMarks, fitScaleMarks } from '../signal/levels'
import type { SideLevels, SignalHealth, SignalDomain } from '../signal/levels'
import { useDetailShown } from '../hooks/useDetailShown'
import { useLiveMeter } from '../hooks/useLiveMeter'
import { useHeight } from '../hooks/useHeight'
import { useSignalStore } from '../store/signalStore'
import { StableText } from './controls/StableText'
import { LEVEL_SAMPLE, levelParts } from '../utils/readout'
import type { MeterAt, MeterSide, MeterSource } from './meterPaint'
import { alongScale, paintBar, paintStyle, paintText, readingOf } from './meterPaint'

// The meters, as a DAW draws them (D16, after Sound Forge's): one bar per side, coloured along its
// scale — blue where a level is too quiet, green good, yellow hot, red in the top 2 dB (meterZones) —
// with the dB numbers beside it (scaleMarks), down to −∞ at the bottom. The solid bar is the average
// (RMS); from Intermediate up (useDetailShown) a white mark shows the peaks and a grey fog from the
// quiet end the noise, once it is loud enough to reach the even part of the scale (−60 dBu, −80
// dBFS). A red line across the top lights up while that side clips. Beginner sees the bar alone.
// React draws the still picture — the render's readings over the whole loop; while the chain plays
// (from Intermediate, hooks/useLiveMeter.ts) the bar moves as an RMS over 300 ms, the peaks show
// pale above it, falling back, and the mark becomes the peak hold (audio/meters.ts). The colours
// never move: covers slide over them (meterPaint.ts). Their numbers, Peak (the mark) and RMS (the
// bar), move with them (LiveLevel).

/** Thickness of a peak mark across an upright bar (px) */
const PEAK_MARK = 3

/** A meter bar's corners (px), upright or lying */
const METER_RADIUS = 4

/**
 * Width of a card's upright meter (px): the same in every language, so a card's size and its
 * controls' room never change with it — the longest health word, "Изкривяване!", fits in 11px bold.
 */
export const STRIP_W = 76

/** Thickness of a card's upright bar (px): one in mono, each of L and R in stereo — wide enough to read from afar. */
const MONO_BAR_W   = 32
const STEREO_BAR_W = 22

/** The numbers beside an upright bar: their column's width, a label's size and height (px) */
const SCALE_W       = 22
const SCALE_FONT    = 9
const SCALE_LABEL_H = 10
/** Between the bars and the scale (px) */
const BAR_GAP = 2

/** The colours along a bar: each health zone where its levels sit, hard edges (meterZones). */
function zonesBackground(domain: SignalDomain, shift: number, up: boolean): string {
  const stops = meterZones(domain, shift).map((z) => `${healthColor(z.health)} ${z.from}% ${z.to}%`)
  return `linear-gradient(to ${up ? 'top' : 'right'}, ${stops.join(', ')})`
}

/**
 * One meter bar on its domain's scale (−∞, then −60 … +20 dBu, −80 … 0 dBFS): `up` from the bottom
 * (a desk's or a DAW's meter) or `right` from the left — the same look either way. The still
 * picture: lit up to `side.rms`, its peak mark and noise when `detailed`. With a `source` it moves
 * while the chain plays. `shift`: every reading moved by this on the bar (a dB SPL meter's scale);
 * `clipping`: this side's peaks reach the clip level — the red line across its end.
 */
function MeterTrack({ side: levels, domain, detailed, direction, thickness, length, source, shift = 0, clipping, style }: {
  side: SideLevels
  domain: SignalDomain
  detailed: boolean
  direction: 'up' | 'right'
  /** Across the bar (px, its border in) */
  thickness: number
  /** Along it (px); none: it fills its box */
  length?: number
  source?: MeterSource
  shift?: number
  clipping: boolean
  style?: CSSProperties
}) {
  const side = shift ? shifted(levels, shift) : levels
  const ref  = useRef<HTMLDivElement>(null)
  const pale = useRef<HTMLDivElement>(null)
  const dark = useRef<HTMLDivElement>(null)
  const hold = useRef<HTMLDivElement>(null)
  const up = direction === 'up'
  useLiveMeter(source && detailed ? source.nodeId : undefined, ref, (live, i) => {
    const r = source ? readingOf(live, source.at, source.side, i) : null
    if (source) paintBar({ pale: pale.current, dark: dark.current, hold: hold.current }, up, r && shift ? { rms: r.rms + shift, peak: r.peak + shift, hold: r.hold + shift } : r, domain)
  })
  const zones = useMemo(() => zonesBackground(domain, shift, up), [domain, shift, up])
  // The mark widens with a thick bar (the overview meter), so it stays visible zoomed out
  const mark = up ? PEAK_MARK : Math.max(1, Math.round(thickness / 8)) * 3
  const vars = {
    '--rms': alongScale(side.rms, domain),
    '--peak': alongScale(side.peak, domain),
    '--peak-on': detailed && isFinite(side.peak) && alongScale(side.peak, domain) > 0 ? 1 : 0,
    '--mark': `${mark}px`,
    '--clip-on': clipping ? 1 : 0,
  } as CSSProperties
  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${up ? 'lsc-meter-up' : 'lsc-meter-right'}`}
      style={{
        ...(up ? { width: thickness, height: length ?? '100%' } : { height: thickness, width: length ?? '100%' }),
        borderRadius: METER_RADIUS, background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border-soft)',
        ...vars, ...style,
      }}
    >
      <div aria-hidden className="lsc-meter-zones" style={{ background: zones }} />
      {/* Covers over the colours: pale above the average (the peaks show through), dark above the peaks */}
      {detailed && source && <div ref={pale} aria-hidden className="lsc-meter-cover lsc-meter-pale" />}
      <div ref={dark} aria-hidden className="lsc-meter-cover lsc-meter-dark" />
      {detailed && side.noise > meterFloorOf(domain) && (
        <div
          aria-hidden
          className="lsc-meter-fog"
          style={{
            [up ? 'height' : 'width']: `${alongScale(side.noise, domain) * 100}%`,
            background: `linear-gradient(to ${up ? 'top' : 'right'}, var(--lsc-noise-fog) 75%, transparent)`,
          }}
        />
      )}
      {detailed && (
        // Slides along the bar less the mark's own size: the mark stays inside the bar at both ends
        <div aria-hidden className="lsc-meter-hold-track"><div ref={hold} className="lsc-meter-hold" /></div>
      )}
      <div aria-hidden className="lsc-meter-clip" />
    </div>
  )
}

/** Clipping on this side: its peaks reach the clip level (the loop's verdict — it does not flicker). */
const clipsOn = (side: SideLevels, domain: SignalDomain) => getHealth(side.rms, domain, side.peak) === 'clipping'

/** A horizontal level bar (the overview face): the average, and from Intermediate its peaks and noise (`peak` / `noise` set). */
export function MeterBar({ db, height = 6, domain = 'analog', peak, noise, clipping, source, shift }: {
  db: number
  height?: number
  domain?: SignalDomain
  peak?: number
  noise?: number
  /** Its signal's peaks reach the clip level: the red line at its end */
  clipping: boolean
  source?: MeterSource
  /** Every reading moved by this on the bar (a dB SPL meter) */
  shift?: number
}) {
  const detailed = peak !== undefined
  return (
    <MeterTrack
      side={{ rms: db, peak: peak ?? -Infinity, noise: noise ?? -Infinity, hum: -Infinity }}
      domain={domain} detailed={detailed} direction="right" thickness={height} source={source} shift={shift} clipping={clipping}
    />
  )
}

/** A MeterScaleRow's height per px of its labels: the labels and their ticks up to the bar. */
export const SCALE_ROW = 1.3

/**
 * The numbers under a horizontal meter zoomed out (D16): only −∞, unity and the top — −∞ 0 +20 dBu,
 * −∞ −18 0 dBFS, −∞ 110 130 dB SPL — `size` px tall, each with a tick up to the bar.
 */
export function MeterScaleRow({ domain, spl, size }: { domain: SignalDomain; spl?: number; size: number }) {
  const marks = useMemo(() => scaleMarks(domain, { spl, overview: true }), [domain, spl])
  const tick  = Math.round(size * SCALE_ROW) - size
  return (
    <div aria-hidden style={{ position: 'relative', height: size + tick }}>
      {marks.map((m) => {
        // The ends' labels stay inside the bar's length
        const shift = m.at === 0 ? '0' : m.at === 100 ? '-100%' : '-50%'
        return (
          <div key={m.label} style={{ position: 'absolute', top: 0, left: `${m.at}%` }}>
            <span style={{ position: 'absolute', top: 0, width: Math.max(1, Math.round(size / 10)), height: tick, transform: `translateX(${shift})`, background: 'var(--lsc-fg-fainter)' }} />
            <span style={{ position: 'absolute', top: tick, transform: `translateX(${shift})`, ...scaleLabelStyle(m, size) }}>{m.label}</span>
          </div>
        )
      })}
    </div>
  )
}

/** A scale number's look: unity strong, the clip level red, the rest dim. */
function scaleLabelStyle(m: { strong: boolean; top: boolean }, size: number): CSSProperties {
  return {
    fontSize: size, lineHeight: 1, whiteSpace: 'nowrap', fontFamily: 'var(--lsc-font-sans)', fontVariantNumeric: 'tabular-nums',
    fontWeight: m.strong ? 700 : 400,
    color: m.top ? 'var(--signal-clipping-text)' : m.strong ? 'var(--lsc-fg)' : 'var(--lsc-fg-dim)',
  }
}

/** A short line from the scale toward a bar */
const TICK: CSSProperties = { position: 'absolute', top: -0.5, width: 3, height: 1, background: 'var(--lsc-fg-fainter)' }

/**
 * The numbers beside a card's upright meter (D16), on its bar's scale — as many as its height has
 * room for (fitScaleMarks) — with ticks toward the bar(s): `ticks` on the left, the right or both.
 * As tall as the bar beside it; the 1 px top and bottom are the bar's border.
 */
function MeterScale({ domain, spl, ticks }: { domain: SignalDomain; spl?: number; ticks: 'left' | 'right' | 'both' }) {
  const box    = useRef<HTMLDivElement>(null)
  const height = useHeight(box)
  const marks  = useMemo(() => fitScaleMarks(scaleMarks(domain, { spl }), height, SCALE_FONT), [domain, spl, height])
  return (
    <div aria-hidden style={{ flex: '1 1 auto', width: SCALE_W, padding: '1px 0', boxSizing: 'border-box', display: 'flex' }}>
      <div ref={box} style={{ position: 'relative', flex: 1 }}>
        {marks.map((m) => (
          <div key={m.label} style={{ position: 'absolute', left: 0, right: 0, bottom: `${m.at}%`, height: 0 }}>
            {ticks !== 'right' && <span style={{ ...TICK, left: 0 }} />}
            {ticks !== 'left' && <span style={{ ...TICK, right: 0 }} />}
            <span
              style={{
                position: 'absolute', left: 0, right: 0, top: 0, transform: 'translateY(-50%)', textAlign: 'center',
                ...scaleLabelStyle(m, SCALE_FONT), lineHeight: `${SCALE_LABEL_H}px`,
              }}
            >
              {m.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** A meter's moving number: the peak hold (the mark) or the RMS (the solid bar). */
export type LiveReading = 'hold' | 'rms'

/**
 * A level's number that follows its meter while the chain plays — `reading`'s value at each moment,
 * changing at most every TEXT_EVERY_MS so its digits can be read — and is the still reading `db`
 * otherwise (Beginner, before a render, zoomed away). It keeps the width of `reserve`.
 */
export function LiveLevel({ db, reading, source, domain, spl, reserve = LEVEL_SAMPLE, align = 'center', style }: {
  db: number
  reading: LiveReading
  /** Where its meter's movement comes from; none: it stays still */
  source?: MeterSource
  domain: SignalDomain
  /** dB SPL (its card's SPL_DB) */
  spl?: number
  /** As wide as the widest value it can show */
  reserve?: string
  /** Where the number sits in that width */
  align?: 'start' | 'center' | 'end'
  style?: CSSProperties
}) {
  const box   = useRef<HTMLSpanElement>(null)
  const still = useRef<HTMLSpanElement>(null)
  const live  = useRef<HTMLSpanElement>(null)
  useLiveMeter(source?.nodeId, box, (moving, i) => {
    const r = source ? readingOf(moving, source.at, source.side, i) : null
    // The moving number over the still one, which keeps its place (React owns it; the painter, the other)
    paintText(live.current, r ? levelParts(r[reading], domain, spl)[0] : null)
    paintStyle(still.current, 'visibility', r ? 'hidden' : null)
  })
  return (
    <span ref={box} style={{ display: 'inline-grid', justifyItems: align, whiteSpace: 'nowrap', ...style }}>
      <span ref={still} style={{ gridArea: '1 / 1' }}>{levelParts(db, domain, spl)[0]}</span>
      <span ref={live} aria-hidden style={{ gridArea: '1 / 1' }} />
      <span aria-hidden style={{ gridArea: '1 / 1', visibility: 'hidden' }}>{reserve}</span>
    </span>
  )
}

/** An L / R letter under a bar (kept, unseen, where there is none: the same height mono or stereo). */
function SideLetter({ letter }: { letter: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, lineHeight: '11px', color: 'var(--lsc-fg-muted)', visibility: letter ? 'visible' : 'hidden' }}>
      {letter || 'L'}
    </span>
  )
}

/**
 * A card's upright meter, on its side of the card: what arrives (left) or leaves (right). Its name,
 * the bar — two, L and R, for a stereo signal — with its scale beside it (between L and R), then its
 * numbers and the health word. From Intermediate the numbers are its Peak (the peak hold: the mark)
 * and its RMS (the solid bar) — a stereo signal's louder side —, moving with the sound; at Beginner
 * (no peaks — D3) the average over the loop. It takes the height its card gives it; its width is its
 * longest word.
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
  /** Reads dB SPL, the sound in the air (its card's SPL_DB): the number, and the bar on 50 … 130 dB SPL */
  spl?: number
}) {
  const { t }    = useTranslation()
  const detailed = useDetailShown()
  // Zoomed out the card shows its face, and this meter is hidden: it need not move
  const shown    = !useSignalStore((s) => s.overview)
  const color    = healthColor(health)
  const [value, unit] = levelParts(l.rms, domain, spl)
  const words    = Object.values(t.health)
  const tip      = detailed ? t.meters.tip : t.meters.tipBeginner

  // A stereo signal's numbers: its louder side (as the overview face's); the bars show each side
  const whole = r ? louder(l, r) : l
  /** One labelled number, Peak or RMS, on one line: its name, then its value moving with the sound. */
  const reading = (name: string, which: LiveReading, valueColor: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--lsc-fg-muted)', fontFamily: 'var(--lsc-font-sans)', fontWeight: 400 }}>{name}</span>
      <LiveLevel
        db={which === 'hold' ? whole.peak : whole.rms} reading={which}
        source={shown ? { nodeId, at, side: r ? 'louder' : 'l' } : undefined} domain={domain} spl={spl}
        align="end" style={{ color: valueColor }}
      />
    </div>
  )
  /** One side's bar, its letter under it. */
  const bar = (letter: string, side: SideLevels, which: MeterSide) => (
    <div key={which} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <MeterTrack
        side={side}
        domain={domain} detailed={detailed} direction="up" thickness={r ? STEREO_BAR_W : MONO_BAR_W}
        source={shown ? { nodeId, at, side: which } : undefined} shift={spl === undefined ? 0 : spl - SPL_SCALE_DB}
        clipping={clipsOn(side, domain)}
        style={{ flex: '1 1 auto', height: 'auto', minHeight: 0 }}
      />
      <SideLetter letter={letter} />
    </div>
  )
  /** The numbers beside the bar(s), as tall as them (a letter's room kept under it too). */
  const scale = (
    <div key="scale" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <MeterScale domain={domain} spl={spl} ticks={r ? 'both' : 'right'} />
      <SideLetter letter="" />
    </div>
  )

  return (
    <div
      className="lsc-meter-strip"
      title={spl === undefined ? tip : `${t.meters.splTip}\n\n${tip}`}
      style={{ width: STRIP_W, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}
    >
      <span style={{ fontSize: 'var(--node-text-sm)', color: 'var(--lsc-fg-muted)', whiteSpace: 'nowrap' }}>{label}</span>

      {/* The bars, the scale beside them: [scale][bar] in mono, [L][scale][R] in stereo */}
      <div style={{ flex: 1, minHeight: 110, display: 'flex', gap: BAR_GAP }}>
        {r ? [bar('L', l, 'l'), scale, bar('R', r, 'r')] : [scale, bar('', l, 'l')]}
      </div>

      {detailed ? (
        // Peak and RMS, moving with the sound, then their unit: the same height mono or stereo
        <div style={{ fontSize: 'var(--node-text-sm)', lineHeight: '15px', fontFamily: 'var(--lsc-font-mono)', fontWeight: 600, whiteSpace: 'nowrap', width: '100%' }}>
          {reading(t.meters.peak, 'hold', color)}
          {reading(t.meters.rms, 'rms', 'var(--lsc-fg)')}
          <div style={{ fontSize: 11, color: 'var(--lsc-fg-muted)', fontFamily: 'var(--lsc-font-sans)', fontWeight: 400 }}>{unit}</div>
        </div>
      ) : (
      /* The level: one line in mono, an L and an R line in stereo — the same height either way */
      <div style={{ fontSize: 'var(--node-text-sm)', lineHeight: '15px', fontFamily: 'var(--lsc-font-mono)', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {r ? ([['L', l], ['R', r]] as const).map(([ch, side]) => (
          <div key={ch} style={{ color: 'var(--lsc-fg-muted)' }}>
            <span style={{ fontWeight: 700 }}>{ch}</span>{' '}
            <StableText reserve={[LEVEL_SAMPLE]} align="end">{levelParts(side.rms, domain, spl)[0]}</StableText>
          </div>
        )) : <>
          <div style={{ color }}><StableText reserve={[LEVEL_SAMPLE]} align="center">{value}</StableText></div>
          <div style={{ fontSize: 11, color: 'var(--lsc-fg-muted)', fontFamily: 'var(--lsc-font-sans)', fontWeight: 400 }}>{unit}</div>
        </>}
      </div>
      )}

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
