import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { ALIGNMENT_DB, formatDb, getHealth, zoneColor } from '../../signal/levels'
import type { MeterZoneKind, SignalDomain, SignalHealth } from '../../signal/levels'
import { bitsText, rateText } from '../../utils/formatText'
import {
  ANALOG_TOP, BIT_DEPTHS, BITS_START, FS_VOLTS, JITTER_MAX, LEVEL_MAX, LEVEL_MIN, LEVEL_START, OWN_NOISE, RATES,
  RATE_START, RECONSTRUCT_TAPS, TONES, TONE_START,
  bitsOf, codeOf, codeRange, conversionOf, floorOf, samplesOf, windowOf,
} from '../converter'
import type { Conversion, Sample, Setup } from '../converter'
import { ARROW_INK, FAINT, INK, MOVER, PART, TRACE } from './look'
import type { SceneProps } from './painter'
import { Label, Step } from './sceneParts'
import { LevelMeter } from './circuitParts'
import { useConversion } from './conversionSettings'
import { SceneKnob } from './SceneKnob'
import { StableText } from '../../components/controls/StableText'
import { STACKED_SLIDER_QUERY, useMediaQuery } from '../../hooks/useMediaQuery'
import type { ConversionSettings } from './conversionSettings'

// A/D and D/A conversion (Deep dive, D46): a line-level sine into an A/D converter, its numbers, and
// out of a D/A converter — in two rows (the user's call, 2026-11-24), each read left to right: the
// line in, the A/D converter and its numbers on top; a thin digital line down to the D/A converter,
// its filter and the line out below. Height is voltage, as in Analogue amplification: full scale
// (0 dBFS) is a peak of +18 dBu, as the canvas aligns them. Every graph covers the same stretch of
// time (`windowOf`: 0.1 s at 20 Hz, two cycles, down to 1 ms at 20 kHz, twenty — as a sound editor
// zooms), long enough to see the rounding change from one cycle to the next. The picture stands
// still (a sine is the same moving or not): the controls under it set it (`useConversion`), each
// from its step — the gain knob, the frequency's slider, the clock's buttons, the sample rate's and
// bit depth's.
// (1) Line level: the line's graph, its meter (dBu) — an average of 0 dBu, its peaks far under
//     the +18 dBu line, the analogue side's own top (+20 dBu, where the canvas clips) above it.
// (2) The clock, the samples and the bits: the filter before the converter (always in), the A/D
//     converter — the wave it is fed (faint), at each tick a sample rounded to the nearest of its bit
//     depth's steps, each step named by the number it is written as (while there is room); a wobbly
//     clock takes them early or late (drawn thousands of times bigger), played back on time. Its
//     meter (dBFS) shows the signal, the noise its bits leave, and a budget and a quality converter's
//     own noise, each with how far under the signal it is. The numbers: the samples' words in order,
//     the first WORD_ROWS. The clock sits between the rows, wired into both converters.
// (3) Back to voltage: the D/A converter holds each number until the next (the steps); the filter
//     after it smooths them into the line out — drawn at its real size over what came in (dashed),
//     the gap between them shaded; the difference on its own graph beside the line out's meter,
//     drawn as many times bigger as it takes to be seen (said on it), how far under the signal it is
//     and whether it is heard. The tone's frequency from here: past half the sample rate (Nyquist)
//     the filter takes the tone out; the gain turned up shows 0 dBFS with nothing above it.
// The numbers are converter.ts's; the converters are quality ones (their noise in the output).

