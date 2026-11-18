import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { formatDb, getHealth, zoneColor } from '../../signal/levels'
import type { MeterZoneKind, SignalDomain, SignalHealth } from '../../signal/levels'
import { bitsText, rateText } from '../../utils/formatText'
import {
  ANALOG_TOP, BIT_DEPTHS, BITS_START, FS_VOLTS, JITTER_MAX, LEVEL_MAX, LEVEL_MIN, LEVEL_START, OWN_NOISE, RATES,
  RATE_START, RECONSTRUCT_TAPS, TONE_MAX, TONE_MIN, TONE_START, WINDOW_S,
  bitsOf, codeOf, codeRange, conversionOf, floorOf, samplesOf,
} from '../converter'
import type { Conversion, Sample, Setup } from '../converter'
import { ARROW_INK, FAINT, INK, MOVER, PART, TRACE } from './look'
import type { SceneProps } from './painter'
import { Label, Step } from './sceneParts'
import { LevelMeter } from './circuitParts'
import { useConversion } from './conversionSettings'
import { SceneKnob } from './SceneKnob'
import type { ConversionSettings } from './conversionSettings'

// A/D and D/A conversion (Deep dive, D46): a line-level sine into an A/D converter, its numbers, and
// out of a D/A converter — modules side by side, in one picture where height is voltage, as in
// Analogue amplification: full scale (0 dBFS) is a peak of +18 dBu, as the canvas aligns them, its
// dashed line running through every graph. Each graph is the same 0.5 ms. The picture stands still
// (a sine is the same moving or not): the controls under it set it (`useConversion`), each from its
// step, in both rows — the sample rate's and bit depth's buttons after the step's name; the gain knob
// first in the second, the clock's buttons, the frequency's slider.
// (1) Line level: the line's graph, its meter (dBu) — an average of 0 dBu, its peaks far under
//     the +18 dBu line, the analogue side's own top (+20 dBu, where the canvas clips) above it;
//     the gain knob turns it up or down.
// (2) The clock, the samples and the bits: the filter before the converter (always in), the A/D
//     converter, its clock above ticking at the sample rate; at each tick a sample, rounded to the
//     nearest of its bit depth's steps (the steps drawn while far enough apart); a wobbly clock takes
//     them early or late (drawn thousands of times bigger) — they are played back on time. Its meter
//     (dBFS) shows the signal, the noise its bits leave, and a budget and a quality converter's own
//     noise, each with how far under the signal it is. The numbers as their bits, a column a sample.
// (3) Back to voltage: the D/A converter holds each number until the next (the steps); its filter
//     smooths them into the line out — never quite the input: the difference (the converters' own
//     noise, the rounding, the wobble) drawn as many times bigger as it takes to be seen.
// (4) Nyquist: the tone's frequency; the sines in the output up to 50 kHz, half the sample rate marked:
//     past it, the filter takes the tone out.
// (5) 0 dBFS, nothing above it: the gain turned up — the same signal hot in volts, clipping in
//     numbers: its tops cut flat (red), new sines in the output.
// The numbers are converter.ts's; the converters are quality ones (their noise in the output).

// ── Where things are, in the scene's units ──────────────────────────────────
/** Height is voltage: the middle line is 0 V, full scale 220 px above and below it */
const CY = 330, PX_V = 220 / FS_VOLTS
const vy = (volts: number) => CY - PX_V * volts
const FS_TOP = vy(FS_VOLTS), FS_BOTTOM = vy(-FS_VOLTS), AN_TOP = vy(ANALOG_TOP), AN_BOTTOM = vy(-ANALOG_TOP)
/** Each graph's width: 0.5 ms */
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
const CLOCK_L = 1490, CLOCK_R = 1630, CLOCK_TOP = -60, CLOCK_BOTTOM = -10, CLOCK_WIRE_Y = -35
/** 3 · the D/A converter, its graph; the line out's graph */
const DAC_L = 1860, DAC_X = 1900, DAC_R = 2300, OUT_X = 2380
/** 4 · the sines in the output, under the line out (0 … 50 kHz, 0 … −100 dBFS) */
const SPEC_X = OUT_X, SPEC_TOP = BOX_BOTTOM + 80, SPEC_BOTTOM = BOX_BOTTOM + 180, SPEC_TO = 50000

