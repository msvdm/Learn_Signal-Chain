import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { ALIGNMENT_DB, formatDb, zoneColor } from '../../signal/levels'
import type { MeterZoneKind } from '../../signal/levels'
import { bitsText, rateText } from '../../utils/formatText'
import {
  ANALOG_TOP, BIT_DEPTHS, FS_VOLTS, JITTER_MAX, LEVEL_MAX, LEVEL_MIN, LEVEL_START, OWN_NOISE, RATES,
  RECONSTRUCT_TAPS, TONES,
  bitsOf, codeOf, codeRange, conversionOf, floorOf, samplesOf, topDigitOf, windowOf,
} from '../converter'
import type { Conversion, Sample, Setup } from '../converter'
import { ARROW_INK, FAINT, INK, MOVER, PART, TRACE } from './look'
import type { SceneProps } from './painter'
import { Label, Step } from './sceneParts'
import { LevelMeter } from './circuitParts'
import { useConversion } from './conversionSettings'
import { SceneKnob } from './SceneKnob'
import { StableText } from '../../components/controls/StableText'
import type { ConversionSettings } from './conversionSettings'

// A/D and D/A conversion (Deep dive, D46): a line-level sine into an analog-to-digital converter, its
// numbers, and out of a digital-to-analog converter — in two rows (the user's call, 2026-11-24), each
// read left to right: the line in and the A/D converter on top; its digital line straight down to the
// D/A converter, its filter and the line out below; the numbers' box right of both rows, as tall as
// both (24 bits readable — 2026-11-25), on a tap of that line. Height is voltage, as in Analogue
// amplification, every graph on one scale: the analogue side's top (+20 dBu) at its edge, so the gain
// knob makes the wave bigger or smaller (no zoom — the user's call, 2026-11-25). Every graph covers the same stretch of time (`windowOf`: 0.1 s at 20 Hz, two
// cycles, down to 1 ms at 20 kHz, twenty — as a sound editor zooms), long enough to see the rounding
// change from one cycle to the next. The picture stands still (a sine is the same moving or not):
// the controls under it set it (`useConversion`) — the gain knob and the frequency's slider at every
// step (the user's call, 2026-11-25), the sample rate's buttons, the bit depth's from its step; the clock's are on the picture, beside it.
// (1) Sampling: the line in (its meter in dBu), the filter before the converter (always in), the
//     A/D converter's graph — the wave it is fed (faint) and at each tick of the clock a sample, not
//     yet rounded; the clock between the rows, Steady or Wobbly (a wobbly one takes the samples early
//     or late, drawn thousands of times bigger, played back on time).
// (2) Quantization: each sample rounded to the nearest of its bit depth's steps, each step named by
//     the number it is written as (while there is room); the converter's meter (dBFS) — the signal,
//     the noise its bits leave, a budget and a quality converter's own noise, how far under the
//     signal each is; the numbers: EXCERPT_S of samples magnified (around the wave's rising zero one
//     cycle in: both its halves), over the wave they were taken from, each one's bits under it (the
//     sign on top) — that stretch lit on the graph.
// (3) Analogue conversion: the D/A converter holds each number until the next (the steps); the filter
//     after it smooths them into the line out — at its real size over what came in (dashed), the gap
//     between them shaded, how far under the signal it is and whether it is heard. Past half
//     the sample rate (Nyquist) the filter takes the tone out; the gain turned up shows 0 dBFS with
//     nothing above it.
// The numbers are converter.ts's; the converters are quality ones (their noise in the output).

// ── Where things are, in the scene's units ──────────────────────────────────
/** A graph's half-height: the analogue side's top (+20 dBu) above and below its middle line (0 V) */
const H = 190
/** Every graph's scale (px a volt) */
const PX_V = H / ANALOG_TOP

/** A row's heights around its middle line `cy`, its voltage `px` px a volt */
function rowAt(cy: number, px: number) {
  return {
    cy, px, vy: (volts: number) => cy - px * volts,
    top: cy - H, bottom: cy + H,
    /** Its boxes, their names under them; the readings under its meters */
    boxTop: cy - 220, boxBottom: cy + 262, nameY: cy + 294, readY: cy + H + 42,
  }
}
type Row = ReturnType<typeof rowAt>
/** Row 1: the line in, the A/D converter, its numbers. Row 2: the D/A converter, its filter, the line out */
const ROW_1 = 260, ROW_2 = 900
/** Each graph's width (the window's time); the line out's, as wide as the A/D converter */
const GRAPH_W = 720, METER_W = 16
/** Row 1 · the line in's graph and its meter left of it; the filter; the A/D converter — its graph, the steps' numbers, its meter and the marks' words */
const IN_METER_X = -20, IN_X = 60
const FILTER_L = 830, FILTER_R = 885
const ADC_L = 905, ADC_X = 945, ADC_R = 2130, CODES_X = ADC_X + GRAPH_W + 30, METER_X = 1775, MARKS_X = 1835
/**
 * The numbers' box, as tall as both rows, right of them: EXCERPT_S of time, a column a sample — 48 at
 * 96 kHz, 4 at 8 kHz (the user's call, 2026-11-25: how little the numbers hold at a low rate) —, its
 * columns `COLS_W` wide in all
 */
const NUM_L = 2290, NUM_R = 3130, EXCERPT_S = 0.0005, COLS_X = NUM_L + 30, COLS_W = NUM_R - NUM_L - 60
/** Between the rows · the clock (its buttons left of it), its wires into the A/D converter's bottom and the D/A converter's top */
const CLOCK_L = 340, CLOCK_R = 480, CLOCK_TOP = 565, CLOCK_BOTTOM = 615, CLOCK_WIRE_Y = 590, CLOCK_INTO_ADC = 1000
const CHOICE_H = 50, CHOICE_GAP = 8
/** The digital line out of the A/D converter: on into the numbers' box, and from `TAP_X` down and round into the D/A converter */
const TAP_X = (ADC_R + NUM_L) / 2, DIGITAL_Y = 640, DIGITAL_INTO_DAC = 700
/** Row 2 · the D/A converter, its graph; the filter after it; the line out under the A/D converter, as wide, its meter */
const DAC_L = 20, DAC_X = 60, DAC_R = 840
const OUT_FILTER_L = 870, OUT_FILTER_R = 925
/** (the line out's graph 50 right of the A/D converter's, so its 0 V clears the filter — 2026-11-25; its meter where it was) */
const OUT_X = ADC_X + 50, OUT_W = ADC_R - OUT_X - 90, OUT_METER_X = OUT_X + OUT_W + 50

