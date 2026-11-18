import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
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
import type { ConversionSettings } from './conversionSettings'

// A/D and D/A conversion (Deep dive, D46): a line-level sine into an A/D converter, its numbers, and
// out of a D/A converter — modules side by side, in one picture where height is voltage, as in
// Analogue amplification: full scale (0 dBFS) is a peak of +18 dBu, as the canvas aligns them, its
// dashed line running through every graph. Each graph is one cycle of the tone (`windowOf`: 0.5 ms
// at 2 kHz, 50 ms at 20 Hz), so how many samples a cycle gets shows at once — a low tone's thousands
// (drawn as paths, the dots shrinking to fit), a high one's few. The picture stands still
// (a sine is the same moving or not): the controls set it (`useConversion`), each from its step — under
// it the gain knob and the frequency's slider right of the steps, the sample rate's and bit depth's
// buttons in two rows at the right; the clock's buttons on the picture, above the clock.
// (1) Line level: the line's graph, its meter (dBu) — an average of 0 dBu, its peaks far under
//     the +18 dBu line, the analogue side's own top (+20 dBu, where the canvas clips) above it;
//     the gain knob turns it up or down.
// (2) The clock, the samples and the bits: the filter before the converter (always in), the A/D
//     converter, its clock above ticking at the sample rate (Steady or Wobbly above it); at each tick a sample, rounded to the
//     nearest of its bit depth's steps (the steps drawn while far enough apart); a wobbly clock takes
//     them early or late (drawn thousands of times bigger) — they are played back on time. Its meter
//     (dBFS) shows the signal, the noise its bits leave, and a budget and a quality converter's own
//     noise, each with how far under the signal it is. The numbers as their bits, a column a sample
//     (the first GRID_MAX of a cycle with more, said in the box).
// (3) Back to voltage: the D/A converter holds each number until the next (the steps); its filter
//     smooths them into the line out — never quite the input: the difference (the converters' own
//     noise, the rounding, the wobble) drawn as many times bigger as it takes to be seen; its meter
//     (dBu) at the right, framing the picture with the line in's: the numbers' level back in volts
//     (full scale a peak of +18 dBu — clipped numbers stay clipped, never past it). The tone's
//     frequency from here: past half the sample rate (Nyquist) the filter takes the tone out; and the
//     gain turned up shows 0 dBFS with nothing above it — the same signal hot in volts, clipping in
//     numbers, its tops cut flat (red).
// The numbers are converter.ts's; the converters are quality ones (their noise in the output).

// ── Where things are, in the scene's units ──────────────────────────────────
/** Height is voltage: the middle line is 0 V, full scale 220 px above and below it */
const CY = 330, PX_V = 220 / FS_VOLTS
const vy = (volts: number) => CY - PX_V * volts
const FS_TOP = vy(FS_VOLTS), FS_BOTTOM = vy(-FS_VOLTS), AN_TOP = vy(ANALOG_TOP), AN_BOTTOM = vy(-ANALOG_TOP)
/** Each graph's width: one cycle of the tone */
const GRAPH_W = 360
/** The modules' boxes: their top and bottom, their names under them */
const BOX_TOP = 30, BOX_BOTTOM = 660, NAME_Y = BOX_BOTTOM + 32
/** 1 · the line coming in: its graph, its meter left of it, its readings under the meter */
const IN_X = 60, IN_METER_X = -20, METER_W = 16, READ_Y = AN_BOTTOM + 42
/** 2 · the filter on the line in; the A/D converter, its graph, its meter (0 … −150 dBFS, along full scale's height) and the marks' words */
const FILTER_L = 455, FILTER_R = 510
const ADC_L = 520, ADC_X = 560, ADC_R = 1260, METER_X = 980, MARKS_X = 1040
/** The numbers' box and its grid; the clock above it, its wires into both converters' tops */
const NUM_L = 1340, NUM_X = 1380, NUM_R = 1780, ROW_MAX = 18, SQUARE_MAX = 24
/** The most samples the numbers' grid shows (a cycle with more: its first ones) */
const GRID_MAX = 64
const CLOCK_L = 1490, CLOCK_R = 1630, CLOCK_TOP = -60, CLOCK_BOTTOM = -10, CLOCK_WIRE_Y = -35
/** The clock's buttons above it: their top, their height, the gap between them */
const CHOICE_TOP = -146, CHOICE_H = 62, CHOICE_GAP = 8
/** 3 · the D/A converter, its graph; the line out's graph, its meter right of it (as far from it as the line in's is) */
const DAC_L = 1860, DAC_X = 1900, DAC_R = 2300, OUT_X = 2380, OUT_METER_X = OUT_X + GRAPH_W + (IN_X - IN_METER_X - METER_W)