export const LINE_STEP = 1, SAMPLE_STEP = 2, DAC_STEP = 3, NYQUIST_STEP = 4, CLIP_STEP = 5
/** The tone's phase at the graphs' left edge */
const PHASE = 0
/** Points a wave is drawn with */
const POINTS = 180
/** The steps' lines are drawn while at least this far apart */
const STEP_LINES_PX = 4

/** What the converter is set to at a step: what a later step adds stays at its start */
function setupAt(step: number, s: ConversionSettings): Setup {
  const sampled = step >= SAMPLE_STEP
  return {
    rate: sampled ? s.rate : RATE_START,
    bits: sampled ? s.bits : BITS_START,
    jitter: sampled && s.wobbly ? JITTER_MAX : 0,
    grade: 'quality',
    filter: true,
    tone: step >= NYQUIST_STEP ? s.tone : TONE_START,
    level: LEVEL_START + s.gain,
  }
}

const timeX = (left: number) => (t: number) => left + (GRAPH_W * t) / WINDOW_S
const inX = timeX(IN_X), adcX = timeX(ADC_X), dacX = timeX(DAC_X), outX = timeX(OUT_X)
const specX = (freq: number) => SPEC_X + (GRAPH_W * Math.min(freq, SPEC_TO)) / SPEC_TO
const specY = (db: number) => SPEC_TOP + Math.min(SPEC_BOTTOM - SPEC_TOP, Math.max(0, -db))
/** The A/D converter's meter: 0 dBFS at full scale's line, −150 at its bottom one */
const meterY = (db: number) => FS_TOP + ((FS_BOTTOM - FS_TOP) * Math.min(150, Math.max(0, -db))) / 150