export const SAMPLE_STEP = 1, QUANT_STEP = 2, DAC_STEP = 3
/** The tone's phase at the graphs' left edge */
const PHASE = 0
/** Points a wave is drawn with */
const POINTS = 1440
/** The steps' lines are drawn while at least this far apart, their numbers while this; each sample's faint line while the samples are */
const STEP_LINES_PX = 4, CODE_PX = 16, SAMPLE_LINES_PX = 8

/** What the converter is set to at a step: what a later step adds stays at its start */
function setupAt(step: number, s: ConversionSettings): Setup {
  return {
    rate: s.rate,
    bits: step >= QUANT_STEP ? s.bits : null,
    jitter: s.wobbly ? JITTER_MAX : 0,
    grade: 'quality',
    filter: true,
    tone: s.tone,
    level: LEVEL_START + s.gain,
  }
}

/** A graph's x of a moment, its window `span` long (s), `w` wide */
const timeX = (left: number, span: number, w = GRAPH_W) => (t: number) => left + (w * t) / span
/** The A/D converter's meter: 0 dBFS at its top, −150 at its bottom (as high as a graph) */
const meterY = (db: number) => ROW_1 - H + (2 * H * Math.min(150, Math.max(0, -db))) / 150

/** A wave over a stretch of time (`from` … `to` s) */
function wavePath(x: (t: number) => number, volts: (t: number) => number, from: number, to: number, vy: (v: number) => number): string {
  let d = ''
  for (let i = 0; i <= POINTS; i++) {
    const t = from + ((to - from) * i) / POINTS
    d += `${i ? ' L' : 'M'}${x(t).toFixed(1)} ${vy(volts(t)).toFixed(1)}`
  }
  return d
}