export const LINE_STEP = 1, SAMPLE_STEP = 2, DAC_STEP = 3
/** The tone's phase at the graphs' left edge */
const PHASE = 0
/** Points a wave is drawn with */
const POINTS = 180
/** The steps' lines are drawn while at least this far apart; each sample's faint line while the samples are */
const STEP_LINES_PX = 4, SAMPLE_LINES_PX = 8

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
const meterY = (db: number) => FS_TOP + ((FS_BOTTOM - FS_TOP) * Math.min(150, Math.max(0, -db))) / 150

/** A wave over a graph's window (`span` s) */
function wavePath(x: (t: number) => number, volts: (t: number) => number, span: number): string {
  let d = ''
  for (let i = 0; i <= POINTS; i++) {
    const t = (span * i) / POINTS
    d += `${i ? ' L' : 'M'}${x(t).toFixed(1)} ${vy(volts(t)).toFixed(1)}`
  }
  return d
}

/** A whole number with thin spaces between its thousands, a real minus */
const numberText = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`
/** A level in whole dB, with a real minus */
const minus = (db: number) => numberText(Math.round(db))

/** A level's health as the canvas judges it, and the colour its word is written in */
function healthOf(rms: number, peak: number, domain: SignalDomain) {
  const health = getHealth(rms, domain, peak)
  return { health, colour: `var(--signal-${health}-text)` }
}

/** The samples a graph shows (0 … its last) and those either side the reconstruction reaches */
function picture(c: Conversion, span: number) {
  const last = Math.floor(span * c.setup.rate + 1e-9), first = -RECONSTRUCT_TAPS
  const samples = samplesOf(c, PHASE, first, last + RECONSTRUCT_TAPS)
  return { first, samples, shown: samples.slice(-first, -first + last + 1) }
}

/**
 * The line out against what came in: the difference drawn as many times bigger (a power of ten) as it
 * takes to be seen; how far under the signal it is (dB)
 */
function lineOut(c: Conversion, samples: readonly Sample[], first: number, span: number) {
  const out: number[] = [], want: number[] = [], outX = timeX(OUT_X, span)
  let worst = 0, sq = 0, sig = 0
  for (let i = 0; i <= POINTS; i++) {
    const t = (span * i) / POINTS, o = c.output(t, samples, first), w = c.arriving(t, PHASE)
    out.push(o); want.push(w)
    worst = Math.max(worst, Math.abs(o - w))
    sq += (o - w) ** 2; sig += w * w
  }
  const room = worst > 0 ? 25 / (PX_V * worst) : 1
  const bigger = room > 1 ? Math.min(1e6, 10 ** Math.floor(Math.log10(room))) : 1
  const path = out.map((o, i) => `${i ? 'L' : 'M'}${outX((span * i) / POINTS).toFixed(1)} ${vy(want[i] + bigger * (o - want[i])).toFixed(1)}`).join(' ')
  return { path, bigger, db: sig > 0 ? 10 * Math.log10(Math.max(sq, 1e-30) / sig) : 0 }
}

/** The meter's marks' words stacked down its right (each below the one before), a leader to each */
function stacked<T extends { db: number }>(marks: readonly T[]): (T & { y: number })[] {
  const out: (T & { y: number })[] = []
  for (const m of marks) {
    const y = Math.max(meterY(m.db) + 6, out.length ? out[out.length - 1].y + 66 : FS_TOP + 40)
    out.push({ ...m, y })
  }
  return out
}

/**
 * The numbers' grid: a column a sample, a row a bit (the sign on top) — its filled squares and its empty
 * ones; a column under each sample's moment, or, past GRID_MAX samples, the first GRID_MAX across the box
 */
function gridOf(shown: readonly Sample[], bits: number, perWindow: number): { filled: string; empty: string } {
  const rowH = Math.min(ROW_MAX, (FS_BOTTOM - FS_TOP) / bits), colW = GRAPH_W / Math.min(perWindow, GRID_MAX)
  const sqH = rowH - 3, sqW = Math.max(1.5, Math.min(colW - 3, SQUARE_MAX)), gridTop = CY - (rowH * bits) / 2
  const filled: string[] = [], empty: string[] = []
  shown.slice(0, GRID_MAX + 1).forEach((s, n) => {
    const left = NUM_X + n * colW + (colW - sqW) / 2
    if (left + sqW > NUM_X + GRAPH_W + 1) return
    bitsOf(codeOf(s.value, bits), bits).forEach((on, r) => {
      const box = `M${left.toFixed(1)} ${(gridTop + r * rowH + 1.5).toFixed(1)} h${sqW.toFixed(1)} v${sqH.toFixed(1)} h${(-sqW).toFixed(1)} Z`
      ;(on ? filled : empty).push(box)
    })
  })
  return { filled: filled.join(' '), empty: empty.join(' ') }
}

/** The D/A converter's steps: each number held until the next */
function stairsOf(shown: readonly Sample[], rate: number, span: number): string {
  const dacX = timeX(DAC_X, span)
  return shown.map((s, i) => {
    const y = vy(s.value).toFixed(1), to = Math.min(dacX((i + 1) / rate), DAC_X + GRAPH_W).toFixed(1)
    return i ? `V${y} H${to}` : `M${DAC_X} ${y} H${to}`
  }).join(' ')
}

/**
 * The A/D converter's samples as paths (a cycle can hold thousands): a faint line at each one's moment
 * while they are SAMPLE_LINES_PX apart, its stem from 0 V and its dot — the dots and stems thinning
 * with the room between them (`gap`); those stopped at full scale apart, for their colour
 */
function dotsOf(shown: readonly Sample[], x: (t: number) => number, stopped: (s: Sample) => boolean, gap: number) {
  const part = () => ({ stems: '', dots: '' })
  const kept = part(), held = part()
  let lines = ''
  for (const s of shown) {
    const at = x(s.at), y = vy(s.value)
    if (at < ADC_X - 0.5 || at > ADC_X + GRAPH_W + 0.5) continue
    const to = stopped(s) ? held : kept, ax = at.toFixed(1), ay = y.toFixed(1)
    if (gap >= SAMPLE_LINES_PX) lines += `M${ax} ${FS_TOP.toFixed(1)}V${FS_BOTTOM.toFixed(1)}`
    to.stems += `M${ax} ${CY}V${ay}`
    to.dots += `M${ax} ${ay}h0`
  }
  return { lines, kept, stopped: held, r: Math.min(5, Math.max(1, gap * 0.35)), stem: Math.min(1.5, Math.max(0.4, gap * 0.4)) }
}

const FULL_SCALE = { stroke: 'var(--signal-clipping)', strokeWidth: 1.5, strokeDasharray: '8 6' } as const
const BOX = { rx: 10, fill: 'var(--lsc-sunken)', stroke: PART, strokeWidth: 2 } as const
const DIGITAL = { stroke: MOVER, strokeWidth: 3, strokeDasharray: '12 5 4 5' } as const
const CLIPPED = 'var(--signal-clipping)'

/** A graph's axes: up at its left edge, time along its middle */
function Axes({ x }: { x: number }) {
  return (
    <>
      <line x1={x} y1={AN_TOP - 10} x2={x} y2={AN_BOTTOM + 10} stroke={INK} strokeWidth={1.5} />
      <line x1={x} y1={CY} x2={x + GRAPH_W + 20} y2={CY} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
    </>
  )
}

/** Full scale's two dashed lines across a stretch */
function FullScale({ from, to }: { from: number; to: number }) {
  return (
    <>
      <line x1={from} y1={FS_TOP} x2={to} y2={FS_TOP} {...FULL_SCALE} />
      <line x1={from} y1={FS_BOTTOM} x2={to} y2={FS_BOTTOM} {...FULL_SCALE} />
    </>
  )
}

/** An analogue graph's lines: the analogue side's top (+20 dBu) and full scale's (+18 dBu), named at their right */
function AnalogLines({ x }: { x: number }) {
  return (
    <>
      <line x1={x} y1={AN_TOP} x2={x + GRAPH_W} y2={AN_TOP} stroke={CLIPPED} strokeWidth={1.5} />
      <line x1={x} y1={AN_BOTTOM} x2={x + GRAPH_W} y2={AN_BOTTOM} stroke={CLIPPED} strokeWidth={1.5} />
      <FullScale from={x} to={x + GRAPH_W} />
      <Label at={[x + GRAPH_W, AN_TOP - 8]} anchor="end">+20 dBu</Label>
      <Label at={[x + GRAPH_W, FS_TOP - 8]} anchor="end">+18 dBu</Label>
      <Label at={[x - 8, CY + 6]} anchor="end">0 V</Label>
    </>
  )
}

/** The bit depth's steps across a graph, while far enough apart to be seen */
function StepLines({ x, bits }: { x: number; bits: number }) {
  const { step } = codeRange(bits), half = 2 ** (bits - 1)
  if (step * PX_V < STEP_LINES_PX) return null
  let d = ''
  for (let k = -half; k < half; k++) d += `M${x} ${vy(k * step).toFixed(1)} H${x + GRAPH_W} `
  return <path d={d} fill="none" stroke={FAINT} strokeWidth={1} />
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
  const setSettings = settings.set
  const { t, fmt } = useTranslation()
  const l = t.deepDive.labels

  const c = conversionOf(setupAt(step, settings))
  const { rate, jitter } = c.setup
  const bits = c.setup.bits ?? BITS_START
  /** One cycle of the tone: how long each graph is, how many samples it holds */
  const span = windowOf(c.setup.tone), perWindow = span * rate
  const inX = timeX(IN_X, span), adcX = timeX(ADC_X, span), outX = timeX(OUT_X, span)
  const { first, samples, shown } = picture(c, span)
  const top = codeRange(bits).top
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

  const { filled, empty } = gridOf(shown, bits, perWindow)
  const stairs = stairsOf(shown, rate, span)
  const dots = dotsOf(shown, adcX, stopped, GRAPH_W / perWindow)

  return (
    <g>
      {/* 1 · Line level: the line's graph, its meter */}
      <Step n={LINE_STEP} step={step}>
        <Label at={[IN_X + 8, AN_TOP - 30]}>{l.lineLevel}</Label>
        <Axes x={IN_X} />
        <AnalogLines x={IN_X} />
        <path d={wavePath(inX, (t) => c.arriving(t, PHASE), span)} fill="none" stroke={TRACE} strokeWidth={3} strokeLinejoin="round" />
        <LevelMeter x={IN_METER_X} y={AN_TOP} w={METER_W} h={AN_BOTTOM - AN_TOP} rms={c.analog.rms} peak={c.analog.peak} />
        <Readings x={IN_METER_X} y={READ_Y} peak={formatDb(c.analog.peak)} health={analog} />
      </Step>

      {/* 2 · The filter, the A/D converter and its clock, the samples rounded to their bits; its meter; the numbers */}
      <Step n={SAMPLE_STEP} step={step}>
        <line x1={IN_X + GRAPH_W + 20} y1={CY} x2={ADC_L} y2={CY} stroke={INK} strokeWidth={2} />
        <rect x={FILTER_L} y={CY - 26} width={FILTER_R - FILTER_L} height={52} {...BOX} rx={6} />
        <path d={`M${FILTER_L + 8} ${CY - 6} H${FILTER_L + 30} Q${FILTER_L + 38} ${CY - 6} ${FILTER_L + 42} ${CY + 14}`} fill="none" stroke={INK} strokeWidth={1.5} />
        <Label at={[(FILTER_L + FILTER_R) / 2, CY - 36]} anchor="middle">{l.filter}</Label>

        <rect x={ADC_L} y={BOX_TOP} width={ADC_R - ADC_L} height={BOX_BOTTOM - BOX_TOP} {...BOX} />
        <Label at={[(ADC_L + ADC_R) / 2, NAME_Y]} anchor="middle">{l.adc}</Label>
        <FullScale from={IN_X + GRAPH_W} to={ADC_X + GRAPH_W} />
        <Label at={[ADC_X + 8, FS_TOP - 10]}>{l.fullScale}</Label>
        <Axes x={ADC_X} />
        <StepLines x={ADC_X} bits={bits} />
        {/* The samples: each a faint line at its moment (while far enough apart), a stem from 0 V, a dot */}
        {dots.lines && <path d={dots.lines} fill="none" stroke={MOVER} strokeWidth={1} opacity={0.3} />}
        {([[dots.kept, MOVER], [dots.stopped, CLIPPED]] as const).map(([d, colour]) => d.stems && (
          <g key={colour} stroke={colour} fill="none" strokeLinecap="round">
            <path d={d.stems} strokeWidth={dots.stem} />
            <path d={d.dots} strokeWidth={2 * dots.r} />
          </g>
        ))}
        {jitter > 0 && <Label at={[ADC_X + 10, BOX_TOP + 34]}>{l.wobbleBigger}</Label>}

        {/* Its meter: the signal (its average solid, its peaks pale, a line at the peak), the noise under it grey */}
        <rect x={METER_X} y={FS_TOP} width={METER_W} height={FS_BOTTOM - FS_TOP} rx={2} fill={FAINT} opacity={0.5} />
        <rect x={METER_X} y={meterY(floor.total)} width={METER_W} height={FS_BOTTOM - meterY(floor.total)} fill={zoneColor('noise')} />
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
        <Label at={[MARKS_X, FS_TOP + 6]}>0 dBFS</Label>
        {placed.map((m) => (
          <g key={m.name}>
            <line x1={METER_X - 4} y1={meterY(m.db)} x2={METER_X + METER_W + 4} y2={meterY(m.db)} stroke={INK} strokeWidth={1.5} />
            <path d={`M${METER_X + METER_W + 4} ${meterY(m.db)} L${MARKS_X - 6} ${m.y - 6}`} fill="none" stroke={PART} strokeWidth={0.75} strokeDasharray="3 3" />
            <Label at={[MARKS_X, m.y]}>{m.name}</Label>
            {c.digital.rms - m.db >= 1 && <Label at={[MARKS_X, m.y + 28]}>{fmt(l.underSignal, { db: String(Math.round(c.digital.rms - m.db)) })}</Label>}
          </g>
        ))}
        <Readings x={METER_X} y={FS_BOTTOM + 52} peak={formatDb(c.digital.peak, 'digital')} health={digital} />

        {/* The clock above the numbers, ticking at the sample rate, wired into both converters; Steady or Wobbly above it */}
        <ClockChoice reached={step >= SAMPLE_STEP} wobbly={settings.wobbly} onPick={(wobbly) => setSettings({ wobbly })} />
        <rect x={CLOCK_L} y={CLOCK_TOP} width={CLOCK_R - CLOCK_L} height={CLOCK_BOTTOM - CLOCK_TOP} {...BOX} rx={8} />
        <path d={clockPath(jitter / JITTER_MAX)} fill="none" stroke={MOVER} strokeWidth={2} />
        <Label at={[(CLOCK_L + CLOCK_R) / 2, BOX_TOP - 10]} anchor="middle">{fmt(l.timesASecond, { n: numberText(rate) })}</Label>
        <path d={`M${CLOCK_L} ${CLOCK_WIRE_Y} H${ADC_X + GRAPH_W / 2} V${BOX_TOP}`} fill="none" stroke={MOVER} strokeWidth={1.5} strokeDasharray="2 4" />

        {/* The numbers: a column a sample, a row a bit */}
        <line x1={ADC_R} y1={CY} x2={NUM_L} y2={CY} {...DIGITAL} />
        <rect x={NUM_L} y={BOX_TOP} width={NUM_R - NUM_L} height={BOX_BOTTOM - BOX_TOP} {...BOX} />
        <Label at={[(NUM_L + NUM_R) / 2, NAME_Y]} anchor="middle">{fmt(l.numbers, { bits: bitsText(t, bits) })}</Label>
        <path d={filled} fill={MOVER} />
        <path d={empty} fill="none" stroke={MOVER} strokeWidth={1} />
        {perWindow > GRID_MAX + 1 && (
          <Label at={[(NUM_L + NUM_R) / 2, BOX_BOTTOM - 24]} anchor="middle">
            {fmt(l.firstSamples, { n: String(GRID_MAX), total: numberText(Math.floor(perWindow)) })}
          </Label>
        )}
      </Step>

      {/* 3 · Back to voltage: the D/A converter's steps; the line out, never quite what came in */}
      <Step n={DAC_STEP} step={step}>
        <line x1={NUM_R} y1={CY} x2={DAC_L} y2={CY} {...DIGITAL} />
        <path d={`M${CLOCK_R} ${CLOCK_WIRE_Y} H${DAC_X + GRAPH_W / 2} V${BOX_TOP}`} fill="none" stroke={MOVER} strokeWidth={1.5} strokeDasharray="2 4" />
        <rect x={DAC_L} y={BOX_TOP} width={DAC_R - DAC_L} height={BOX_BOTTOM - BOX_TOP} {...BOX} />
        <Label at={[(DAC_L + DAC_R) / 2, NAME_Y]} anchor="middle">{l.dac}</Label>
        <FullScale from={DAC_X} to={DAC_X + GRAPH_W} />
        <Axes x={DAC_X} />
        <StepLines x={DAC_X} bits={bits} />
        <path d={stairs} fill="none" stroke={MOVER} strokeWidth={2.5} strokeLinejoin="round" />

        <line x1={DAC_R} y1={CY} x2={OUT_X} y2={CY} stroke={INK} strokeWidth={2} />
        <Label at={[OUT_X + 8, AN_TOP - 30]}>{l.lineOutReading}</Label>
        <Axes x={OUT_X} />
        <AnalogLines x={OUT_X} />
        <path d={wavePath(outX, (t) => c.arriving(t, PHASE), span)} fill="none" stroke={INK} strokeWidth={1.25} strokeDasharray="4 4" opacity={0.5} />
        {out && (
          <>
            <path d={out.path} fill="none" stroke={TRACE} strokeWidth={3} strokeLinejoin="round" />
            <text className="lsc-dd-reading" x={OUT_X} y={READ_Y}>{fmt(l.difference, { db: minus(out.db) })}</text>
            {out.bigger > 1 && <Label at={[OUT_X, READ_Y + 30]}>{fmt(l.drawnBigger, { n: numberText(out.bigger) })}</Label>}
          </>
        )}
        <LevelMeter x={OUT_METER_X} y={AN_TOP} w={METER_W} h={AN_BOTTOM - AN_TOP} rms={lineOutLevel.rms} peak={lineOutLevel.peak} />
        <Readings x={OUT_METER_X} y={READ_Y} peak={formatDb(lineOutLevel.peak)} health={lineOutHealth} />
      </Step>

    </g>
  )
}

/**
 * The clock's buttons, Steady and Wobbly, centred above it after its name: drawn in the picture (they
 * grow with it), lit as the controls' buttons are; each as wide as its word (measured)
 */
function ClockChoice({ reached, wobbly, onPick }: { reached: boolean; wobbly: boolean; onPick: (wobbly: boolean) => void }) {
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
  const left = (CLOCK_L + CLOCK_R) / 2 - total / 2, mid = CHOICE_TOP + CHOICE_H / 2
  let x = left + widths[0] + 14
  return (
    <g role="group" aria-label={l.clock} style={{ visibility: widths[0] ? undefined : 'hidden' }}>
      <text ref={name} className="lsc-dd-label" x={left} y={mid + 7}>{l.clock}</text>
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
          <g key={String(o)} role="button" tabIndex={reached ? 0 : -1} aria-pressed={on} onClick={pick} onKeyDown={onKey} className="lsc-dd-choice">
            <rect x={at} y={CHOICE_TOP} width={boxes[i]} height={CHOICE_H} rx={14}
              fill={on ? 'var(--lsc-accent-bg)' : 'transparent'} stroke={on ? 'var(--lsc-accent)' : 'var(--lsc-border)'} strokeWidth={2} />
            <text ref={(el) => { words.current[i] = el }} className="lsc-dd-reading" x={at + PAD} y={mid + 8}>{texts[i]}</text>
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

/** A setting's buttons, one a choice (the one in use lit, as the steps' shapes are) */
function Choices<T>({ name, options, value, text, onPick }: {
  name: string; options: readonly T[]; value: T; text: (v: T) => string; onPick: (v: T) => void
}) {
  return (
    <div role="group" aria-label={name} style={group}>
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
      <StableText reserve={reserve} style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{text}</StableText>
    </div>
  )
}

/** The gain knob's size: as big as the two rows of buttons beside it allow */
const KNOB = 40

/**
 * The subject's controls under the picture, each from its step (the clock's are on it): the `knobs` —
 * the gain knob first (the line in's), the frequency's slider (20 Hz … 30 kHz in third octaves) —, the `choices` — the sample rate's
 * buttons over the bit depth's (their units say what they are)
 */
export function ConversionControls({ step, part }: { step: number; part: 'knobs' | 'choices' }) {
  const s = useConversion()
  const { t, fmt } = useTranslation()
  const l = t.deepDive.labels
  if (part === 'choices') {
    return step >= SAMPLE_STEP ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
        <Choices name={l.sampleRate} options={RATES} value={s.rate as (typeof RATES)[number]} text={(r) => rateText(t, r)} onPick={(rate) => s.set({ rate })} />
        <Choices name={l.bitDepth} options={BIT_DEPTHS} value={s.bits as (typeof BIT_DEPTHS)[number]} text={(b) => bitsText(t, b)} onPick={(bits) => s.set({ bits })} />
      </div>
    ) : null
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
      {step >= DAC_STEP && (
        <Named name={l.frequency} text={toneText(s.tone)} reserve={TONES.map(toneText)} shrink>
          {/* Its steps the third-octave bands: as many in each octave, low or high */}
          <input
            type="range" min={0} max={TONES.length - 1} step={1} value={toneAt}
            aria-label={l.frequency} aria-valuetext={toneText(s.tone)}
            onChange={(e) => s.set({ tone: TONES[Number(e.target.value)] })} className="lsc-dd-slider" style={{ flex: '0 1 220px', minWidth: 100 }}
          />
        </Named>
      )}
    </div>
  )
}
