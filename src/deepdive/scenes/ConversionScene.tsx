import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { ALIGNMENT_DB, formatDb, zoneColor } from '../../signal/levels'
import type { MeterZoneKind } from '../../signal/levels'
import { bitsText, rateText } from '../../utils/formatText'
import {
  ANALOG_TOP, BIT_DEPTHS, FLOAT_BIAS, FLOAT_BITS, FLOAT_EXP_BITS, FLOAT_MANTISSA_BITS, FLOAT_OFFSET_DB,
  FS_VOLTS, JITTER_MAX, LEVEL_MAX, LEVEL_MIN, LEVEL_START, RATES, RECONSTRUCT_TAPS, TONES,
  bitsOf, codeOf, codeRange, conversionOf, floatBitsOf, floatExponentOf, floorOf, playedOf,
  samplesOf, topDigitOf, turnDownOf, windowOf, zoomOf,
} from '../converter'
import type { Conversion, Sample, Setup } from '../converter'
import { ARROW_INK, FAINT, FLOW, INK, MOVER, PART, PART_2, TRACE } from './look'
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
// knob makes the wave bigger or smaller — only slower: a quiet wave is drawn zoomed, a third of its dB
// under full scale (`zoomOf`), the +20 dBu and full-scale lines where they are (the user's call,
// 2026-11-28: line level drawn as +13 dBu's was; it was no zoom, 2026-11-25). Every graph covers the same stretch of time (`windowOf`: 0.1 s at 20 Hz, two
// cycles, down to 0.15 ms at 20 kHz, three — never more than three: 2026-11-28). The picture stands still (a sine is the same moving or not):
// the controls under it set it (`useConversion`) — the gain knob and the frequency's slider at every
// step (the user's call, 2026-11-25), the sample rate's buttons, the bit depth's from its step; the clock's are on the picture, beside it.
// (1) Sampling: the line in (its meter in dBu), the filter before the converter (always in), the
//     A/D converter's graph — the wave it is fed (faint) and at each tick of the clock a sample,
//     already rounded to the bit depth picked (its steps drawn from step 2 — the user's call,
//     2026-11-26); the clock between the rows, Steady or Wobbly (a wobbly one takes the samples early
//     or late, drawn thousands of times bigger, played back on time).
// (2) Quantization: each sample rounded to the nearest of its bit depth's steps; the converter's
//     meter (dBFS) right of the numbers, as tall as both rows — the signal, the noise its bits leave,
//     how far under the signal it is; the numbers: the first EXCERPT_COUNT samples magnified, each
//     one's number standing on the box's bottom line (its last digit next to it), a line from each
//     one's top digit to the next — that stretch lit on the graph.
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

/** A row's heights around its middle line `cy`, its graphs' half-height `h`, its voltage `px` px a volt, its signals drawn `zoom` times bigger */
function rowAt(cy: number, px: number, h = H, zoom = 1) {
  return {
    cy, px, h, zoom, vy: (volts: number) => cy - px * volts,
    /** Where a signal is drawn: its voltage zoomed (`zoomOf` — the lines stay at `vy`) */
    sy: (volts: number) => cy - px * zoom * volts,
    top: cy - h, bottom: cy + h,
    /** Its boxes, their names under them; the readings under its meters */
    boxTop: cy - h - 30, boxBottom: cy + h + 72, nameY: cy + h + 104, readY: cy + h + 42,
  }
}
type Row = ReturnType<typeof rowAt>
/** Row 1: the line in, the A/D converter, its numbers. Row 2: the D/A converter, its filter, the line out */
const ROW_1 = 260, ROW_2 = 900
/**
 * At step 2, with no row 2 yet, row 1 as tall as the numbers' box (the user's call, 2026-11-26): its
 * middle line and half-height (its boxes from the numbers' top to their bottom); back at step 3
 */
const TALL_CY = 580, TALL_H = 510
/** Each graph's width (the window's time); the line out's, as wide as the A/D converter */
const GRAPH_W = 720, METER_W = 16
/** Row 1 · the line in's graph and its meter left of it; the filter; the A/D converter, its graph */
const IN_METER_X = -20, IN_X = 60
const FILTER_L = 830, FILTER_R = 885
const ADC_L = 905, ADC_X = 945, ADC_R = 1720
/**
 * The numbers' box, as tall as both rows, right of them: the first EXCERPT_COUNT samples, from the
 * graph's start, whatever is picked (the user's call, 2026-11-28), a column a sample, its columns
 * `COLS_W` wide in all (the boxes' sizes from the user's edited screenshot, 2026-11-26)
 */
const NUM_L = 1880, NUM_R = 2920, EXCERPT_COUNT = 24, COLS_X = NUM_L + 30, COLS_W = NUM_R - NUM_L - 60
/**
 * The A/D converter's meter right of the numbers' box, as tall as both rows (the user's call,
 * 2026-11-26): its top and bottom, the marks' words right of it
 */
const METER_X = NUM_R + 60, METER_TOP = ROW_1 - H, METER_BOTTOM = 1030, MARKS_X = METER_X + 60
/**
 * Step 4 · 32-bit float. The numbers' box grows down to hold 32 rows (the user said there was room,
 * 2026-11-28); the meter keeps its place but makes room above 0 dBFS, since a float number goes
 * there. The comparison trace is what a 24-bit recorder would have written with the same knob.
 */
const FLOAT_BASE = 1390, FLOAT_BOX_BOTTOM = 1500, COMPARE_BITS = 24
/** Its columns are indented, leaving a gutter down the box's left for each group's name, upright */
const FLOAT_COLS_X = NUM_L + 76, FLOAT_COLS_W = NUM_R - FLOAT_COLS_X - 30
/** The meter at step 4: the two converters' full scale at its top, so the overs have somewhere to go */
const FLOAT_METER_TOP = FLOAT_OFFSET_DB, FLOAT_METER_BOTTOM = -150
/** Between the rows · the clock (its buttons left of it), its wires into the A/D converter's bottom and the D/A converter's top */
const CLOCK_L = 340, CLOCK_R = 480, CLOCK_TOP = 565, CLOCK_BOTTOM = 615, CLOCK_WIRE_Y = 590, CLOCK_INTO_ADC = 1000
const CHOICE_H = 50, CHOICE_GAP = 8
/** The A/D converter's box's bottom the clock is laid out under (it moves down with a taller box) */
const CLOCK_UNDER = ROW_1 + H + 72
/** The digital line out of the A/D converter: on into the numbers' box, and from `TAP_X` down and round into the D/A converter */
const TAP_X = (ADC_R + NUM_L) / 2, DIGITAL_Y = 640, DIGITAL_INTO_DAC = 700
/** Row 2 · the D/A converter, its graph; the filter after it; the line out under the A/D converter, as wide, its meter */
const DAC_L = 20, DAC_X = 60, DAC_R = 840
const OUT_FILTER_L = 870, OUT_FILTER_R = 925
/** (the line out's graph 50 right of the A/D converter's, so its 0 V clears the filter — 2026-11-25; its meter where it was) */
const OUT_X = ADC_X + 50, OUT_W = ADC_R - OUT_X - 90, OUT_METER_X = OUT_X + OUT_W + 50