/** A whole number with thin spaces between its thousands, a real minus */
const numberText = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`
/** A level in whole dB, with a real minus */
const minus = (db: number) => numberText(Math.round(db))
/** A window's length in ms, to two figures (4.6, 100) */
const msText = (s: number) => String(Number((s * 1000).toPrecision(2)))
/** A number's bits as 0s and 1s, the sign first; past 4 bits in fours */
function wordOf(code: number, bits: number): string {
  const word = bitsOf(code, bits).map((on) => (on ? '1' : '0')).join('')
  return bits > 4 ? word.replace(/(.{4})(?=.)/g, '$1 ') : word
}

/** Whether a difference this far under the signal (dB) is heard */
const heardOf = (db: number) => (db > -20 ? 'loud' : db > -60 ? 'clear' : db > -90 ? 'faint' : 'silent')

/**
 * The samples a graph shows (0 … its last: those inside its window, one at its right edge the next
 * window's) and those either side the reconstruction reaches
 */
function picture(c: Conversion, span: number) {
  const last = Math.ceil(span * c.setup.rate - 1e-9) - 1, first = -RECONSTRUCT_TAPS
  const samples = samplesOf(c, PHASE, first, last + RECONSTRUCT_TAPS)
  return { first, samples, shown: samples.slice(-first, -first + last + 1) }
}

/** The line out against what came in, over the window: its voltages, its peak, how far under the signal the difference is (dB) */
function lineOutOf(c: Conversion, samples: readonly Sample[], first: number, span: number) {
  const out: number[] = [], want: number[] = []
  let peak = 0, sq = 0, sig = 0
  for (let i = 0; i <= POINTS; i++) {
    const t = (span * i) / POINTS, o = c.output(t, samples, first), w = c.arriving(t, PHASE)
    out.push(o); want.push(w)
    peak = Math.max(peak, Math.abs(o))
    sq += (o - w) ** 2; sig += w * w
  }
  return { out, want, peak, db: sig > 0 ? 10 * Math.log10(Math.max(sq, 1e-30) / sig) : 0 }
}

/** The line out's wave and the gap between it and what came in (an area) */
function lineOutPaths(o: ReturnType<typeof lineOutOf>, span: number, row: Row) {
  const x = timeX(OUT_X, span, OUT_W), at = (i: number) => (span * i) / POINTS
  const point = (i: number, v: number) => `${x(at(i)).toFixed(1)} ${row.vy(v).toFixed(1)}`
  const path = o.out.map((v, i) => `${i ? 'L' : 'M'}${point(i, v)}`).join(' ')
  let gap = path
  for (let i = POINTS; i >= 0; i--) gap += ` L${point(i, o.want[i])}`
  return { path, gap: `${gap} Z` }
}

/** The meter's marks' words stacked down its right (each below the one before), a leader to each */
function stacked<T extends { db: number }>(marks: readonly T[]): (T & { y: number })[] {
  const out: (T & { y: number })[] = []
  for (const m of marks) {
    const y = Math.max(meterY(m.db) + 6, out.length ? out[out.length - 1].y + 56 : ROW_1 - H + 40)
    out.push({ ...m, y })
  }
  return out
}

/** The D/A converter's steps: each number held until the next */
function stairsOf(shown: readonly Sample[], rate: number, span: number, row: Row): string {
  const dacX = timeX(DAC_X, span)
  return shown.map((s, i) => {
    const y = row.vy(s.value).toFixed(1), to = Math.min(dacX((i + 1) / rate), DAC_X + GRAPH_W).toFixed(1)
    return i ? `V${y} H${to}` : `M${DAC_X} ${y} H${to}`
  }).join(' ')
}

/**
 * Samples as paths (a window can hold thousands): a faint line at each one's moment while they are
 * SAMPLE_LINES_PX apart (from `lineTop` to `lineBottom`), its stem from 0 V and its dot — the dots and
 * stems thinning with the room between them (`gap`); those stopped at full scale apart, for their colour
 */
function dotsOf(shown: readonly Sample[], x: (t: number) => number, vy: (v: number) => number, cy: number,
  stopped: (s: Sample) => boolean, gap: number, range: [left: number, right: number], lines: [top: number, bottom: number]) {
  const part = () => ({ stems: '', dots: '' })
  const kept = part(), held = part()
  let faint = ''
  for (const s of shown) {
    const at = x(s.at), y = vy(s.value)
    if (at < range[0] - 0.5 || at > range[1] + 0.5) continue
    const to = stopped(s) ? held : kept, ax = at.toFixed(1), ay = y.toFixed(1)
    if (gap >= SAMPLE_LINES_PX) faint += `M${ax} ${lines[0].toFixed(1)}V${lines[1].toFixed(1)}`
    to.stems += `M${ax} ${cy}V${ay}`
    to.dots += `M${ax} ${ay}h0`
  }
  return { lines: faint, kept, stopped: held, r: Math.min(5, Math.max(1, gap * 0.35)), stem: Math.min(1.5, Math.max(0.4, gap * 0.4)) }
}

const FULL_SCALE = { stroke: 'var(--signal-clipping)', strokeWidth: 1.5, strokeDasharray: '8 6' } as const
const BOX = { rx: 10, fill: 'var(--lsc-sunken)', stroke: PART, strokeWidth: 2 } as const
const DIGITAL = { stroke: MOVER, strokeWidth: 3, strokeDasharray: '12 5 4 5', fill: 'none' } as const
const CLOCK_WIRE = { fill: 'none', stroke: MOVER, strokeWidth: 1.5, strokeDasharray: '2 4' } as const
const CLIPPED = 'var(--signal-clipping)'
/** What the line out got wrong: the gap between it and what came in */
const WRONG = 'var(--signal-hot)'

/** Samples drawn from `dotsOf`: their faint lines, stems and dots, those stopped at full scale red */
function Dots({ dots }: { dots: ReturnType<typeof dotsOf> }) {
  return (
    <>
      {dots.lines && <path d={dots.lines} fill="none" stroke={MOVER} strokeWidth={1} opacity={0.3} />}
      {([[dots.kept, MOVER], [dots.stopped, CLIPPED]] as const).map(([d, colour]) => d.stems && (
        <g key={colour} stroke={colour} fill="none" strokeLinecap="round">
          <path d={d.stems} strokeWidth={dots.stem} />
          <path d={d.dots} strokeWidth={2 * dots.r} />
        </g>
      ))}
    </>
  )
}

/** A graph's axes: up at its left edge, time along its middle */
function Axes({ x, row, w = GRAPH_W }: { x: number; row: Row; w?: number }) {
  return (
    <>
      <line x1={x} y1={row.top - 10} x2={x} y2={row.bottom + 10} stroke={INK} strokeWidth={1.5} />
      <line x1={x} y1={row.cy} x2={x + w + 20} y2={row.cy} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
    </>
  )
}

/** How long a graph's window is, under its right end */
function TimeEnd({ x, row, span, w = GRAPH_W }: { x: number; row: Row; span: number; w?: number }) {
  const { t, fmt } = useTranslation()
  return <Label at={[x + w, row.bottom + 34]} anchor="end">{fmt(t.deepDive.labels.ms, { n: msText(span) })}</Label>
}

/** Full scale's two dashed lines across a stretch */
function FullScale({ from, to, row }: { from: number; to: number; row: Row }) {
  return (
    <>
      <line x1={from} y1={row.vy(FS_VOLTS)} x2={to} y2={row.vy(FS_VOLTS)} {...FULL_SCALE} />
      <line x1={from} y1={row.vy(-FS_VOLTS)} x2={to} y2={row.vy(-FS_VOLTS)} {...FULL_SCALE} />
    </>
  )
}

/** An analogue graph's lines: the analogue side's top (+20 dBu) and full scale's (+18 dBu), named at their right */
function AnalogLines({ x, row, w = GRAPH_W }: { x: number; row: Row; w?: number }) {
  return (
    <>
      <line x1={x} y1={row.vy(ANALOG_TOP)} x2={x + w} y2={row.vy(ANALOG_TOP)} stroke={CLIPPED} strokeWidth={1.5} />
      <line x1={x} y1={row.vy(-ANALOG_TOP)} x2={x + w} y2={row.vy(-ANALOG_TOP)} stroke={CLIPPED} strokeWidth={1.5} />
      <Label at={[x + w, row.vy(ANALOG_TOP) - 8]} anchor="end">+20 dBu</Label>
      <FullScale from={x} to={x + w} row={row} />
      <Label at={[x + w, row.vy(FS_VOLTS) - 8]} anchor="end">+18 dBu</Label>
      <Label at={[x - 8, row.cy - 8]} anchor="end">0 V</Label>
    </>
  )
}

/** A digital graph's top: 0 dBFS's lines, named */
function DigitalTop({ x, row }: { x: number; row: Row }) {
  const { t } = useTranslation()
  return (
    <>
      <FullScale from={x} to={x + GRAPH_W} row={row} />
      <Label at={[x + 8, row.vy(FS_VOLTS) - 10]}>{t.deepDive.labels.fullScale}</Label>
    </>
  )
}

/** The filter's symbol on a line */
function Filter({ left, right, row }: { left: number; right: number; row: Row }) {
  const { t } = useTranslation()
  const cy = row.cy
  return (
    <>
      <rect x={left} y={cy - 26} width={right - left} height={52} {...BOX} rx={6} />
      <path d={`M${left + 8} ${cy - 6} H${left + 30} Q${left + 38} ${cy - 6} ${left + 42} ${cy + 14}`} fill="none" stroke={INK} strokeWidth={1.5} />
      <Label at={[(left + right) / 2, cy - 36]} anchor="middle">{t.deepDive.labels.filter}</Label>
    </>
  )
}

/** The bit depth's steps (those inside full scale) from `x` to `to`, while far enough apart to be seen */
function stepLines(x: number, to: number, bits: number, vy: (v: number) => number, px: number): string {
  const { step } = codeRange(bits), half = 2 ** (bits - 1)
  if (step * px < STEP_LINES_PX) return ''
  let d = ''
  for (let k = -half; k < half; k++) if (Math.abs(k * step) <= FS_VOLTS * 1.001) d += `M${x} ${vy(k * step).toFixed(1)} H${to} `
  return d
}

/** Each step named by the number it is written as, right of the A/D converter's graph (while there is room) */
function StepCodes({ bits, row }: { bits: number; row: Row }) {
  const { step } = codeRange(bits), half = 2 ** (bits - 1)
  if (step * row.px < CODE_PX) return null
  const ks = Array.from({ length: 2 * half }, (_, i) => i - half).filter((k) => Math.abs(k * step) <= FS_VOLTS * 1.001)
  return <g>{ks.map((k) => <text key={k} className="lsc-dd-code" x={CODES_X} y={row.vy(k * step) + 5}>{wordOf(k, bits)}</text>)}</g>
}

/** A meter's peak, under it */
function Peak({ x, y, peak }: { x: number; y: number; peak: string }) {
  const { t, fmt } = useTranslation()
  return <text className="lsc-dd-reading" x={x} y={y}>{fmt(t.deepDive.labels.peak, { db: peak })}</text>
}

/**
 * The samples the numbers' box magnifies: as many as EXCERPT_S holds, around the wave's rising zero
 * one cycle in (both its halves, at 2 kHz one whole cycle) — the first and how many
 */
function excerptOf(c: Conversion, total: number): { from: number; count: number } {
  const count = Math.min(total, Math.max(1, Math.floor(EXCERPT_S * c.setup.rate + 1e-9)))
  return { from: Math.max(0, Math.min(total - count, Math.round(c.setup.rate / c.setup.tone - count / 2))), count }
}

/** The numbers' box's graph: its top and bottom (the analogue side's top at them), its 0 V line halfway */
const EX_TOP = ROW_1 - 220 + 30, EX_BOTTOM = ROW_2 + 262 - 60, EX_CY = (EX_TOP + EX_BOTTOM) / 2, EX_HALF = (EX_BOTTOM - EX_TOP) / 2
/** A digit's row: at most this high; the gap after every four digits past 4 bits */
const BIT_ROW_MAX = 40, BIT_GROUP_GAP = 4
/** Their font: at most this, this much under a row's height, and a digit (0.6 of it wide) with room beside it in its column */
const BIT_FONT_MAX = 20, BIT_FONT_GAP = 3, BIT_FONT_PER_COL = 1.25
/** The digits' halo, in the box's colour, so they read over the stems (the wave is drawn over them) */
const HALO = { paintOrder: 'stroke', stroke: 'var(--lsc-sunken)', strokeWidth: 4, strokeLinejoin: 'round' } as const
/** The wave over them: a blue standing out of them — dark in the light theme, the Phase button's in the dark one */
const WAVE_OVER = 'var(--lsc-dd-wave-over)'

/**
 * The numbers' box, one graph (the user's call, 2026-11-25 — "we are sound engineers"): EXCERPT_S of
 * time magnified, `count` samples from `from` (a column each — wide at a low sample rate, narrow at a
 * high one), over the wave they were taken from (faint) and the bit depth's steps, the analogue side's
 * top at its edges (taller than the A/D converter's graph: the room is the box's). Each sample's word
 * stands on the 0 V line in its column: the sign on the line, the other digits away from it, to the
 * side the sample is on (0… up, 1… down), in fours past 4 bits — as big as half the box lets them
 * (24 readable), each over a halo. The wave zoomed to its words (the user's call, 2026-11-25): the
 * loudest sample shown lands on its last digit, the rest drawn to that scale and cut at the box. One digit marked on each side, light blue: the top digit of the
 * sample reaching furthest above 0 V, and below (`topDigitOf` — those nearer the sign only repeat it;
 * −1, the sign alone, its last digit)
 */
function Excerpt({ c, shown, from, count, bits, stopped }: {
  c: Conversion; shown: readonly Sample[]; from: number; count: number; bits: number; stopped: (s: Sample) => boolean
}) {
  const { t, fmt } = useTranslation()
  const these = shown.slice(from, from + count), rate = c.setup.rate
  /** A sample's column: EXCERPT_S across the box */
  const colW = COLS_W / (EXCERPT_S * rate)
  const groupGap = bits > 4 ? BIT_GROUP_GAP : 0, lastGap = Math.floor((bits - 1) / 4) * groupGap
  // The last digit's row ends inside half the box
  const rowH = Math.min(BIT_ROW_MAX, Math.floor((EX_HALF - 4 - lastGap) / (bits - 0.5)))
  /** How far a digit's middle is from the 0 V line */
  const offset = (r: number) => r * rowH + Math.floor(r / 4) * groupGap
  // The zoom: the loudest sample shown on its word's last digit (silence: the analogue side's top at the box's edges)
  const loudest = Math.max(0, ...these.map((s) => Math.abs(s.value)))
  const px = loudest > 0 ? offset(bits - 1) / loudest : EX_HALF / ANALOG_TOP, vy = (v: number) => EX_CY - px * v
  const clip = useId()
  const x = (time: number) => COLS_X + (time * rate - from + 0.5) * colW
  const right = COLS_X + count * colW
  const dots = dotsOf(these, x, vy, EX_CY, stopped, colW, [COLS_X, right], [EX_TOP, EX_BOTTOM])
  const font = Math.min(BIT_FONT_MAX, rowH - BIT_FONT_GAP, colW * BIT_FONT_PER_COL)
  const codes = these.map((s) => codeOf(s.value, bits))
  /** Where a sample's digit is: its middle */
  const digitY = (i: number, r: number) => EX_CY + (codes[i] < 0 ? 1 : -1) * offset(r)
  /** The marks: each side's sample reaching furthest (its top digit nearest the sign, the bigger voltage if several) */
  const marks = [(k: number) => k > 0, (k: number) => k < 0].flatMap((side) => {
    let best: { i: number; r: number } | null = null
    codes.forEach((k, i) => {
      if (!side(k)) return
      const r = topDigitOf(k, bits) ?? bits - 1
      if (!best || r < best.r || (r === best.r && Math.abs(k) > Math.abs(codes[best.i]))) best = { i, r }
    })
    return best ? [best] : []
  })
  const markW = Math.min(colW - 4, font * 2.2)
  return (
    <g>
      <clipPath id={clip}><rect x={COLS_X} y={EX_TOP} width={right - COLS_X} height={EX_BOTTOM - EX_TOP} /></clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d={stepLines(COLS_X, right, bits, vy, px)} fill="none" stroke={FAINT} strokeWidth={1} />
        <line x1={COLS_X} y1={vy(FS_VOLTS)} x2={right} y2={vy(FS_VOLTS)} {...FULL_SCALE} />
        <line x1={COLS_X} y1={vy(-FS_VOLTS)} x2={right} y2={vy(-FS_VOLTS)} {...FULL_SCALE} />
        <line x1={COLS_X} y1={EX_CY} x2={right} y2={EX_CY} stroke={INK} strokeWidth={1} />
        <Dots dots={{ ...dots, r: 5, stem: 1.5 }} />
      </g>
      {marks.map(({ i, r }) => (
        <rect key={i} x={COLS_X + (i + 0.5) * colW - markW / 2} y={digitY(i, r) - rowH / 2 + 1} width={markW} height={rowH - 2} rx={4}
          fill={MOVER} fillOpacity={0.3} stroke={MOVER} strokeWidth={2.5} />
      ))}
      {these.map((s, i) => (
        <g key={i} className="lsc-dd-code" style={{ fontSize: font, fill: stopped(s) ? CLIPPED : 'var(--lsc-fg)', ...HALO }} textAnchor="middle">
          {bitsOf(codes[i], bits).map((on, r) => (
            <text key={r} x={COLS_X + (i + 0.5) * colW} y={digitY(i, r) + font * 0.36}>{on ? '1' : '0'}</text>
          ))}
        </g>
      ))}
      {/* The wave over the digits, in a blue that stands out of them (dark in the light theme) (the user's call, 2026-11-25) */}
      <path d={wavePath(x, (time) => c.received(time, PHASE), (from - 0.5) / rate, (from + count - 0.5) / rate, vy)}
        fill="none" stroke={WAVE_OVER} strokeWidth={4} strokeLinejoin="round" opacity={0.85} clipPath={`url(#${clip})`} />
      <Label at={[(NUM_L + NUM_R) / 2, ROW_2 + 262 - 20]} anchor="middle">
        {fmt(t.deepDive.labels.someSamples, { n: String(these.length), ms: msText(EXCERPT_S) })}
      </Label>
    </g>
  )
}