// ── Where things are, in the scene's units ──────────────────────────────────
/** Height is voltage: full scale 150 px above and below a row's middle line (0 V) */
const PX_V = 150 / FS_VOLTS
/** A row's heights, around its middle line `cy` */
function rowAt(cy: number) {
  const vy = (volts: number) => cy - PX_V * volts
  return {
    cy, vy,
    fsTop: vy(FS_VOLTS), fsBottom: vy(-FS_VOLTS), anTop: vy(ANALOG_TOP), anBottom: vy(-ANALOG_TOP),
    /** Its boxes, their names under them; the readings under its meters */
    boxTop: cy - 220, boxBottom: cy + 262, nameY: cy + 294, readY: vy(-ANALOG_TOP) + 42,
  }
}
type Row = ReturnType<typeof rowAt>
/** Row 1: the line in, the A/D converter, its numbers. Row 2: the D/A converter, its filter, the line out */
const R1 = rowAt(260), R2 = rowAt(900)
/** Each graph's width: the window's time */
const GRAPH_W = 720, METER_W = 16
/** Row 1 · the line in's graph and its meter left of it; the filter; the A/D converter — its graph, the steps' numbers, its meter and the marks' words */
const IN_METER_X = -20, IN_X = 60
const FILTER_L = 830, FILTER_R = 885
const ADC_L = 905, ADC_X = 945, ADC_R = 2130, CODES_X = ADC_X + GRAPH_W + 30, METER_X = 1775, MARKS_X = 1835
/** The numbers' box: its columns (the sample's count, its word), its rows */
const WORD_L = 2210, WORD_R = 2670, COUNT_X = WORD_L + 100, WORD_X = WORD_L + 125, WORD_ROWS = 12, WORD_GAP = 28
/** Between the rows · the clock, its wires into the A/D converter's bottom and the D/A converter's top; the digital line round to the D/A converter */
const CLOCK_L = 300, CLOCK_R = 440, CLOCK_TOP = 565, CLOCK_BOTTOM = 615, CLOCK_WIRE_Y = 590, CLOCK_INTO_ADC = 1000
const LOOP_X = 2710, DIGITAL_Y = 640, DIGITAL_INTO_DAC = 700
/** Row 2 · the D/A converter, its graph; the filter after it; the line out under the samples, its meter; the difference */
const DAC_L = 20, DAC_X = 60, DAC_R = 840
const OUT_FILTER_L = 870, OUT_FILTER_R = 925
const OUT_X = 945, OUT_METER_X = OUT_X + GRAPH_W + (IN_X - IN_METER_X - METER_W), DIFF_X = 1880

export const LINE_STEP = 1, SAMPLE_STEP = 2, DAC_STEP = 3
/** The tone's phase at the graphs' left edge */
const PHASE = 0
/** Points a wave is drawn with: two a unit across */
const POINTS = 2 * GRAPH_W
/** The steps' lines are drawn while at least this far apart, their numbers while this; each sample's faint line while the samples are */
const STEP_LINES_PX = 4, CODE_PX = 16, SAMPLE_LINES_PX = 8
/** How high the difference is drawn at most (px), magnified — only one under SEEN_PX at its real size is */
const DIFF_ROOM = 120, SEEN_PX = 10

/** What the converter is set to at a step: what a later step adds stays at its start */
function setupAt(step: number, s: ConversionSettings): Setup {
  const sampled = step >= SAMPLE_STEP
  return {
    rate: sampled ? s.rate : RATE_START,
    bits: sampled ? s.bits : BITS_START,
    jitter: sampled && s.wobbly ? JITTER_MAX : 0,
    grade: 'quality',
    filter: true,
    tone: step >= DAC_STEP ? s.tone : TONE_START,
    level: LEVEL_START + s.gain,
  }
}

/** A graph's x of a moment, its window `span` long (s) */
const timeX = (left: number, span: number) => (t: number) => left + (GRAPH_W * t) / span
/** The A/D converter's meter: 0 dBFS at full scale's line, −150 at its bottom one */
const meterY = (db: number) => R1.fsTop + ((R1.fsBottom - R1.fsTop) * Math.min(150, Math.max(0, -db))) / 150