export const SAMPLE_STEP = 1, QUANT_STEP = 2, DAC_STEP = 3, FLOAT_STEP = 4
/** The tone's phase at the graphs' left edge */
const PHASE = 0
/** Points a wave is drawn with */
const POINTS = 1440
/** The steps' lines are drawn while at least this far apart; each sample's faint line while the samples are */
const STEP_LINES_PX = 4, SAMPLE_LINES_PX = 8
/**
 * Big bold words (the user's calls, 2026-11-28): the converters' names — the A/D converter's above its
 * box, `BIG_GAP` from it — and the A/D converter's two readings under its bottom line (how fine
 * 24 bits and 96 kHz are, a "wow" — no longer "too close together to draw"): the samples in its whole
 * window, the bits and their steps under them, `BIG_LINE` apart
 */
const BIG = { fontSize: 28, fontWeight: 700 } as const, BIG_GAP = 10, BIG_LINE = 36

/** Big bold words at a point */
function Big({ at: [x, y], anchor = 'end', children }: { at: readonly [number, number]; anchor?: 'start' | 'middle' | 'end'; children: ReactNode }) {
  return <text className="lsc-dd-reading" style={BIG} x={x} y={y} textAnchor={anchor}>{children}</text>
}

/**
 * What the converter is set to: every step the same (the bit depth too, from step 1 — 2026-11-26).
 * At step 4 the one gain knob moves from before the converter to after it (the user's call,
 * 2026-11-28: "you never turn two gain knobs"): the sound arriving is then fixed — a float recorder
 * has no gain to set — and the knob multiplies the numbers instead, which cannot clip them.
 */
function setupAt(s: ConversionSettings, step: number): Setup {
  const float = step >= FLOAT_STEP
  return {
    rate: s.rate,
    bits: s.bits,
    jitter: s.wobbly ? JITTER_MAX : 0,
    grade: 'quality',
    filter: true,
    tone: s.tone,
    level: float ? LEVEL_START : LEVEL_START + s.gain,
    ...(float ? { float: true, numberGain: s.gain } : null),
  }
}

/** What a 24-bit recorder makes of the same knob, set the old way — before its one converter */
function comparedAt(s: ConversionSettings, from: Setup): Setup {
  return { ...from, float: false, numberGain: 0, bits: COMPARE_BITS, level: LEVEL_START + s.gain }
}

/** A graph's x of a moment, its window `span` long (s), `w` wide */
const timeX = (left: number, span: number, w = GRAPH_W) => (t: number) => left + (w * t) / span
/** The A/D converter's meter: 0 dBFS at its top, −150 at its bottom */
const meterY = (db: number) => METER_TOP + ((METER_BOTTOM - METER_TOP) * Math.min(150, Math.max(0, -db))) / 150
/** The same meter at step 4, with the two converters' full scale at its top instead of 0 dBFS */
const floatMeterY = (db: number) => {
  const share = (FLOAT_METER_TOP - Math.min(FLOAT_METER_TOP, Math.max(FLOAT_METER_BOTTOM, db))) / (FLOAT_METER_TOP - FLOAT_METER_BOTTOM)
  return METER_TOP + (METER_BOTTOM - METER_TOP) * share
}
/**
 * How many times bigger a float number is drawn. A quiet one as ever (`zoomOf`), but one whose peak
 * has passed the canvas's top is drawn smaller so the whole wave is seen: it is the wave standing
 * above the 0 dBFS line that matters, and the readings say how far
 */
const ANALOG_TOP_DBU = 20 * Math.log10(ANALOG_TOP / 0.775)
function floatZoomOf(peakDbu: number): number {
  return peakDbu > ANALOG_TOP_DBU ? 10 ** ((ANALOG_TOP_DBU - peakDbu) / 20) : zoomOf(peakDbu)
}

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
function lineOutOf(c: Conversion, samples: readonly Sample[], first: number, span: number, should?: (t: number) => number) {
  const out: number[] = [], want: number[] = []
  let peak = 0, sq = 0, sig = 0
  for (let i = 0; i <= POINTS; i++) {
    const t = (span * i) / POINTS, o = c.output(t, samples, first), w = should ? should(t) : c.arriving(t, PHASE)
    out.push(o); want.push(w)
    peak = Math.max(peak, Math.abs(o))
    sq += (o - w) ** 2; sig += w * w
  }
  return { out, want, peak, db: sig > 0 ? 10 * Math.log10(Math.max(sq, 1e-30) / sig) : 0 }
}

/** The line out's wave and the gap between it and what came in (an area) */
function lineOutPaths(o: ReturnType<typeof lineOutOf>, span: number, row: Row) {
  const x = timeX(OUT_X, span, OUT_W), at = (i: number) => (span * i) / POINTS
  const point = (i: number, v: number) => `${x(at(i)).toFixed(1)} ${row.sy(v).toFixed(1)}`
  const path = o.out.map((v, i) => `${i ? 'L' : 'M'}${point(i, v)}`).join(' ')
  let gap = path
  for (let i = POINTS; i >= 0; i--) gap += ` L${point(i, o.want[i])}`
  return { path, gap: `${gap} Z` }
}

/** The meter's marks' words stacked down its right (each below the one before), a leader to each */
function stacked<T extends { db: number }>(marks: readonly T[]): (T & { y: number })[] {
  const out: (T & { y: number })[] = []
  for (const m of marks) {
    const y = Math.max(meterY(m.db) + 6, out.length ? out[out.length - 1].y + 56 : METER_TOP + 40)
    out.push({ ...m, y })
  }
  return out
}