/** A wave over a graph's 0.5 ms */
function wavePath(x: (t: number) => number, volts: (t: number) => number): string {
  let d = ''
  for (let i = 0; i <= POINTS; i++) {
    const t = (WINDOW_S * i) / POINTS
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
function picture(c: Conversion) {
  const last = Math.floor(WINDOW_S * c.setup.rate + 1e-9), first = -RECONSTRUCT_TAPS
  const samples = samplesOf(c, PHASE, first, last + RECONSTRUCT_TAPS)
  return { first, samples, shown: samples.slice(-first, -first + last + 1) }
}

/**
 * The line out against what came in: the difference drawn as many times bigger (a power of ten) as it
 * takes to be seen; how far under the signal it is (dB)
 */
function lineOut(c: Conversion, samples: readonly Sample[], first: number) {
  const out: number[] = [], want: number[] = []
  let worst = 0, sq = 0, sig = 0
  for (let i = 0; i <= POINTS; i++) {
    const t = (WINDOW_S * i) / POINTS, o = c.output(t, samples, first), w = c.arriving(t, PHASE)
    out.push(o); want.push(w)
    worst = Math.max(worst, Math.abs(o - w))
    sq += (o - w) ** 2; sig += w * w
  }
  const room = worst > 0 ? 25 / (PX_V * worst) : 1
  const bigger = room > 1 ? Math.min(1e6, 10 ** Math.floor(Math.log10(room))) : 1
  const path = out.map((o, i) => `${i ? 'L' : 'M'}${outX((WINDOW_S * i) / POINTS).toFixed(1)} ${vy(want[i] + bigger * (o - want[i])).toFixed(1)}`).join(' ')
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

/** The numbers' grid: a column a sample, a row a bit (the sign on top) — its filled squares and its empty ones */
function gridOf(shown: readonly Sample[], bits: number, rate: number): { filled: string; empty: string } {
  const rowH = Math.min(ROW_MAX, (FS_BOTTOM - FS_TOP) / bits), colW = GRAPH_W / WINDOW_S / rate
  const sqH = rowH - 3, sqW = Math.max(1.5, Math.min(colW - 3, SQUARE_MAX)), gridTop = CY - (rowH * bits) / 2
  const filled: string[] = [], empty: string[] = []
  shown.forEach((s, n) => {
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
function stairsOf(shown: readonly Sample[], rate: number): string {
  return shown.map((s, i) => {
    const y = vy(s.value).toFixed(1), to = Math.min(dacX((i + 1) / rate), DAC_X + GRAPH_W).toFixed(1)
    return i ? `V${y} H${to}` : `M${DAC_X} ${y} H${to}`
  }).join(' ')
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
  const { t, fmt } = useTranslation()
  const l = t.deepDive.labels

  const c = conversionOf(setupAt(step, settings))
  const { rate, jitter } = c.setup
  const bits = c.setup.bits ?? BITS_START
  const { first, samples, shown } = picture(c)
  const top = codeRange(bits).top
  /** A sample stopped at full scale (or a few bits' top number) */
  const stopped = (s: Sample) => c.clipped && Math.abs(s.held) >= 0.98 * (s.held > 0 ? top : FS_VOLTS)
  const out = step >= DAC_STEP ? lineOut(c, samples, first) : null

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

  const { filled, empty } = gridOf(shown, bits, rate)
  const stairs = stairsOf(shown, rate)

  const kHz = (hz: number) => fmt(t.formats.rate, { n: String(Math.round(hz / 10) / 100) })
  const nyquist = rate / 2
  const arriveDb = 20 * Math.log10(c.amplitude / FS_VOLTS)

  return (
    <g>
      {/* 1 · Line level: the line's graph, its meter */}
      <Step n={LINE_STEP} step={step}>
        <Label at={[IN_X + 8, AN_TOP - 30]}>{l.lineLevel}</Label>
        <Axes x={IN_X} />
        <AnalogLines x={IN_X} />
        <path d={wavePath(inX, (t) => c.arriving(t, PHASE))} fill="none" stroke={TRACE} strokeWidth={3} strokeLinejoin="round" />
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
        {shown.map((s, n) => {
          const x = adcX(s.at), y = vy(s.value)
          if (x < ADC_X - 0.5 || x > ADC_X + GRAPH_W + 0.5) return null
          const colour = stopped(s) ? CLIPPED : MOVER
          return (
            <g key={n}>
              <line x1={x} y1={FS_TOP} x2={x} y2={FS_BOTTOM} stroke={MOVER} strokeWidth={1} opacity={0.3} />
              <line x1={x} y1={CY} x2={x} y2={y} stroke={colour} strokeWidth={1.5} />
              <circle cx={x} cy={y} r={5} fill={colour} />
            </g>
          )
        })}
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

        {/* The clock above the numbers, ticking at the sample rate, wired into both converters */}
        <Label at={[(CLOCK_L + CLOCK_R) / 2, CLOCK_TOP - 10]} anchor="middle">{l.clock}</Label>
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
        <path d={wavePath(outX, (t) => c.arriving(t, PHASE))} fill="none" stroke={INK} strokeWidth={1.25} strokeDasharray="4 4" opacity={0.5} />
        {out && (
          <>
            <path d={out.path} fill="none" stroke={TRACE} strokeWidth={3} strokeLinejoin="round" />
            <text className="lsc-dd-reading" x={OUT_X} y={READ_Y}>{fmt(l.difference, { db: minus(out.db) })}</text>
            {out.bigger > 1 && <Label at={[OUT_X, READ_Y + 30]}>{fmt(l.drawnBigger, { n: numberText(out.bigger) })}</Label>}
          </>
        )}
      </Step>

      {/* 4 · Nyquist: the sines in the output, half the sample rate dashed */}
      <Step n={NYQUIST_STEP} step={step}>
        <rect x={specX(20000)} y={SPEC_TOP} width={specX(SPEC_TO) - specX(20000)} height={SPEC_BOTTOM - SPEC_TOP} fill={FAINT} opacity={0.35} />
        <line x1={SPEC_X} y1={SPEC_BOTTOM} x2={specX(SPEC_TO) + 10} y2={SPEC_BOTTOM} stroke={INK} strokeWidth={1.5} />
        <line x1={specX(nyquist)} y1={SPEC_TOP - 4} x2={specX(nyquist)} y2={SPEC_BOTTOM} stroke={MOVER} strokeWidth={1.5} strokeDasharray="5 4" />
        <Label at={[Math.min(specX(nyquist) + 6, specX(SPEC_TO) - 150), SPEC_BOTTOM + 24]}>{fmt(l.nyquistAt, { f: kHz(nyquist) })}</Label>
        <Label at={[SPEC_X, SPEC_BOTTOM + 24]} anchor="middle">0</Label>
        <Label at={[SPEC_X, SPEC_BOTTOM + 52]}>{l.harmonics}</Label>
        <Label at={[specX(SPEC_TO), SPEC_BOTTOM + 52]} anchor="end">{kHz(SPEC_TO)}</Label>
        {/* What came in, outlined; what the numbers hold, solid */}
        <rect x={specX(c.setup.tone) - 4} y={specY(arriveDb)} width={8} height={SPEC_BOTTOM - specY(arriveDb)} fill="none" stroke={INK} strokeWidth={1} strokeDasharray="3 2" />
        {c.components.map((s) => (
          <rect key={s.freq} x={specX(s.freq) - 3} y={specY(s.db)} width={6} height={Math.max(0, SPEC_BOTTOM - specY(s.db))} rx={1}
            fill={s.kind === 'tone' ? TRACE : CLIPPED} />
        ))}
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
const caption: CSSProperties = { fontSize: 12, color: 'var(--lsc-fg-muted)', whiteSpace: 'nowrap', marginRight: 2 }
const choice: CSSProperties = {
  height: 30, padding: '0 6px', borderRadius: 8, border: '1px solid var(--lsc-border)', background: 'transparent',
  color: 'var(--lsc-fg)', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
}

/** A setting's buttons, one a choice (the one in use lit, as the steps' shapes are); its name before them, if it needs one */
function Choices<T>({ name, shown = true, options, value, text, onPick }: {
  name: string; shown?: boolean; options: readonly T[]; value: T; text: (v: T) => string; onPick: (v: T) => void
}) {
  return (
    <div role="group" aria-label={name} style={group}>
      {shown && <span style={caption}>{name}</span>}
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

/** A named control and its value after it */
function Named({ name, text, children }: { name: string; text: string; children: ReactNode }) {
  return (
    <div style={{ ...group, gap: 8 }}>
      <span style={caption}>{name}</span>
      {children}
      <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', minWidth: '4.5em' }}>{text}</span>
    </div>
  )
}

const KNOB = 34

/**
 * The subject's controls, each from its step, in both rows: after the step's name the sample rate's and
 * bit depth's buttons (their units say what they are); in the second the gain knob first (the line
 * in's), the clock's buttons, the frequency's slider
 */
export function ConversionControls({ step, row }: { step: number; row: 1 | 2 }) {
  const s = useConversion()
  const { t, fmt } = useTranslation()
  const l = t.deepDive.labels
  const sampled = step >= SAMPLE_STEP
  if (row === 1) {
    return sampled ? (
      <div style={{ ...group, gap: 10 }}>
        <Choices name={l.sampleRate} shown={false} options={RATES} value={s.rate as (typeof RATES)[number]} text={(r) => rateText(t, r)} onPick={(rate) => s.set({ rate })} />
        <Choices name={l.bitDepth} shown={false} options={BIT_DEPTHS} value={s.bits as (typeof BIT_DEPTHS)[number]} text={(b) => bitsText(t, b)} onPick={(bits) => s.set({ bits })} />
      </div>
    ) : null
  }
  const gainText = `${s.gain > 0 ? '+' : s.gain < 0 ? '−' : '±'}${Math.abs(s.gain)} ${l.db}`
  const kHz = (k: number) => fmt(t.formats.rate, { n: String(k) })
  const gainMin = LEVEL_MIN - LEVEL_START, gainMax = LEVEL_MAX - LEVEL_START
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 26, rowGap: 6, minHeight: KNOB }}>
      <Named name={l.gain} text={gainText}>
        <svg width={KNOB} height={KNOB} style={{ flexShrink: 0, overflow: 'visible' }}>
          <SceneKnob
            cx={KNOB / 2} cy={KNOB / 2} r={KNOB / 2 - 1} color="var(--lsc-accent)"
            value={s.gain} min={gainMin} max={gainMax} round={(v) => Math.round(Math.min(gainMax, Math.max(gainMin, v)))}
            onChange={(gain) => s.set({ gain })} label={l.gain} valueText={gainText}
          />
        </svg>
      </Named>
      {sampled && (
        <Choices name={l.clock} options={[false, true] as const} value={s.wobbly} text={(w) => (w ? l.wobbly : l.steady)} onPick={(wobbly) => s.set({ wobbly })} />
      )}
      {step >= NYQUIST_STEP && (
        <Named name={l.frequency} text={kHz(s.tone / 1000)}>
          <input
            type="range" min={TONE_MIN / 1000} max={TONE_MAX / 1000} step={1} value={s.tone / 1000}
            aria-label={l.frequency} aria-valuetext={kHz(s.tone / 1000)}
            onChange={(e) => s.set({ tone: Number(e.target.value) * 1000 })} className="lsc-dd-slider" style={{ width: 220 }}
          />
        </Named>
      )}
    </div>
  )
}