/** The dBFS meter's zones over the noise: green to −18, yellow to −2, red to 0 (the canvas's) */
const ZONES: readonly [MeterZoneKind, number][] = [['good', -18], ['hot', -2], ['clipping', 0]]

export function ConversionScene({ step }: SceneProps) {
  const settings = useConversion()
  const setSettings = settings.set
  const { t, fmt } = useTranslation()
  const l = t.deepDive.labels

  const c = conversionOf(setupAt(step, settings))
  const { rate, jitter } = c.setup
  const bits = c.setup.bits ?? settings.bits
  /** How long each graph is, how many samples it holds */
  const span = windowOf(c.setup.tone), perWindow = span * rate
  const { first, samples, shown } = picture(c, span)
  const { step: bitStep } = codeRange(bits)
  const top = c.setup.bits === null ? FS_VOLTS : codeRange(bits).top
  /** A sample stopped at full scale (or a few bits' top number) */
  const stopped = (s: Sample) => c.clipped && Math.abs(s.held) >= 0.98 * (s.held > 0 ? top : FS_VOLTS)
  const out = step >= DAC_STEP ? lineOutOf(c, samples, first, span) : null

  const px = PX_V, R1 = rowAt(ROW_1, px), R2 = rowAt(ROW_2, px)
  const inX = timeX(IN_X, span), adcX = timeX(ADC_X, span), outX = timeX(OUT_X, span, OUT_W)

  // The meter's marks: the bits' noise, a budget converter's own and a quality one's — each with how
  // far under the signal it is; their words stacked down the right, a leader to each
  const floor = floorOf(bits, 'quality')
  const marks = [
    { db: floor.bits, name: fmt(l.bitsFloor, { bits: bitsText(t, bits), db: minus(floor.bits) }) },
    { db: OWN_NOISE.budget, name: fmt(l.budgetNoise, { db: minus(OWN_NOISE.budget) }) },
    { db: OWN_NOISE.quality, name: fmt(l.qualityNoise, { db: minus(OWN_NOISE.quality) }) },
  ].sort((a, b) => b.db - a.db)
  const placed = stacked(marks)
  /** The line out: what the numbers hold, back in dBu (0 dBFS a peak of +18 dBu) */
  const lineOutLevel = { rms: c.digital.rms + ALIGNMENT_DB, peak: c.digital.peak + ALIGNMENT_DB }

  const dots = dotsOf(shown, adcX, R1.vy, R1.cy, stopped, GRAPH_W / perWindow, [ADC_X, ADC_X + GRAPH_W], [R1.top, R1.bottom])
  const { from, count } = excerptOf(c, shown.length)
  const lit = [Math.max(ADC_X, adcX((from - 0.5) / rate)), Math.min(ADC_X + GRAPH_W, adcX((from + count - 0.5) / rate))]
  const outPaths = out && lineOutPaths(out, span, R2)
  const meterTop = ROW_1 - H, meterBottom = ROW_1 + H

  return (
    <g>
      {/* 1 · Sampling: the line in and its meter; the filter, the A/D converter's graph — the wave it is fed, the samples; the clock */}
      <Step n={SAMPLE_STEP} step={step}>
        <Label at={[IN_X + 8, R1.top - 30]}>{l.lineLevel}</Label>
        <Axes x={IN_X} row={R1} />
        <AnalogLines x={IN_X} row={R1} />
        <path d={wavePath(inX, (time) => c.arriving(time, PHASE), 0, span, R1.vy)} fill="none" stroke={TRACE} strokeWidth={3} strokeLinejoin="round" />
        <TimeEnd x={IN_X} row={R1} span={span} />
        <LevelMeter x={IN_METER_X} y={R1.top} w={METER_W} h={2 * H} rms={c.analog.rms} peak={c.analog.peak} />
        <Peak x={IN_METER_X} y={R1.readY} peak={formatDb(c.analog.peak)} />

        <line x1={IN_X + GRAPH_W + 20} y1={R1.cy} x2={ADC_L} y2={R1.cy} stroke={INK} strokeWidth={2} />
        <Filter left={FILTER_L} right={FILTER_R} row={R1} />
        <rect x={ADC_L} y={R1.boxTop} width={ADC_R - ADC_L} height={R1.boxBottom - R1.boxTop} {...BOX} />
        <Label at={[(ADC_L + ADC_R) / 2, R1.nameY]} anchor="middle">{l.adc}</Label>
        <FullScale from={IN_X + GRAPH_W} to={ADC_X} row={R1} />
        <DigitalTop x={ADC_X} row={R1} />
        <Axes x={ADC_X} row={R1} />
        <path d={wavePath(adcX, (time) => c.received(time, PHASE), 0, span, R1.vy)} fill="none" stroke={TRACE} strokeWidth={2} opacity={0.35} />
        <Dots dots={dots} />
        <TimeEnd x={ADC_X} row={R1} span={span} />
        {jitter > 0 && <Label at={[ADC_X + 10, R1.boxTop + 34]}>{l.wobbleBigger}</Label>}

        {/* The clock between the rows, ticking at the sample rate, wired into the A/D converter's bottom; Steady or Wobbly left of it */}
        <ClockChoice wobbly={settings.wobbly} onPick={(wobbly) => setSettings({ wobbly })} />
        <rect x={CLOCK_L} y={CLOCK_TOP} width={CLOCK_R - CLOCK_L} height={CLOCK_BOTTOM - CLOCK_TOP} {...BOX} rx={8} />
        <path d={clockPath(jitter / JITTER_MAX)} fill="none" stroke={MOVER} strokeWidth={2} />
        <Label at={[(CLOCK_L + CLOCK_R) / 2, CLOCK_TOP - 13]} anchor="middle">{fmt(l.timesASecond, { n: numberText(rate) })}</Label>
        <path d={`M${CLOCK_R} ${CLOCK_WIRE_Y} H${CLOCK_INTO_ADC} V${R1.boxBottom}`} {...CLOCK_WIRE} />
      </Step>

      {/* 2 · Quantization: the steps and their numbers, the samples rounded; the meter; the numbers magnified, their bits */}
      <Step n={QUANT_STEP} step={step}>
        <path d={stepLines(ADC_X, ADC_X + GRAPH_W, bits, R1.vy, px)} fill="none" stroke={FAINT} strokeWidth={1} />
        <StepCodes bits={bits} row={R1} />
        <Label at={[ADC_X + GRAPH_W, R1.top - 10]} anchor="end">
          {fmt(bitStep * px < STEP_LINES_PX ? l.stepsTooClose : l.steps, { n: numberText(2 ** bits) })}
        </Label>
        {/* The stretch the numbers' box magnifies */}
        <rect x={lit[0]} y={R1.top} width={Math.max(0, lit[1] - lit[0])} height={2 * H} fill={MOVER} opacity={0.1} />

        {/* Its meter: the signal (its average solid, its peaks pale, a line at the peak), the noise under it grey */}
        <rect x={METER_X} y={meterTop} width={METER_W} height={2 * H} rx={2} fill={FAINT} opacity={0.5} />
        <rect x={METER_X} y={meterY(floor.total)} width={METER_W} height={meterBottom - meterY(floor.total)} fill={zoneColor('noise')} />
        {ZONES.map(([kind, to], i) => {
          const from = Math.max(floor.total, i ? ZONES[i - 1][1] : -Infinity)
          const solid = Math.min(to, c.digital.rms), pale = Math.min(to, c.digital.peak)
          return (
            <g key={kind} fill={zoneColor(kind)}>
              {solid > from && <rect x={METER_X} y={meterY(solid)} width={METER_W} height={meterY(from) - meterY(solid)} />}
              {pale > Math.max(from, solid) && <rect x={METER_X} y={meterY(pale)} width={METER_W} height={meterY(Math.max(from, solid)) - meterY(pale)} opacity={0.35} />}
            </g>
          )
        })}
        <line x1={METER_X - 3} y1={meterY(c.digital.peak)} x2={METER_X + METER_W + 3} y2={meterY(c.digital.peak)} stroke={INK} strokeWidth={1.5} />
        <Label at={[MARKS_X, meterTop + 6]}>0 dBFS</Label>
        {placed.map((m) => (
          <g key={m.name}>
            <line x1={METER_X - 4} y1={meterY(m.db)} x2={METER_X + METER_W + 4} y2={meterY(m.db)} stroke={INK} strokeWidth={1.5} />
            <path d={`M${METER_X + METER_W + 4} ${meterY(m.db)} L${MARKS_X - 6} ${m.y - 6}`} fill="none" stroke={PART} strokeWidth={0.75} strokeDasharray="3 3" />
            <Label at={[MARKS_X, m.y]}>{m.name}</Label>
            {c.digital.rms - m.db >= 1 && <Label at={[MARKS_X, m.y + 26]}>{fmt(l.underSignal, { db: String(Math.round(c.digital.rms - m.db)) })}</Label>}
          </g>
        ))}
        <Peak x={METER_X} y={R1.readY} peak={formatDb(c.digital.peak, 'digital')} />

        {/* The numbers, as tall as both rows */}
        <line x1={ADC_R} y1={R1.cy} x2={NUM_L} y2={R1.cy} {...DIGITAL} />
        <rect x={NUM_L} y={R1.boxTop} width={NUM_R - NUM_L} height={R2.boxBottom - R1.boxTop} {...BOX} />
        <Label at={[(NUM_L + NUM_R) / 2, R2.nameY]} anchor="middle">{fmt(l.numbers, { bits: bitsText(t, bits) })}</Label>
        <Excerpt c={c} shown={shown} from={from} count={count} bits={bits} stopped={stopped} />
      </Step>

      {/* 3 · Analogue conversion: the digital line from the A/D converter down to the D/A converter, its steps, the filter after it; the line out, never quite what came in */}
      <Step n={DAC_STEP} step={step}>
        <path d={`M${TAP_X} ${R1.cy} V${DIGITAL_Y} H${DIGITAL_INTO_DAC} V${R2.boxTop}`} {...DIGITAL} />
        <circle cx={TAP_X} cy={R1.cy} r={6} fill={MOVER} />
        <path d={`M${(CLOCK_L + CLOCK_R) / 2} ${CLOCK_BOTTOM} V${R2.boxTop}`} {...CLOCK_WIRE} />
        <rect x={DAC_L} y={R2.boxTop} width={DAC_R - DAC_L} height={R2.boxBottom - R2.boxTop} {...BOX} />
        <Label at={[(DAC_L + DAC_R) / 2, R2.nameY]} anchor="middle">{l.dac}</Label>
        <DigitalTop x={DAC_X} row={R2} />
        <Axes x={DAC_X} row={R2} />
        <path d={stepLines(DAC_X, DAC_X + GRAPH_W, bits, R2.vy, px)} fill="none" stroke={FAINT} strokeWidth={1} />
        <path d={stairsOf(shown, rate, span, R2)} fill="none" stroke={MOVER} strokeWidth={2.5} strokeLinejoin="round" />
        <TimeEnd x={DAC_X} row={R2} span={span} />

        <line x1={DAC_R} y1={R2.cy} x2={OUT_FILTER_L} y2={R2.cy} stroke={INK} strokeWidth={2} />
        <Filter left={OUT_FILTER_L} right={OUT_FILTER_R} row={R2} />
        <line x1={OUT_FILTER_R} y1={R2.cy} x2={OUT_X} y2={R2.cy} stroke={INK} strokeWidth={2} />
        <Label at={[OUT_X + 8, R2.top - 30]}>{l.lineOutReading}</Label>
        <Axes x={OUT_X} row={R2} w={OUT_W} />
        <AnalogLines x={OUT_X} row={R2} w={OUT_W} />
        {outPaths && <path d={outPaths.gap} fill={WRONG} opacity={0.5} stroke="none" />}
        <path d={wavePath(outX, (time) => c.arriving(time, PHASE), 0, span, R2.vy)} fill="none" stroke={INK} strokeWidth={1.25} strokeDasharray="4 4" opacity={0.6} />
        {outPaths && <path d={outPaths.path} fill="none" stroke={TRACE} strokeWidth={3} strokeLinejoin="round" />}
        <TimeEnd x={OUT_X} row={R2} span={span} w={OUT_W} />
        {out && (
          <>
            <text className="lsc-dd-reading" x={OUT_X} y={R2.readY}>{fmt(l.difference, { db: minus(out.db) })}</text>
            <Label at={[OUT_X, R2.readY + 30]}>{l.heard[heardOf(out.db)]}</Label>
          </>
        )}
        <LevelMeter x={OUT_METER_X} y={R2.top} w={METER_W} h={2 * H} rms={lineOutLevel.rms} peak={lineOutLevel.peak} />
        <Peak x={OUT_METER_X} y={R2.readY} peak={formatDb(lineOutLevel.peak)} />
      </Step>
    </g>
  )
}