/** The D/A converter's steps: each number held until the next */
function stairsOf(shown: readonly Sample[], rate: number, span: number, row: Row, held: (s: Sample) => number = (s) => s.value): string {
  const dacX = timeX(DAC_X, span)
  return shown.map((s, i) => {
    const y = row.sy(held(s)).toFixed(1), to = Math.min(dacX((i + 1) / rate), DAC_X + GRAPH_W).toFixed(1)
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

/**
 * The bit depth's steps from `x` to `to`, zoomed with the samples on them (those drawn inside the
 * full-scale lines), while far enough apart to be seen
 */
function stepLines(x: number, to: number, bits: number, row: Row): string {
  const { step } = codeRange(bits), half = 2 ** (bits - 1)
  if (step * row.px * row.zoom < STEP_LINES_PX) return ''
  let d = ''
  for (let k = -half; k < half; k++) if (Math.abs(k * step * row.zoom) <= FS_VOLTS * 1.001) d += `M${x} ${row.sy(k * step).toFixed(1)} H${to} `
  return d
}

/** A meter's peak, under it */
function Peak({ x, y, peak }: { x: number; y: number; peak: string }) {
  const { t, fmt } = useTranslation()
  return <text className="lsc-dd-reading" x={x} y={y}>{fmt(t.deepDive.labels.peak, { db: peak })}</text>
}

/**
 * The numbers' box's graph: its top and bottom, the line every number stands on at its bottom (both
 * sides of the wave up from it — the user's call, 2026-11-28: so 24 bits fit in the box)
 */
const EX_TOP = ROW_1 - 220 + 30, EX_BOTTOM = ROW_2 + 262 - 60, EX_BASE = EX_BOTTOM
/**
 * A digit's row, the same at every bit depth (no zoom — the user's call, 2026-11-26: the numbers grow
 * taller with the bits, the lesson how much bigger the file grows); the gap after every four digits past 4 bits
 */
const BIT_ROW = 40, BIT_GROUP_GAP = 4
/** Their font: at most this, and a digit (0.6 of it wide) with room beside it in its column */
const BIT_FONT_MAX = 20, BIT_FONT_PER_COL = 1.25
/** The digits' halo, in the box's colour, so they read over the line */
const HALO = { paintOrder: 'stroke', stroke: 'var(--lsc-sunken)', strokeWidth: 4, strokeLinejoin: 'round' } as const
/** The line through them: a blue standing out of them — dark in the light theme, the Phase button's in the dark one */
const WAVE_OVER = 'var(--lsc-dd-wave-over)'

/**
 * The line through the numbers' box: each number's top digit (its height), held across its column,
 * a step between columns
 */
function topLinePath(ys: readonly number[], colW: number, left = COLS_X): string {
  return ys.map((y, i) => `${i ? 'V' : `M${left} `}${y.toFixed(1)} H${(left + (i + 1) * colW).toFixed(1)}`).join(' ')
}

/**
 * The numbers' box (the user's calls, 2026-11-25, 26 and 28 — "we are sound engineers"): the first
 * EXCERPT_COUNT samples magnified, a column each (the same at every sample rate). Each sample's number stands on the line at the box's bottom in its column, turned round:
 * its last digit next to the line, the sign at the top — both sides of the wave (0… and 1…) up the
 * same way (the user's call, 2026-11-28: 24 bits fit in the box) —, in fours past 4 bits, rows of
 * BIT_ROW at every bit depth, each over a halo. Its top digit (`topDigitOf`: the first after the sign
 * that differs from it — −1, the sign alone, its last digit) ringed, and a line from each top digit to
 * the next: a staircase of how many digits each sample uses (a row about 6 dB), on either side, not
 * of its voltage — the wave's own shape is step 3's. A clipped sample's number red
 */
function Excerpt({ c, bits, stopped }: { c: Conversion; bits: number; stopped: (s: Sample) => boolean }) {
  const { t, fmt } = useTranslation()
  const these = samplesOf(c, PHASE, 0, EXCERPT_COUNT - 1), rate = c.setup.rate
  /** A sample's column */
  const colW = COLS_W / EXCERPT_COUNT
  const groupGap = bits > 4 ? BIT_GROUP_GAP : 0
  /** How far a digit's middle is from the 0 V line: the last digit's row next to it, the sign's furthest out */
  const offset = (r: number) => (bits - r) * BIT_ROW + Math.floor((bits - r - 1) / 4) * groupGap
  const clip = useId()
  const right = COLS_X + EXCERPT_COUNT * colW
  const font = Math.min(BIT_FONT_MAX, colW * BIT_FONT_PER_COL)
  const codes = these.map((s) => codeOf(s.value, bits))
  /** Where a sample's digit is: its middle */
  const digitY = (r: number) => EX_BASE - offset(r)
  /** Each number's top digit (0 has none: its line on the bottom line) */
  const tops = codes.map((k) => (k === 0 ? null : (topDigitOf(k, bits) ?? bits - 1)))
  const ring = Math.max(4, Math.min(font * 0.75, colW / 2 - 1))
  const colX = (i: number) => COLS_X + (i + 0.5) * colW
  return (
    <g>
      <clipPath id={clip}><rect x={COLS_X} y={EX_TOP} width={right - COLS_X} height={EX_BOTTOM - EX_TOP} /></clipPath>
      <g clipPath={`url(#${clip})`}>
        <line x1={COLS_X} y1={EX_BASE} x2={right} y2={EX_BASE} stroke={INK} strokeWidth={1} />
        {/* The line from each number's top digit to the next one's, under the rings */}
        <path d={topLinePath(tops.map((r) => (r === null ? EX_BASE : digitY(r))), colW)}
          fill="none" stroke={WAVE_OVER} strokeWidth={4} strokeLinejoin="round" />
        {tops.map((r, i) => r !== null && (
          <circle key={i} cx={colX(i)} cy={digitY(r)} r={ring} fill="var(--lsc-sunken)" stroke={FLOW} strokeWidth={2.5} />
        ))}
        {these.map((s, i) => (
          <g key={i} className="lsc-dd-code" style={{ fontSize: font, fill: stopped(s) ? CLIPPED : INK, ...HALO }} textAnchor="middle">
            {bitsOf(codes[i], bits).map((on, r) => (
              <text key={r} x={colX(i)} y={digitY(r) + font * 0.36}>{on ? '1' : '0'}</text>
            ))}
          </g>
        ))}
      </g>
      <Label at={[(NUM_L + NUM_R) / 2, ROW_2 + 262 - 20]} anchor="middle">
        {fmt(t.deepDive.labels.someSamples, { n: String(these.length), ms: msText(EXCERPT_COUNT / rate) })}
      </Label>
    </g>
  )
}


/**
 * Step 4's numbers' box: the same EXCERPT_COUNT samples, written as IEEE 754 singles — the browser's
 * own digits (`floatBitsOf`), nothing faked. 32 rows in three groups, standing on the box's bottom
 * line and turned round as the whole numbers are: 1 sign digit furthest out, then 8 exponent digits,
 * then 23 of detail with the last next to the line. The line through them is the exponent, drawn at
 * the row it names (127, which is 1.0 and so 0 dBFS, is row 24): exactly the staircase the integer
 * box's ringed top digit drew — only here it is stored on its own, with 24 digits of detail under it
 * whatever row it sits on. That is the whole of 32-bit float in one picture.
 */
const FLOAT_ROW = BIT_ROW, FLOAT_GROUP_GAP = 10
/** The groups, in order from the sign: how many rows each has and what colour its digits are */
const FLOAT_GROUPS = [
  { rows: 1, colour: PART_2 },
  { rows: FLOAT_EXP_BITS, colour: MOVER },
  { rows: FLOAT_MANTISSA_BITS, colour: TRACE },
] as const
/** A gap below every row that ends a group */
const floatGaps = (r: number) => (r <= 0 ? 1 : 0) + (r <= FLOAT_EXP_BITS ? 1 : 0)
/** How far a digit's middle is from the box's bottom line */
const floatOffset = (r: number) => (FLOAT_BITS - 1 - r) * FLOAT_ROW + floatGaps(r) * FLOAT_GROUP_GAP
/** Which row the exponent names: 127 (1.0, so 0 dBFS) is the row a 24-bit number's top digit filled */
const floatStairRow = (exp: number) => Math.max(0, Math.min(FLOAT_BITS, exp - (FLOAT_BIAS - 24)))

function FloatExcerpt({ c }: { c: Conversion }) {
  const { t, fmt } = useTranslation()
  const these = samplesOf(c, PHASE, 0, EXCERPT_COUNT - 1)
  const colW = FLOAT_COLS_W / EXCERPT_COUNT
  const clip = useId()
  const left = FLOAT_COLS_X, right = left + EXCERPT_COUNT * colW
  const font = Math.min(BIT_FONT_MAX, colW * BIT_FONT_PER_COL)
  const colX = (i: number) => left + (i + 0.5) * colW
  const digitY = (r: number) => FLOAT_BASE - floatOffset(r)
  /** Each sample as a share of full scale: that is the number the recorder writes */
  const shares = these.map((s) => s.value / FS_VOLTS)
  const stairY = shares.map((v) => FLOAT_BASE - floatStairRow(floatExponentOf(v)) * FLOAT_ROW)
  /** Which group a row belongs to */
  const groupOf = (r: number) => (r === 0 ? 0 : r <= FLOAT_EXP_BITS ? 1 : 2)
  return (
    <g>
      <clipPath id={clip}><rect x={left - 14} y={EX_TOP} width={right - left + 28} height={FLOAT_BASE + 14 - EX_TOP} /></clipPath>
      <g clipPath={`url(#${clip})`}>
        {/* Each group's band behind its digits, in its own colour */}
        {FLOAT_GROUPS.map(({ rows, colour }, g) => {
          const from = g === 0 ? 0 : g === 1 ? 1 : 1 + FLOAT_EXP_BITS
          const top = digitY(from) - FLOAT_ROW / 2, bottom = digitY(from + rows - 1) + FLOAT_ROW / 2
          return <rect key={g} x={left - 10} y={top} width={right - left + 20} height={bottom - top} rx={6} fill={colour} opacity={0.09} />
        })}
        <line x1={left} y1={FLOAT_BASE + 14} x2={right} y2={FLOAT_BASE + 14} stroke={INK} strokeWidth={1} />
        {/* The exponent's staircase: the row each number reaches up to */}
        <path d={topLinePath(stairY, colW, left)} fill="none" stroke={WAVE_OVER} strokeWidth={4} strokeLinejoin="round" />
        {stairY.map((y, i) => (
          <circle key={i} cx={colX(i)} cy={y} r={Math.max(4, Math.min(font * 0.6, colW / 2 - 1))}
            fill="var(--lsc-sunken)" stroke={FLOW} strokeWidth={2.5} />
        ))}
        {shares.map((v, i) => (
          <g key={i} className="lsc-dd-code" style={{ fontSize: font, ...HALO }} textAnchor="middle">
            {floatBitsOf(v).map((on, r) => (
              <text key={r} x={colX(i)} y={digitY(r) + font * 0.36} fill={FLOAT_GROUPS[groupOf(r)].colour}>{on ? '1' : '0'}</text>
            ))}
          </g>
        ))}
      </g>
      {/* What each group is, turned a quarter in the gutter down the box's left edge */}
      {FLOAT_GROUPS.map(({ rows }, g) => {
        const from = g === 0 ? 0 : g === 1 ? 1 : 1 + FLOAT_EXP_BITS
        const mid = (digitY(from) + digitY(from + rows - 1)) / 2
        const name = [t.deepDive.labels.floatSign, t.deepDive.labels.floatExponent, t.deepDive.labels.floatDetail][g]
        return (
          <text key={g} className="lsc-dd-label" textAnchor="middle" transform={`translate(${NUM_L + 40} ${mid}) rotate(-90)`}>{name}</text>
        )
      })}
      <Label at={[(NUM_L + NUM_R) / 2, FLOAT_BASE + 46]} anchor="middle">
        {fmt(t.deepDive.labels.someSamples, { n: String(these.length), ms: msText(EXCERPT_COUNT / c.setup.rate) })}
      </Label>
    </g>
  )
}

/** The dBFS meter's zones over the noise: green to −18, yellow to −2, red to 0 (the canvas's) */
const ZONES: readonly [MeterZoneKind, number][] = [['good', -18], ['hot', -2], ['clipping', 0]]
/**
 * At step 4 nothing on the meter is red: a float number above 0 dBFS is not clipped, only louder
 * than a D/A converter can play, and it comes back whole the moment it is turned down. So green to
 * unity and yellow from there to the two converters' own top, with 0 dBFS marked as a line across it
 */
const FLOAT_ZONES: readonly [MeterZoneKind, number][] = [['good', -18], ['hot', FLOAT_METER_TOP]]

/** What step 4 replaces: on the picture up to step 3, gone once 32-bit float takes its place */
function UntilFloat({ step, children }: { step: number; children: ReactNode }) {
  return <Step n={SAMPLE_STEP} until={DAC_STEP} step={step}>{children}</Step>
}

export function ConversionScene({ step }: SceneProps) {
  const settings = useConversion()
  const setSettings = settings.set
  const { t, fmt } = useTranslation()
  const l = t.deepDive.labels

  const float = step >= FLOAT_STEP
  const c = conversionOf(setupAt(settings, step))
  /** Step 4 · what a 24-bit recorder would have written with the same knob, set before its converter */
  const compared = float ? conversionOf(comparedAt(settings, c.setup)) : null
  const { rate, jitter } = c.setup
  const bits = float ? COMPARE_BITS : c.setup.bits ?? settings.bits
  /** How long each graph is, how many samples it holds */
  const span = windowOf(c.setup.tone), perWindow = span * rate
  const { first, samples, shown } = picture(c, span)
  const top = float ? ANALOG_TOP : c.setup.bits === null ? FS_VOLTS : codeRange(bits).top
  /**
   * A sample stopped where the wave was cut: at full scale (or a few bits' top number) — and in
   * float at the analogue side's own top, since the two converters' full scale is far above it
   */
  const stopped = (s: Sample) => c.clipped && Math.abs(s.held) >= 0.98 * (s.held > 0 ? top : float ? ANALOG_TOP : FS_VOLTS)
  /**
   * Step 4 · how far the numbers must come down before a D/A converter can play them whole, and the
   * same numbers turned down by it. Nobody plays a float file into a converter untouched: the whole
   * point is that the take survived and comes back whole once it is brought down, so that is what
   * row 2 converts (the user, 2026-11-28, seeing the clipped one: "This seem to indicate that we are
   * clipping after all"). What it would have done sent as it is stays on the graph behind it
   */
  const turnDown = float ? turnDownOf(c.digital.peak) : 0
  const playing = float && turnDown > 0 ? conversionOf({ ...c.setup, numberGain: settings.gain - turnDown }) : c
  const back = playing === c ? { first, samples, shown } : picture(playing, span)
  /**
   * What the line out should have been: the sound that came in — and in float the numbers' own
   * level once they are down to where a D/A converter can take them, so the gap the graph shades is
   * what the conversion itself cost, not what the turn-down did
   */
  const numberTimes = float ? 10 ** ((settings.gain - turnDown) / 20) : 1
  const should = (time: number) => c.arriving(time, PHASE) * numberTimes
  const out = step >= DAC_STEP ? lineOutOf(playing, back.samples, back.first, span, should) : null
  /** The same numbers sent to the D/A as they are: the flat tops that are the converter's, not float's */
  const ghost = float && turnDown > 0 ? lineOutOf(c, samples, first, span, should) : null

  /**
   * Every graph's signals zoomed alike (the lines where they are): by the line in's peak, or — in
   * float, where the gain is on the numbers — by the number's own, so a wave past 0 dBFS is seen whole
   */
  const zoom = float ? floatZoomOf(c.digital.peak + ALIGNMENT_DB) : zoomOf(c.analog.peak)
  /**
   * Row 2 converts back what the D/A converter is actually given — in float the turned-down numbers,
   * not the ones row 1 holds — so it is zoomed by those, and the line out is drawn at a size that
   * meets the 0 dBFS line instead of shrinking with the gain
   */
  const backZoom = float ? floatZoomOf(playing.digital.peak + ALIGNMENT_DB) : zoom
  const px = PX_V, R2 = rowAt(ROW_2, px, H, backZoom)
  const R1 = step === QUANT_STEP ? rowAt(TALL_CY, TALL_H / ANALOG_TOP, TALL_H, zoom) : rowAt(ROW_1, px, H, zoom)
  /**
   * The line in has its own zoom at step 4, where the graph carries two traces: the sound arriving
   * (the knob no longer touches it — a float recorder's converters are before it) and that sound with
   * the gain you set, which is what a 24-bit converter is fed. It follows the louder of the two, so
   * neither runs off the graph whichever way the knob is turned
   */
  const inPeak = Math.max(c.analog.peak, compared?.analog.peak ?? -Infinity)
  const R1in = float ? rowAt(R1.cy, R1.px, R1.h, zoomOf(inPeak)) : R1
  /** Whether the gain has pushed the signal onto the analogue side's rails */
  const railed = float && compared !== null && compared.analog.peak >= ANALOG_TOP_DBU - 0.01
  const inX = timeX(IN_X, span), adcX = timeX(ADC_X, span), outX = timeX(OUT_X, span, OUT_W)

  // The meter's mark: the noise the bits leave, with how far under the signal it is (no budget or
  // quality converter's — the user's call, 2026-11-26); its words right of it, a leader to them
  const floor = floorOf(bits, 'quality')
  const marks = [{ db: floor.bits, name: fmt(l.bitsFloor, { bits: bitsText(t, bits), db: minus(floor.bits) }) }]
  const placed = stacked(marks)
  /** The line out: what the numbers hold, back in dBu (0 dBFS a peak of +18 dBu) */
  const lineOutLevel = { rms: c.digital.rms + ALIGNMENT_DB, peak: c.digital.peak + ALIGNMENT_DB }
  /** What the line in's meter reads: the level the knob set — at step 4 the gained trace's */
  const inLevel = float && compared ? compared.analog : c.analog
  /**
   * Step 4 · what the D/A converter actually played, measured on its output (`playedOf` stopped
   * every over at full scale), not on the numbers it was handed
   */
  const dbu = (volts: number) => 20 * Math.log10(Math.max(volts, 1e-12) / 0.775)
  const playedLevel = float && out
    ? { rms: dbu(Math.sqrt(out.out.reduce((a, v) => a + v * v, 0) / out.out.length)), peak: dbu(out.peak) }
    : null

  const dots = dotsOf(shown, adcX, R1.sy, R1.cy, stopped, GRAPH_W / perWindow, [ADC_X, ADC_X + GRAPH_W], [R1.top, R1.bottom])
  const lit = [Math.max(ADC_X, adcX(-0.5 / rate)), Math.min(ADC_X + GRAPH_W, adcX((EXCERPT_COUNT - 0.5) / rate))]
  const outPaths = out && lineOutPaths(out, span, R2)
  const ghostPaths = ghost && lineOutPaths(ghost, span, R2)
  /** The A/D converter's samples' words, under its bottom full-scale line */
  const samplesY = R1.vy(-FS_VOLTS) + BIG_GAP + BIG.fontSize * 0.72

  return (
    <g>
      {/* 1 · Sampling: the line in and its meter; the filter, the A/D converter's graph — the wave it is fed, the samples; the clock */}
      <Step n={SAMPLE_STEP} step={step}>
        <Label at={[IN_X + 8, R1.top - 30]}>{l.lineLevel}</Label>
        <Axes x={IN_X} row={R1} />
        <AnalogLines x={IN_X} row={R1} />
        <path d={wavePath(inX, (time) => c.arriving(time, PHASE), 0, span, R1in.sy)} fill="none" stroke={TRACE} strokeWidth={3} strokeLinejoin="round" />
        <TimeEnd x={IN_X} row={R1} span={span} />
        {/* Its meter reads the level the knob set (at step 4 that is the gained trace, not the sound) */}
        <LevelMeter x={IN_METER_X} y={R1.top} w={METER_W} h={2 * R1.h} rms={inLevel.rms} peak={inLevel.peak} />
        <Peak x={IN_METER_X} y={R1.readY} peak={formatDb(inLevel.peak)} />

        <line x1={IN_X + GRAPH_W + 20} y1={R1.cy} x2={ADC_L} y2={R1.cy} stroke={INK} strokeWidth={2} />
        <Filter left={FILTER_L} right={FILTER_R} row={R1} />
        <rect x={ADC_L} y={R1.boxTop} width={ADC_R - ADC_L} height={R1.boxBottom - R1.boxTop} {...BOX} />
        <UntilFloat step={step}><Big at={[(ADC_L + ADC_R) / 2, R1.boxTop - BIG_GAP]} anchor="middle">{l.adc}</Big></UntilFloat>
        <FullScale from={IN_X + GRAPH_W} to={ADC_X} row={R1} />
        <DigitalTop x={ADC_X} row={R1} />
        <Axes x={ADC_X} row={R1} />
        {/* At step 4 this graph is about the numbers, which are on their own zoom: the wave reaching
            the converters is the line in's solid trace instead */}
        <UntilFloat step={step}>
          <path d={wavePath(adcX, (time) => c.received(time, PHASE), 0, span, R1.sy)} fill="none" stroke={TRACE} strokeWidth={2} opacity={0.35} />
        </UntilFloat>
        <Dots dots={dots} />
        {/* Its window's length is in the samples' words: no time at its end */}
        <Big at={[ADC_X + GRAPH_W, samplesY]}>{fmt(l.samplesIn, { n: numberText(shown.length), ms: msText(span) })}</Big>
        {/* The wobble's note where the box's name was, under it, clear of the clock's wire */}
        {jitter > 0 && <Label at={[(ADC_L + ADC_R) / 2, R1.nameY]} anchor="middle">{l.wobbleBigger}</Label>}

        {/* The clock between the rows (under the A/D converter's box, wherever it ends), ticking at the sample rate, wired
            into the box's bottom; Steady or Wobbly left of it */}
        <g transform={`translate(0 ${R1.boxBottom - CLOCK_UNDER})`}>
          <ClockChoice wobbly={settings.wobbly} onPick={(wobbly) => setSettings({ wobbly })} />
          <rect x={CLOCK_L} y={CLOCK_TOP} width={CLOCK_R - CLOCK_L} height={CLOCK_BOTTOM - CLOCK_TOP} {...BOX} rx={8} />
          <path d={clockPath(jitter / JITTER_MAX)} fill="none" stroke={MOVER} strokeWidth={2} />
          <Label at={[(CLOCK_L + CLOCK_R) / 2, CLOCK_TOP - 13]} anchor="middle">{fmt(l.timesASecond, { n: numberText(rate) })}</Label>
          <path d={`M${CLOCK_R} ${CLOCK_WIRE_Y} H${CLOCK_INTO_ADC} V${CLOCK_UNDER}`} {...CLOCK_WIRE} />
        </g>
      </Step>

      {/* 2 · Quantization: the steps and their numbers, the samples rounded; the meter; the numbers magnified, their bits */}
      <Step n={QUANT_STEP} step={step}>
        <UntilFloat step={step}>
          <path d={stepLines(ADC_X, ADC_X + GRAPH_W, bits, R1)} fill="none" stroke={FAINT} strokeWidth={1} />
          <Big at={[ADC_X + GRAPH_W, samplesY + BIG_LINE]}>{fmt(l.bitsSteps, { bits: String(bits), n: numberText(2 ** bits) })}</Big>
        </UntilFloat>
        {/* The stretch the numbers' box magnifies */}
        <rect x={lit[0]} y={R1.top} width={Math.max(0, lit[1] - lit[0])} height={2 * R1.h} fill={MOVER} opacity={0.1} />

        <UntilFloat step={step}>
        {/* Its meter, right of the numbers: the signal (its average solid, its peaks pale, a line at the peak), the noise under it grey */}
        <rect x={METER_X} y={METER_TOP} width={METER_W} height={METER_BOTTOM - METER_TOP} rx={2} fill={FAINT} opacity={0.5} />
        <rect x={METER_X} y={meterY(floor.total)} width={METER_W} height={METER_BOTTOM - meterY(floor.total)} fill={zoneColor('noise')} />
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
        <Label at={[MARKS_X, METER_TOP + 6]}>0 dBFS</Label>
        {placed.map((m) => (
          <g key={m.name}>
            <line x1={METER_X - 4} y1={meterY(m.db)} x2={METER_X + METER_W + 4} y2={meterY(m.db)} stroke={INK} strokeWidth={1.5} />
            <path d={`M${METER_X + METER_W + 4} ${meterY(m.db)} L${MARKS_X - 6} ${m.y - 6}`} fill="none" stroke={PART} strokeWidth={0.75} strokeDasharray="3 3" />
            <Label at={[MARKS_X, m.y]}>{m.name}</Label>
            {c.digital.rms - m.db >= 1 && <Label at={[MARKS_X, m.y + 26]}>{fmt(l.underSignal, { db: String(Math.round(c.digital.rms - m.db)) })}</Label>}
          </g>
        ))}
        <Peak x={METER_X} y={METER_BOTTOM + 42} peak={formatDb(c.digital.peak, 'digital')} />
        </UntilFloat>

        {/* The numbers, as tall as both rows */}
        <line x1={ADC_R} y1={R1.cy} x2={NUM_L} y2={R1.cy} {...DIGITAL} />
        <UntilFloat step={step}>
          <rect x={NUM_L} y={R1.boxTop} width={NUM_R - NUM_L} height={R2.boxBottom - R1.boxTop} {...BOX} />
          <Label at={[(NUM_L + NUM_R) / 2, R2.nameY]} anchor="middle">{fmt(l.numbers, { bits: bitsText(t, bits) })}</Label>
          <Excerpt c={c} bits={bits} stopped={stopped} />
        </UntilFloat>
      </Step>

      {/* 3 · Analogue conversion: the digital line from the A/D converter down to the D/A converter, its steps, the filter after it; the line out, never quite what came in */}
      <Step n={DAC_STEP} step={step}>
        <path d={`M${TAP_X} ${R1.cy} V${DIGITAL_Y} H${DIGITAL_INTO_DAC} V${R2.boxTop}`} {...DIGITAL} />
        <circle cx={TAP_X} cy={R1.cy} r={6} fill={MOVER} />
        <path d={`M${(CLOCK_L + CLOCK_R) / 2} ${CLOCK_BOTTOM} V${R2.boxTop}`} {...CLOCK_WIRE} />
        <rect x={DAC_L} y={R2.boxTop} width={DAC_R - DAC_L} height={R2.boxBottom - R2.boxTop} {...BOX} />
        <Big at={[(DAC_L + DAC_R) / 2, R2.nameY]} anchor="middle">{l.dac}</Big>
        <DigitalTop x={DAC_X} row={R2} />
        <Axes x={DAC_X} row={R2} />
        <UntilFloat step={step}><path d={stepLines(DAC_X, DAC_X + GRAPH_W, bits, R2)} fill="none" stroke={FAINT} strokeWidth={1} /></UntilFloat>
        <path d={stairsOf(back.shown, rate, span, R2, float ? (sm) => playedOf(sm.value) : undefined)} fill="none" stroke={MOVER} strokeWidth={2.5} strokeLinejoin="round" />
        <TimeEnd x={DAC_X} row={R2} span={span} />

        <line x1={DAC_R} y1={R2.cy} x2={OUT_FILTER_L} y2={R2.cy} stroke={INK} strokeWidth={2} />
        <Filter left={OUT_FILTER_L} right={OUT_FILTER_R} row={R2} />
        <line x1={OUT_FILTER_R} y1={R2.cy} x2={OUT_X} y2={R2.cy} stroke={INK} strokeWidth={2} />
        <Label at={[OUT_X + 8, R2.top - 30]}>{l.lineOutReading}</Label>
        <Axes x={OUT_X} row={R2} w={OUT_W} />
        <AnalogLines x={OUT_X} row={R2} w={OUT_W} />
        {outPaths && <path d={outPaths.gap} fill={WRONG} opacity={0.5} stroke="none" />}
        {/* Behind it: what those same numbers would have done sent to the D/A as they are */}
        {ghostPaths && <path d={ghostPaths.path} fill="none" stroke={CLIPPED} strokeWidth={2} strokeDasharray="7 5" opacity={0.75} />}
        <path d={wavePath(outX, should, 0, span, R2.sy)} fill="none" stroke={INK} strokeWidth={1.25} strokeDasharray="4 4" opacity={0.6} />
        {outPaths && <path d={outPaths.path} fill="none" stroke={TRACE} strokeWidth={3} strokeLinejoin="round" />}
        <TimeEnd x={OUT_X} row={R2} span={span} w={OUT_W} />
        {out && (
          <>
            <text className="lsc-dd-reading" x={OUT_X} y={R2.readY}>{fmt(l.difference, { db: minus(out.db) })}</text>
            <Label at={[OUT_X, R2.readY + 30]}>{l.heard[heardOf(out.db)]}</Label>
            {ghostPaths && (
              <text className="lsc-dd-label" x={OUT_X} y={R2.readY + 58} fill={CLIPPED}>{l.playedAsItIs}</text>
            )}
          </>
        )}
        <UntilFloat step={step}>
          <LevelMeter x={OUT_METER_X} y={R2.top} w={METER_W} h={2 * H} rms={lineOutLevel.rms} peak={lineOutLevel.peak} />
          <Peak x={OUT_METER_X} y={R2.readY} peak={formatDb(lineOutLevel.peak)} />
        </UntilFloat>
      </Step>

      {/* 4 · 32-bit float: two converters instead of one, numbers with no ceiling, and the one thing
          that still cannot play them — the D/A converter */}
      <Step n={FLOAT_STEP} step={step}>
        <Big at={[(ADC_L + ADC_R) / 2, R1.boxTop - BIG_GAP]} anchor="middle">{l.floatAdc}</Big>
        {/* The line in's second trace: the sound with the gain you set — what a 24-bit recorder's
            converter is fed. It is the one that moves with the knob, and it goes flat on the rails
            (the user's call, 2026-11-28: "People adjust gain and hope that 32 bit float will save
            their recording"). The solid trace beside it is the sound the float converters take,
            which the knob never reaches. */}
        {compared && (
          <>
            <path d={wavePath(inX, (time) => compared.arriving(time, PHASE), 0, span, R1in.sy)}
              fill="none" stroke={railed ? CLIPPED : INK} strokeWidth={2.5} strokeDasharray="9 6" strokeLinejoin="round" opacity={0.9} />
            {/* The two traces' names above the graph, at its right end: under it the clock's words are */}
            <Label at={[IN_X + GRAPH_W, R1.top - 74]} anchor="end">{l.theSound}</Label>
            <text className="lsc-dd-label" x={IN_X + GRAPH_W} y={R1.top - 52} textAnchor="end" fill={railed ? CLIPPED : undefined}>
              {railed ? l.withTheGainRailed : l.withTheGain}
            </text>
          </>
        )}
        {/* No analogue rails on this graph: it is zoomed by the number's own peak (the knob is on the
            numbers now), so a line at a fixed voltage would read as a ceiling the number never meets.
            The only line that matters here is 0 dBFS — where a 24-bit converter and every D/A stop. */}
        {/* What a 24-bit recorder would have written with the same knob, set before its converter */}
        {compared && (
          <>
            <path d={wavePath(adcX, (time) => Math.max(-FS_VOLTS, Math.min(codeRange(COMPARE_BITS).top, compared.received(time, PHASE))), 0, span, R1.sy)}
              fill="none" stroke={CLIPPED} strokeWidth={2.5} strokeDasharray="7 5" opacity={0.85} />
            <Label at={[ADC_X + 8, R1.vy(-FS_VOLTS) - 14]}>
              {compared.clipped ? l.wouldHaveClipped : l.wouldHaveMatched}
            </Label>
          </>
        )}
        {/* The two readings, where the samples' and the bits' were */}
        <Big at={[ADC_X + GRAPH_W, samplesY + BIG_LINE]}>{fmt(l.floatPeak, { db: formatDb(c.digital.peak, 'digital') })}</Big>
        <Big at={[ADC_X + GRAPH_W, samplesY + 2 * BIG_LINE]}>{l.floatAnyLevel}</Big>
        {/* Float cannot bring back what was already cut before it — a microphone or a preamp pushed too far */}
        <Label at={[ADC_X + 8, R1.vy(-FS_VOLTS) - 48]}>{l.beforeTheConverters}</Label>

        {/* The numbers' box, grown to hold all 32 rows */}
        <rect x={NUM_L} y={R1.boxTop} width={NUM_R - NUM_L} height={FLOAT_BOX_BOTTOM - R1.boxTop} {...BOX} />
        <Label at={[(NUM_L + NUM_R) / 2, FLOAT_BOX_BOTTOM - 22]} anchor="middle">{l.floatNumbers}</Label>
        <FloatExcerpt c={c} />

        {/* Its meter, with the two converters' full scale at the top: the overs have somewhere to go */}
        <rect x={METER_X} y={METER_TOP} width={METER_W} height={METER_BOTTOM - METER_TOP} rx={2} fill={FAINT} opacity={0.5} />
        {FLOAT_ZONES.map(([kind, to], i) => {
          const from = i ? FLOAT_ZONES[i - 1][1] : FLOAT_METER_BOTTOM
          const solid = Math.min(to, c.digital.rms), pale = Math.min(to, c.digital.peak)
          return (
            <g key={kind} fill={zoneColor(kind)}>
              {solid > from && <rect x={METER_X} y={floatMeterY(solid)} width={METER_W} height={floatMeterY(from) - floatMeterY(solid)} />}
              {pale > Math.max(from, solid) && <rect x={METER_X} y={floatMeterY(pale)} width={METER_W} height={floatMeterY(Math.max(from, solid)) - floatMeterY(pale)} opacity={0.35} />}
            </g>
          )
        })}
        <line x1={METER_X - 3} y1={floatMeterY(c.digital.peak)} x2={METER_X + METER_W + 3} y2={floatMeterY(c.digital.peak)} stroke={INK} strokeWidth={1.5} />
        <Label at={[MARKS_X, METER_TOP + 6]}>{fmt(l.bothConverters, { db: String(FLOAT_OFFSET_DB) })}</Label>
        <line x1={METER_X - 4} y1={floatMeterY(0)} x2={METER_X + METER_W + 4} y2={floatMeterY(0)} stroke={CLIPPED} strokeWidth={1.5} strokeDasharray="5 4" />
        <Label at={[MARKS_X, floatMeterY(0) + 6]}>{l.fullScale}</Label>
        <Peak x={METER_X} y={METER_BOTTOM + 42} peak={formatDb(c.digital.peak, 'digital')} />

        {/* Row 2 · a D/A converter still stops at full scale: how far the numbers must come down first */}
        <g>
          <rect x={DAC_L} y={R2.boxBottom + 76} width={DAC_R - DAC_L} height={96} rx={10}
            fill="var(--lsc-sunken)" stroke={turnDown > 0 ? 'var(--lsc-accent)' : PART} strokeWidth={2} strokeDasharray="7 5" />
          <text className="lsc-dd-reading" style={BIG} x={(DAC_L + DAC_R) / 2} y={R2.boxBottom + 138} textAnchor="middle">
            {turnDown > 0 ? fmt(l.turnDownBy, { db: String(Math.round(10 * turnDown) / 10) }) : l.nothingToTurnDown}
          </text>
        </g>
        {playedLevel && (
          <>
            <LevelMeter x={OUT_METER_X} y={R2.top} w={METER_W} h={2 * H} rms={playedLevel.rms} peak={playedLevel.peak} />
            <Peak x={OUT_METER_X} y={R2.readY} peak={formatDb(playedLevel.peak)} />
          </>
        )}
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
 * `choices` — the sample rate's buttons over the bit depth's (their units say what they are), at
 * every step too (the bit depths from step 1 — the user's call, 2026-11-26: there they wait for step 2)
 */
export function ConversionControls({ step, part }: { step: number; part: 'knobs' | 'choices' }) {
  const s = useConversion()
  const { t, fmt } = useTranslation()
  const l = t.deepDive.labels
  if (part === 'choices') {
    // At step 4 there is no bit depth to pick: the row shows the one format in use instead, in the
    // app's own words for it (`bitsText(32)` — the same "32-bit float" a digital wire says, D36)
    const float = step >= FLOAT_STEP
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
        <Choices name={l.sampleRate} options={RATES} value={s.rate as (typeof RATES)[number]} text={(r) => rateText(t, r)} onPick={(rate) => s.set({ rate })} />
        {float
          ? <Choices name={l.bitDepth} options={[FLOAT_BITS]} value={FLOAT_BITS} text={(b) => bitsText(t, b)} onPick={() => {}} />
          : <Choices name={l.bitDepth} options={BIT_DEPTHS} value={s.bits as (typeof BIT_DEPTHS)[number]} text={(b) => bitsText(t, b)} onPick={(bits) => s.set({ bits })} />}
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