/** A wave over a graph's window (`span` s) */
function wavePath(x: (t: number) => number, volts: (t: number) => number, span: number, row: Row): string {
  let d = ''
  for (let i = 0; i <= POINTS; i++) {
    const t = (span * i) / POINTS
    d += `${i ? ' L' : 'M'}${x(t).toFixed(1)} ${row.vy(volts(t)).toFixed(1)}`
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

/** A level's health as the canvas judges it, and the colour its word is written in */
function healthOf(rms: number, peak: number, domain: SignalDomain) {
  const health = getHealth(rms, domain, peak)
  return { health, colour: `var(--signal-${health}-text)` }
}

/** Whether a difference this far under the signal (dB) is heard */
const heardOf = (db: number) => (db > -20 ? 'loud' : db > -60 ? 'clear' : db > -90 ? 'faint' : 'silent')

/** The samples a graph shows (0 … its last) and those either side the reconstruction reaches */
function picture(c: Conversion, span: number) {
  const last = Math.floor(span * c.setup.rate + 1e-9), first = -RECONSTRUCT_TAPS
  const samples = samplesOf(c, PHASE, first, last + RECONSTRUCT_TAPS)
  return { first, samples, shown: samples.slice(-first, -first + last + 1) }
}

/**
 * The line out against what came in: its real wave, the gap between the two (an area), the
 * difference drawn as many times bigger (a power of ten) as it takes to be seen on its own graph,
 * and how far under the signal it is (dB)
 */
function lineOut(c: Conversion, samples: readonly Sample[], first: number, span: number) {
  const out: number[] = [], want: number[] = [], outX = timeX(OUT_X, span), diffX = timeX(DIFF_X, span)
  let worst = 0, sq = 0, sig = 0
  for (let i = 0; i <= POINTS; i++) {
    const t = (span * i) / POINTS, o = c.output(t, samples, first), w = c.arriving(t, PHASE)
    out.push(o); want.push(w)
    worst = Math.max(worst, Math.abs(o - w))
    sq += (o - w) ** 2; sig += w * w
  }
  const room = worst > 0 ? DIFF_ROOM / (PX_V * worst) : 1
  const bigger = PX_V * worst < SEEN_PX && room > 1 ? Math.min(1e6, 10 ** Math.floor(Math.log10(room))) : 1
  const at = (i: number) => (span * i) / POINTS
  const point = (x: number, v: number) => `${x.toFixed(1)} ${R2.vy(v).toFixed(1)}`
  const path = out.map((o, i) => `${i ? 'L' : 'M'}${point(outX(at(i)), o)}`).join(' ')
  let gap = path
  for (let i = POINTS; i >= 0; i--) gap += ` L${point(outX(at(i)), want[i])}`
  const limit = ANALOG_TOP
  const diff = out.map((o, i) => `${i ? 'L' : 'M'}${point(diffX(at(i)), Math.max(-limit, Math.min(limit, bigger * (o - want[i]))))}`).join(' ')
  return { path, gap: `${gap} Z`, diff, bigger, db: sig > 0 ? 10 * Math.log10(Math.max(sq, 1e-30) / sig) : 0 }
}

/** The meter's marks' words stacked down its right (each below the one before), a leader to each */
function stacked<T extends { db: number }>(marks: readonly T[]): (T & { y: number })[] {
  const out: (T & { y: number })[] = []
  for (const m of marks) {
    const y = Math.max(meterY(m.db) + 6, out.length ? out[out.length - 1].y + 52 : R1.fsTop + 40)
    out.push({ ...m, y })
  }
  return out
}

/** The D/A converter's steps: each number held until the next */
function stairsOf(shown: readonly Sample[], rate: number, span: number): string {
  const dacX = timeX(DAC_X, span)
  return shown.map((s, i) => {
    const y = R2.vy(s.value).toFixed(1), to = Math.min(dacX((i + 1) / rate), DAC_X + GRAPH_W).toFixed(1)
    return i ? `V${y} H${to}` : `M${DAC_X} ${y} H${to}`
  }).join(' ')
}

/**
 * The A/D converter's samples as paths (a window can hold thousands): a faint line at each one's moment
 * while they are SAMPLE_LINES_PX apart, its stem from 0 V and its dot — the dots and stems thinning
 * with the room between them (`gap`); those stopped at full scale apart, for their colour
 */
function dotsOf(shown: readonly Sample[], x: (t: number) => number, stopped: (s: Sample) => boolean, gap: number) {
  const part = () => ({ stems: '', dots: '' })
  const kept = part(), held = part()
  let lines = ''
  for (const s of shown) {
    const at = x(s.at), y = R1.vy(s.value)
    if (at < ADC_X - 0.5 || at > ADC_X + GRAPH_W + 0.5) continue
    const to = stopped(s) ? held : kept, ax = at.toFixed(1), ay = y.toFixed(1)
    if (gap >= SAMPLE_LINES_PX) lines += `M${ax} ${R1.fsTop.toFixed(1)}V${R1.fsBottom.toFixed(1)}`
    to.stems += `M${ax} ${R1.cy}V${ay}`
    to.dots += `M${ax} ${ay}h0`
  }
  return { lines, kept, stopped: held, r: Math.min(5, Math.max(1, gap * 0.35)), stem: Math.min(1.5, Math.max(0.4, gap * 0.4)) }
}

const FULL_SCALE = { stroke: 'var(--signal-clipping)', strokeWidth: 1.5, strokeDasharray: '8 6' } as const
const BOX = { rx: 10, fill: 'var(--lsc-sunken)', stroke: PART, strokeWidth: 2 } as const
const DIGITAL = { stroke: MOVER, strokeWidth: 3, strokeDasharray: '12 5 4 5', fill: 'none' } as const
const CLOCK_WIRE = { fill: 'none', stroke: MOVER, strokeWidth: 1.5, strokeDasharray: '2 4' } as const
const CLIPPED = 'var(--signal-clipping)'
/** What the line out got wrong: the gap and the difference */
const WRONG = 'var(--signal-hot)'

/** A graph's axes: up at its left edge, time along its middle */
function Axes({ x, row }: { x: number; row: Row }) {
  return (
    <>
      <line x1={x} y1={row.anTop - 10} x2={x} y2={row.anBottom + 10} stroke={INK} strokeWidth={1.5} />
      <line x1={x} y1={row.cy} x2={x + GRAPH_W + 20} y2={row.cy} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
    </>
  )
}

/** How long a graph's window is, under its right end */
function TimeEnd({ x, row, span }: { x: number; row: Row; span: number }) {
  const { t, fmt } = useTranslation()
  return <Label at={[x + GRAPH_W, row.anBottom + 34]} anchor="end">{fmt(t.deepDive.labels.ms, { n: msText(span) })}</Label>
}

/** Full scale's two dashed lines across a stretch */
function FullScale({ from, to, row }: { from: number; to: number; row: Row }) {
  return (
    <>
      <line x1={from} y1={row.fsTop} x2={to} y2={row.fsTop} {...FULL_SCALE} />
      <line x1={from} y1={row.fsBottom} x2={to} y2={row.fsBottom} {...FULL_SCALE} />
    </>
  )
}

/** An analogue graph's lines: the analogue side's top (+20 dBu) and full scale's (+18 dBu), named at their right */
function AnalogLines({ x, row }: { x: number; row: Row }) {
  return (
    <>
      <line x1={x} y1={row.anTop} x2={x + GRAPH_W} y2={row.anTop} stroke={CLIPPED} strokeWidth={1.5} />
      <line x1={x} y1={row.anBottom} x2={x + GRAPH_W} y2={row.anBottom} stroke={CLIPPED} strokeWidth={1.5} />
      <FullScale from={x} to={x + GRAPH_W} row={row} />
      <Label at={[x + GRAPH_W, row.anTop - 8]} anchor="end">+20 dBu</Label>
      <Label at={[x + GRAPH_W, row.fsTop - 8]} anchor="end">+18 dBu</Label>
      <Label at={[x - 8, row.cy + 6]} anchor="end">0 V</Label>
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

/** The bit depth's steps across a graph, while far enough apart to be seen */
function StepLines({ x, bits, row }: { x: number; bits: number; row: Row }) {
  const { step } = codeRange(bits), half = 2 ** (bits - 1)
  if (step * PX_V < STEP_LINES_PX) return null
  let d = ''
  for (let k = -half; k < half; k++) d += `M${x} ${row.vy(k * step).toFixed(1)} H${x + GRAPH_W} `
  return <path d={d} fill="none" stroke={FAINT} strokeWidth={1} />
}

/** Each step named by the number it is written as, right of the A/D converter's graph (while there is room) */
function StepCodes({ bits }: { bits: number }) {
  const { step } = codeRange(bits), half = 2 ** (bits - 1)
  if (step * PX_V < CODE_PX) return null
  return (
    <g>
      {Array.from({ length: 2 * half }, (_, i) => i - half).map((k) => (
        <text key={k} className="lsc-dd-code" x={CODES_X} y={R1.vy(k * step) + 5}>{wordOf(k, bits)}</text>
      ))}
    </g>
  )
}

/** A meter's peak and its health word, under it */
function Readings({ x, y, peak, health }: { x: number; y: number; peak: string; health: { health: SignalHealth; colour: string } }) {
  const { t, fmt } = useTranslation()
  return (
    <>
      <text className="lsc-dd-reading" x={x} y={y}>{fmt(t.deepDive.labels.peak, { db: peak })}</text>
      <text className="lsc-dd-reading" x={x} y={y + 30} style={{ fill: health.colour }}>{t.health[health.health]}</text>
    </>
  )
}

/** The dBFS meter's zones over the noise: green to −18, yellow to −2, red to 0 (the canvas's) */
const ZONES: readonly [MeterZoneKind, number][] = [['good', -18], ['hot', -2], ['clipping', 0]]

export function ConversionScene({ step }: SceneProps) {
  const settings = useConversion()
  const { t, fmt } = useTranslation()
  const l = t.deepDive.labels

  const c = conversionOf(setupAt(step, settings))
  const { rate, jitter } = c.setup
  const bits = c.setup.bits ?? BITS_START
  /** How long each graph is, how many samples it holds */
  const span = windowOf(c.setup.tone), perWindow = span * rate
  const inX = timeX(IN_X, span), adcX = timeX(ADC_X, span), outX = timeX(OUT_X, span)
  const { first, samples, shown } = picture(c, span)
  const { step: bitStep, top } = codeRange(bits)
  /** A sample stopped at full scale (or a few bits' top number) */
  const stopped = (s: Sample) => c.clipped && Math.abs(s.held) >= 0.98 * (s.held > 0 ? top : FS_VOLTS)
  const out = step >= DAC_STEP ? lineOut(c, samples, first, span) : null

  // The meter's marks: the bits' noise, a budget converter's own and a quality one's — each with how
  // far under the signal it is; their words stacked down the right, a leader to each
  const floor = floorOf(bits, 'quality')
  const marks = [
    { db: floor.bits, name: fmt(l.bitsFloor, { bits: bitsText(t, bits), db: minus(floor.bits) }) },
    { db: OWN_NOISE.budget, name: fmt(l.budgetNoise, { db: minus(OWN_NOISE.budget) }) },
    { db: OWN_NOISE.quality, name: fmt(l.qualityNoise, { db: minus(OWN_NOISE.quality) }) },
  ].sort((a, b) => b.db - a.db)
  const placed = stacked(marks)
  const analog = healthOf(c.analog.rms, c.analog.peak, 'analog')
  const digital = healthOf(c.digital.rms, c.digital.peak, 'digital')
  /** The line out: what the numbers hold, back in dBu (0 dBFS a peak of +18 dBu) */
  const lineOutLevel = { rms: c.digital.rms + ALIGNMENT_DB, peak: c.digital.peak + ALIGNMENT_DB }
  const lineOutHealth = healthOf(lineOutLevel.rms, lineOutLevel.peak, 'analog')

  const stairs = stairsOf(shown, rate, span)
  const dots = dotsOf(shown, adcX, stopped, GRAPH_W / perWindow)
  const stepCount = numberText(2 ** bits)
  const words = shown.slice(0, WORD_ROWS)

  return (
    <g>
      {/* 1 · Line level: the line's graph, its meter */}
      <Step n={LINE_STEP} step={step}>
        <Label at={[IN_X + 8, R1.anTop - 30]}>{l.lineLevel}</Label>
        <Axes x={IN_X} row={R1} />
        <AnalogLines x={IN_X} row={R1} />
        <path d={wavePath(inX, (t) => c.arriving(t, PHASE), span, R1)} fill="none" stroke={TRACE} strokeWidth={3} strokeLinejoin="round" />
        <TimeEnd x={IN_X} row={R1} span={span} />
        <LevelMeter x={IN_METER_X} y={R1.anTop} w={METER_W} h={R1.anBottom - R1.anTop} rms={c.analog.rms} peak={c.analog.peak} />
        <Readings x={IN_METER_X} y={R1.readY} peak={formatDb(c.analog.peak)} health={analog} />
      </Step>

      {/* 2 · The filter, the A/D converter and its clock, the samples rounded to their bits, each step's number; its meter; the numbers */}
      <Step n={SAMPLE_STEP} step={step}>
        <line x1={IN_X + GRAPH_W + 20} y1={R1.cy} x2={ADC_L} y2={R1.cy} stroke={INK} strokeWidth={2} />
        <Filter left={FILTER_L} right={FILTER_R} row={R1} />

        <rect x={ADC_L} y={R1.boxTop} width={ADC_R - ADC_L} height={R1.boxBottom - R1.boxTop} {...BOX} />
        <Label at={[(ADC_L + ADC_R) / 2, R1.nameY]} anchor="middle">{l.adc}</Label>
        <FullScale from={IN_X + GRAPH_W} to={ADC_X + GRAPH_W} row={R1} />
        <Label at={[ADC_X + 8, R1.fsTop - 10]}>{l.fullScale}</Label>
        <Label at={[ADC_X + GRAPH_W, R1.fsTop - 10]} anchor="end">
          {fmt(bitStep * PX_V < STEP_LINES_PX ? l.stepsTooClose : l.steps, { n: stepCount })}
        </Label>
        <Axes x={ADC_X} row={R1} />
        <StepLines x={ADC_X} bits={bits} row={R1} />
        <StepCodes bits={bits} />
        {/* The wave it is fed, faint; the samples: each a faint line at its moment (while far enough apart), a stem from 0 V, a dot */}
        <path d={wavePath(adcX, (t) => c.received(t, PHASE), span, R1)} fill="none" stroke={TRACE} strokeWidth={2} opacity={0.35} />
        {dots.lines && <path d={dots.lines} fill="none" stroke={MOVER} strokeWidth={1} opacity={0.3} />}
        {([[dots.kept, MOVER], [dots.stopped, CLIPPED]] as const).map(([d, colour]) => d.stems && (
          <g key={colour} stroke={colour} fill="none" strokeLinecap="round">
            <path d={d.stems} strokeWidth={dots.stem} />
            <path d={d.dots} strokeWidth={2 * dots.r} />
          </g>
        ))}
        <TimeEnd x={ADC_X} row={R1} span={span} />
        {jitter > 0 && <Label at={[ADC_X + 10, R1.boxTop + 34]}>{l.wobbleBigger}</Label>}

        {/* Its meter: the signal (its average solid, its peaks pale, a line at the peak), the noise under it grey */}
        <rect x={METER_X} y={R1.fsTop} width={METER_W} height={R1.fsBottom - R1.fsTop} rx={2} fill={FAINT} opacity={0.5} />
        <rect x={METER_X} y={meterY(floor.total)} width={METER_W} height={R1.fsBottom - meterY(floor.total)} fill={zoneColor('noise')} />
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
        <Label at={[MARKS_X, R1.fsTop + 6]}>0 dBFS</Label>
        {placed.map((m) => (
          <g key={m.name}>
            <line x1={METER_X - 4} y1={meterY(m.db)} x2={METER_X + METER_W + 4} y2={meterY(m.db)} stroke={INK} strokeWidth={1.5} />
            <path d={`M${METER_X + METER_W + 4} ${meterY(m.db)} L${MARKS_X - 6} ${m.y - 6}`} fill="none" stroke={PART} strokeWidth={0.75} strokeDasharray="3 3" />
            <Label at={[MARKS_X, m.y]}>{m.name}</Label>
            {c.digital.rms - m.db >= 1 && <Label at={[MARKS_X, m.y + 24]}>{fmt(l.underSignal, { db: String(Math.round(c.digital.rms - m.db)) })}</Label>}
          </g>
        ))}
        <Readings x={METER_X} y={R1.fsBottom + 60} peak={formatDb(c.digital.peak, 'digital')} health={digital} />

        {/* The clock between the rows, ticking at the sample rate, wired into the A/D converter's bottom */}
        <rect x={CLOCK_L} y={CLOCK_TOP} width={CLOCK_R - CLOCK_L} height={CLOCK_BOTTOM - CLOCK_TOP} {...BOX} rx={8} />
        <path d={clockPath(jitter / JITTER_MAX)} fill="none" stroke={MOVER} strokeWidth={2} />
        <Label at={[(CLOCK_L + CLOCK_R) / 2, CLOCK_TOP - 13]} anchor="middle">{fmt(l.timesASecond, { n: numberText(rate) })}</Label>
        <path d={`M${CLOCK_R} ${CLOCK_WIRE_Y} H${CLOCK_INTO_ADC} V${R1.boxBottom}`} {...CLOCK_WIRE} />

        {/* The numbers: the samples' words, in order */}
        <line x1={ADC_R} y1={R1.cy} x2={WORD_L} y2={R1.cy} {...DIGITAL} />
        <rect x={WORD_L} y={R1.boxTop} width={WORD_R - WORD_L} height={R1.boxBottom - R1.boxTop} {...BOX} />
        <Label at={[(WORD_L + WORD_R) / 2, R1.nameY]} anchor="middle">{fmt(l.numbers, { bits: bitsText(t, bits) })}</Label>
        <Label at={[COUNT_X, R1.boxTop + 50]} anchor="end">{l.sampleNo}</Label>
        <Label at={[WORD_X, R1.boxTop + 50]}>{l.writtenAs}</Label>
        {words.map((s, i) => {
          const y = R1.boxTop + 92 + i * WORD_GAP
          return (
            <g key={i}>
              <text className="lsc-dd-code" x={COUNT_X} y={y} textAnchor="end">{i + 1}</text>
              <text className="lsc-dd-word" x={WORD_X} y={y} style={stopped(s) ? { fill: CLIPPED } : undefined}>{wordOf(codeOf(s.value, bits), bits)}</text>
            </g>
          )
        })}
        {shown.length > WORD_ROWS && (
          <Label at={[(WORD_L + WORD_R) / 2, R1.boxBottom - 22]} anchor="middle">
            {fmt(l.firstSamples, { n: String(WORD_ROWS), total: numberText(shown.length) })}
          </Label>
        )}
      </Step>

      {/* 3 · Back to voltage: the digital line round to the D/A converter, its steps, the filter after it; the line out, never quite what came in; the difference */}
      <Step n={DAC_STEP} step={step}>
        <path d={`M${WORD_R} ${R1.cy} H${LOOP_X} V${DIGITAL_Y} H${DIGITAL_INTO_DAC} V${R2.boxTop}`} {...DIGITAL} />
        <path d={`M${(CLOCK_L + CLOCK_R) / 2} ${CLOCK_BOTTOM} V${R2.boxTop}`} {...CLOCK_WIRE} />
        <rect x={DAC_L} y={R2.boxTop} width={DAC_R - DAC_L} height={R2.boxBottom - R2.boxTop} {...BOX} />
        <Label at={[(DAC_L + DAC_R) / 2, R2.nameY]} anchor="middle">{l.dac}</Label>
        <FullScale from={DAC_X} to={DAC_X + GRAPH_W} row={R2} />
        <Axes x={DAC_X} row={R2} />
        <StepLines x={DAC_X} bits={bits} row={R2} />
        <path d={stairs} fill="none" stroke={MOVER} strokeWidth={2.5} strokeLinejoin="round" />
        <TimeEnd x={DAC_X} row={R2} span={span} />

        <line x1={DAC_R} y1={R2.cy} x2={OUT_FILTER_L} y2={R2.cy} stroke={INK} strokeWidth={2} />
        <Filter left={OUT_FILTER_L} right={OUT_FILTER_R} row={R2} />
        <line x1={OUT_FILTER_R} y1={R2.cy} x2={OUT_X} y2={R2.cy} stroke={INK} strokeWidth={2} />
        <Label at={[OUT_X + 8, R2.anTop - 30]}>{l.lineOutReading}</Label>
        <Axes x={OUT_X} row={R2} />
        <AnalogLines x={OUT_X} row={R2} />
        {out && <path d={out.gap} fill={WRONG} opacity={0.35} stroke="none" />}
        <path d={wavePath(outX, (t) => c.arriving(t, PHASE), span, R2)} fill="none" stroke={INK} strokeWidth={1.25} strokeDasharray="4 4" opacity={0.6} />
        {out && <path d={out.path} fill="none" stroke={TRACE} strokeWidth={3} strokeLinejoin="round" />}
        <TimeEnd x={OUT_X} row={R2} span={span} />
        <LevelMeter x={OUT_METER_X} y={R2.anTop} w={METER_W} h={R2.anBottom - R2.anTop} rms={lineOutLevel.rms} peak={lineOutLevel.peak} />
        <Readings x={OUT_METER_X} y={R2.readY} peak={formatDb(lineOutLevel.peak)} health={lineOutHealth} />

        {/* The difference: the line out less what came in, on its own graph, as big as it must be drawn to be seen */}
        {out && (
          <>
            <Label at={[DIFF_X + 8, R2.anTop - 30]}>{out.bigger > 1 ? fmt(l.drawnBigger, { n: numberText(out.bigger) }) : l.differenceTrue}</Label>
            <Axes x={DIFF_X} row={R2} />
            <Label at={[DIFF_X - 8, R2.cy + 6]} anchor="end">0 V</Label>
            <path d={out.diff} fill="none" stroke={WRONG} strokeWidth={2} strokeLinejoin="round" />
            <TimeEnd x={DIFF_X} row={R2} span={span} />
            <text className="lsc-dd-reading" x={DIFF_X} y={R2.readY}>{fmt(l.difference, { db: minus(out.db) })}</text>
            <Label at={[DIFF_X, R2.readY + 30]}>{l.heard[heardOf(out.db)]}</Label>
          </>
        )}
      </Step>
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
const column: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 10, flexShrink: 0 }
const caption: CSSProperties = { fontSize: 12, color: 'var(--lsc-fg-muted)', whiteSpace: 'nowrap', marginRight: 2 }
const valueText: CSSProperties = { fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }
const choice: CSSProperties = {
  height: 30, padding: '0 6px', borderRadius: 8, border: '1px solid var(--lsc-border)', background: 'transparent',
  color: 'var(--lsc-fg)', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
}

/** A setting's buttons, one a choice (the one in use lit, as the steps' shapes are); `stacked`: one over the other */
function Choices<T>({ name, options, value, text, onPick, stacked = false }: {
  name: string; options: readonly T[]; value: T; text: (v: T) => string; onPick: (v: T) => void; stacked?: boolean
}) {
  return (
    <div role="group" aria-label={name} style={stacked ? column : group}>
      {options.map((o) => {
        const on = o === value
        return (
          <button
            key={String(o)} onClick={() => onPick(o)} aria-pressed={on} className="lsc-btn-outline"
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
      <StableText reserve={reserve} style={valueText}>{text}</StableText>
    </div>
  )
}

/** The gain knob's size: as big as the two rows of buttons beside it allow */
const KNOB = 40
const CLOCKS = [false, true] as const

/**
 * The subject's controls under the picture, each from its step: the `knobs` — the gain knob first
 * (the line in's), the frequency's slider (20 Hz … 30 kHz in third octaves) —, the `choices` — the
 * clock's (Steady over Wobbly), then the sample rate's buttons over the bit depth's (their units say
 * what they are)
 */
export function ConversionControls({ step, part }: { step: number; part: 'knobs' | 'choices' }) {
  const s = useConversion()
  const { t, fmt } = useTranslation()
  const l = t.deepDive.labels
  const stacked = useMediaQuery(STACKED_SLIDER_QUERY)
  if (part === 'choices') {
    return step >= SAMPLE_STEP ? (
      <div style={{ ...group, gap: 18, alignItems: 'center' }}>
        <div style={{ ...group, gap: 8 }}>
          <span style={caption}>{l.clock}</span>
          <Choices stacked name={l.clock} options={CLOCKS} value={s.wobbly} text={(w) => (w ? l.wobbly : l.steady)} onPick={(wobbly) => s.set({ wobbly })} />
        </div>
        <div style={column}>
          <Choices name={l.sampleRate} options={RATES} value={s.rate as (typeof RATES)[number]} text={(r) => rateText(t, r)} onPick={(rate) => s.set({ rate })} />
          <Choices name={l.bitDepth} options={BIT_DEPTHS} value={s.bits as (typeof BIT_DEPTHS)[number]} text={(b) => bitsText(t, b)} onPick={(bits) => s.set({ bits })} />
        </div>
      </div>
    ) : null
  }
  const dB = (gain: number) => `${gain > 0 ? '+' : gain < 0 ? '−' : '±'}${Math.abs(gain)} ${l.db}`
  /** A tone in Hz below 1 kHz, else in kHz (31.5 Hz, 1.25 kHz) */
  const toneText = (hz: number) => (hz < 1000 ? fmt(l.hz, { n: String(hz) }) : fmt(t.formats.rate, { n: String(hz / 1000) }))
  const toneAt = Math.max(0, TONES.indexOf(s.tone as (typeof TONES)[number]))
  const gainMin = LEVEL_MIN - LEVEL_START, gainMax = LEVEL_MAX - LEVEL_START, gainText = dB(s.gain)
  /** Its steps the third-octave bands: as many in each octave, low or high */
  const slider = (
    <input
      type="range" min={0} max={TONES.length - 1} step={1} value={toneAt}
      aria-label={l.frequency} aria-valuetext={toneText(s.tone)}
      onChange={(e) => s.set({ tone: TONES[Number(e.target.value)] })} className="lsc-dd-slider"
      style={stacked ? { width: '100%' } : { flex: '0 1 220px', minWidth: 100 }}
    />
  )
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
      {step >= DAC_STEP && (stacked ? (
        // Narrow: its name and value over it, the panel's two rows
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '0 1 180px', minWidth: 104 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={caption}>{l.frequency}</span>
            <StableText reserve={TONES.map(toneText)} style={valueText}>{toneText(s.tone)}</StableText>
          </div>
          {slider}
        </div>
      ) : (
        <Named name={l.frequency} text={toneText(s.tone)} reserve={TONES.map(toneText)} shrink>{slider}</Named>
      ))}
    </div>
  )
}