/**
 * The clock's buttons, Steady and Wobbly, after its name, left of it on the picture (they grow with
 * it), lit as the controls' buttons are; each as wide as its word (measured)
 */
function ClockChoice({ wobbly, onPick }: { wobbly: boolean; onPick: (wobbly: boolean) => void }) {
  const { t } = useTranslation()
  const l = t.deepDive.labels
  const name = useRef<SVGTextElement>(null)
  const words = useRef<(SVGTextElement | null)[]>([])
  const [widths, setWidths] = useState<readonly number[]>([0, 0, 0])
  const options = [false, true] as const
  const texts = options.map((w) => (w ? l.wobbly : l.steady))

  useLayoutEffect(() => {
    const measured = [name.current, ...words.current].map((el) => el?.getComputedTextLength() ?? 0)
    setWidths((was) => (was.every((w, i) => w === measured[i]) ? was : measured))
  }, [l.clock, l.steady, l.wobbly])

  const PAD = 16
  const boxes = widths.slice(1).map((w) => w + 2 * PAD)
  const total = widths[0] + 14 + boxes.reduce((a, b) => a + b + CHOICE_GAP, 0) - CHOICE_GAP
  const left = CLOCK_L - 20 - total, top = CLOCK_WIRE_Y - CHOICE_H / 2
  let x = left + widths[0] + 14
  return (
    <g role="group" aria-label={l.clock} style={{ visibility: widths[0] ? undefined : 'hidden' }}>
      <text ref={name} className="lsc-dd-label" x={left} y={CLOCK_WIRE_Y + 7}>{l.clock}</text>
      {options.map((o, i) => {
        const on = o === wobbly, at = x
        x += boxes[i] + CHOICE_GAP
        const pick = () => onPick(o)
        const onKey = (e: KeyboardEvent) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          pick()
        }
        return (
          <g key={String(o)} role="button" tabIndex={0} aria-pressed={on} onClick={pick} onKeyDown={onKey} className="lsc-dd-choice">
            <rect x={at} y={top} width={boxes[i]} height={CHOICE_H} rx={12}
              fill={on ? 'var(--lsc-accent-bg)' : 'transparent'} stroke={on ? 'var(--lsc-accent)' : 'var(--lsc-border)'} strokeWidth={2} />
            <text ref={(el) => { words.current[i] = el }} className="lsc-dd-reading" x={at + PAD} y={CLOCK_WIRE_Y + 8}>{texts[i]}</text>
          </g>
        )
      })}
    </g>
  )
}

/** The clock's square wave in its box: steady, or each tick early or late (`wobble`: 0 … 1 of the most) */
function clockPath(wobble: number): string {
  const from = CLOCK_L + 10, to = CLOCK_R - 10, ticks = 8, w = (to - from) / ticks, hi = CLOCK_TOP + 12, lo = CLOCK_BOTTOM - 12
  let d = `M${from} ${lo}`
  for (let i = 0; i < ticks; i++) {
    const up = from + i * w + wobble * [0.3, -0.25, 0.15, -0.3, 0.2, -0.1, 0.25, -0.2][i] * w, down = up + w / 2
    d += ` H${up.toFixed(1)} V${hi} H${down.toFixed(1)} V${lo}`
  }
  return `${d} H${to}`
}

// ── The controls under the picture ──────────────────────────────────────────
const group: CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }
const caption: CSSProperties = { fontSize: 12, color: 'var(--lsc-fg-muted)', whiteSpace: 'nowrap', marginRight: 2 }
const choice: CSSProperties = {
  height: 30, padding: '0 6px', borderRadius: 8, border: '1px solid var(--lsc-border)', background: 'transparent',
  color: 'var(--lsc-fg)', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
}

/** A setting's buttons, one a choice (the one in use lit, as the steps' shapes are); `hidden`: its room kept */
function Choices<T>({ name, options, value, text, onPick, hidden = false }: {
  name: string; options: readonly T[]; value: T; text: (v: T) => string; onPick: (v: T) => void; hidden?: boolean
}) {
  return (
    <div role="group" aria-label={name} aria-hidden={hidden || undefined} style={{ ...group, visibility: hidden ? 'hidden' : undefined }}>
      {options.map((o) => {
        const on = o === value
        return (
          <button
            key={String(o)} onClick={() => onPick(o)} aria-pressed={on} className="lsc-btn-outline" tabIndex={hidden ? -1 : undefined}
            // Both colours always set: dropping `borderColor` would clear the shorthand's too
            style={{ ...choice, borderColor: on ? 'var(--lsc-accent)' : 'var(--lsc-border)', background: on ? 'var(--lsc-accent-bg)' : 'transparent' }}
          >
            {text(o)}
          </button>
        )
      })}
    </div>
  )
}

/** A named control and its value after it, as wide as its widest (`reserve`); `shrink`: giving way on a narrow screen */
function Named({ name, text, reserve, shrink = false, children }: {
  name: string; text: string; reserve: string[]; shrink?: boolean; children: ReactNode
}) {
  return (
    <div style={{ ...group, gap: 8, ...(shrink ? { flexShrink: 1, minWidth: 0 } : null) }}>
      <span style={caption}>{name}</span>
      {children}
      <StableText reserve={reserve} style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{text}</StableText>
    </div>
  )
}

/** The gain knob's size: as big as the two rows of buttons beside it allow */
const KNOB = 40

/**
 * The subject's controls under the picture (the clock's are on it): the `knobs`, at every step —
 * the gain knob first (the line in's), the frequency's slider (20 Hz … 30 kHz in third octaves) —, the
 * `choices` — the sample rate's buttons over the bit depth's (their units say what they are; the bit
 * depth's room kept until its step)
 */
export function ConversionControls({ step, part }: { step: number; part: 'knobs' | 'choices' }) {
  const s = useConversion()
  const { t, fmt } = useTranslation()
  const l = t.deepDive.labels
  if (part === 'choices') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
        <Choices name={l.sampleRate} options={RATES} value={s.rate as (typeof RATES)[number]} text={(r) => rateText(t, r)} onPick={(rate) => s.set({ rate })} />
        <Choices name={l.bitDepth} options={BIT_DEPTHS} value={s.bits as (typeof BIT_DEPTHS)[number]} text={(b) => bitsText(t, b)} onPick={(bits) => s.set({ bits })} hidden={step < QUANT_STEP} />
      </div>
    )
  }
  const dB = (gain: number) => `${gain > 0 ? '+' : gain < 0 ? '−' : '±'}${Math.abs(gain)} ${l.db}`
  /** A tone in Hz below 1 kHz, else in kHz (31.5 Hz, 1.25 kHz) */
  const toneText = (hz: number) => (hz < 1000 ? fmt(l.hz, { n: String(hz) }) : fmt(t.formats.rate, { n: String(hz / 1000) }))
  const toneAt = Math.max(0, TONES.indexOf(s.tone as (typeof TONES)[number]))
  const gainMin = LEVEL_MIN - LEVEL_START, gainMax = LEVEL_MAX - LEVEL_START, gainText = dB(s.gain)
  return (
    // The slider gives way (down to 100 px) where the panel is narrow: the row then fits from 1024 px
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexShrink: 1, minWidth: 0, marginLeft: 12 }}>
      <Named name={l.gain} text={gainText} reserve={[dB(gainMin), dB(gainMax)]}>
        <svg width={KNOB} height={KNOB} style={{ flexShrink: 0, overflow: 'visible' }}>
          <SceneKnob
            cx={KNOB / 2} cy={KNOB / 2} r={KNOB / 2 - 1} color="var(--lsc-accent)"
            value={s.gain} min={gainMin} max={gainMax} round={(v) => Math.round(Math.min(gainMax, Math.max(gainMin, v)))}
            onChange={(gain) => s.set({ gain })} label={l.gain} valueText={gainText}
          />
        </svg>
      </Named>
      <Named name={l.frequency} text={toneText(s.tone)} reserve={TONES.map(toneText)} shrink>
        {/* Its steps the third-octave bands: as many in each octave, low or high */}
        <input
          type="range" min={0} max={TONES.length - 1} step={1} value={toneAt}
          aria-label={l.frequency} aria-valuetext={toneText(s.tone)}
          onChange={(e) => s.set({ tone: TONES[Number(e.target.value)] })} className="lsc-dd-slider" style={{ flex: '0 1 220px', minWidth: 100 }}
        />
      </Named>
    </div>
  )
}
