import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { formatDb, getHealth } from '../../signal/levels'
import type { SignalDomain } from '../../signal/levels'
import {
  ANALOG_TOP, FS_VOLTS, LEVEL_MAX, LEVEL_MIN, LEVEL_START, RECONSTRUCT_TAPS, TONE_MAX, TONE_MIN, TONE_START, WINDOW_S,
  bitsOf, codeOf, codeRange, conversionOf, floorOf, foldOf, samplesOf,
} from '../converter'
import type { Conversion, Rate, Setup } from '../converter'
import type { ShapeId } from '../subjects'
import { ARROW, ARROW_INK, FAINT, FLOW, INK, MOVER, PART, PART_3, TRACE } from './look'
import { put, usePainter } from './painter'
import type { Finder, Painter, SceneProps } from './painter'
import { Label, Step } from './sceneParts'
import { LevelMeter } from './circuitParts'
import { SceneKnob } from './SceneKnob'
import { useLatestRef } from '../../hooks/useLatestRef'

// A/D and D/A conversion (Deep dive, D46): a line-level sine into an A/D converter, the numbers along
// a digital wire, and out of a D/A converter — in one picture where height is voltage, as in Analogue
// amplification: full scale (0 dBFS) is a peak of +18 dBu, as the canvas aligns them, its dashed
// line running through all three graphs. Each graph is the same 0.5 ms.
// (1) Line level: an average of 0 dBu, its peaks far under the +18 dBu line, the analogue side's own
//     top (+20 dBu, where the canvas clips) above it.
// (2) The clock and the samples: the A/D converter, its clock above it ticking (44.1, 48 or 96 thousand
//     times a second); at each tick a sample — a dot on the wave. A wobbly clock takes them early or
//     late (drawn thousands of times bigger), and they are played back on time: off the wave.
// (3) Bit depth: each dot rounded to the nearest of its bit depth's steps (the error in red); the noise
//     under the numbers beside it — the bits' (6 dB a bit), the converter's own (a budget one's, a
//     good one's) — and how far the signal stands above it; one sample's number along the wire, as
//     its bits.
// (4) Back to voltage: the D/A converter holds each number until the next (the steps), its filter
//     smooths them (an ideal reconstruction) into the line out.
// (5) Nyquist: the tone's knob, the filter before the converter, the sines in the output up to 50 kHz
//     with half the sample rate marked. Past it, the filter takes the tone out; with no filter, it
//     comes back as a lower one, folded back (and moving the other way).
// (6) 0 dBFS, nothing above it: the level knob, the analogue side's meter and the numbers' — the same
//     signal hot in volts, clipping in numbers: its tops cut flat, new sines in the output.
// The phase is the tone's at the graphs' left edge. The numbers are converter.ts's.

// ── Where things are, in the scene's units ──────────────────────────────────
/** Height is voltage: the middle line is 0 V, full scale 220 px above and below it */
const CY = 330, PX_V = 220 / FS_VOLTS
const vy = (volts: number) => CY - PX_V * volts
const FS_TOP = vy(FS_VOLTS), FS_BOTTOM = vy(-FS_VOLTS), AN_TOP = vy(ANALOG_TOP), AN_BOTTOM = vy(-ANALOG_TOP)
/** Each graph's width: 0.5 ms */
const GRAPH_W = 360
/** 1 · the line coming in */
const IN_X = 60
/** 2 · the A/D converter: its box, its graph; the noise's meter beside it (0 … −150 dBFS, from full scale's line down) */
const ADC_L = 520, ADC_R = 1140, BOX_TOP = 30, BOX_BOTTOM = 640, ADC_X = 560
const NOISE_X = 960, NOISE_W = 16, PX_DB = (FS_BOTTOM - FS_TOP) / 150
/** The clock between the two converters, its wires into their tops */
const CLOCK_L = 1150, CLOCK_R = 1270, CLOCK_TOP = -60, CLOCK_BOTTOM = -10, CLOCK_WIRE_Y = -35
/** 3 · the digital wire; one sample's bits under it */
const WIRE_L = ADC_R, WIRE_R = 1280, WORD_X = 1205, WORD_TOP = CY + 20, BIT = 10, BIT_PITCH = 11
/** 4 · the D/A converter, its graph; the line out */
const DAC_L = 1280, DAC_R = 1720, DAC_X = 1320, OUT_END = 1780
/** 5 · the filter on the line in; the knobs under the line's graph; the sines in the output, under the D/A converter (0 … 50 kHz, 0 … −100 dBFS) */
const FILTER_L = 455, FILTER_R = 510
const KNOB_Y = BOX_BOTTOM + 85, KNOB_R = 34, TONE_X = 120, LEVEL_X = 270
const SPEC_X = DAC_X, SPEC_TOP = BOX_BOTTOM + 80, SPEC_BOTTOM = BOX_BOTTOM + 180, SPEC_TO = 50000
/** 6 · the two meters: the line's (dBu), the numbers' (dBFS) */
const METER_W = 14, METER_TOP = BOX_BOTTOM + 40, METER_H = 150, AN_METER_X = 360, DIG_METER_X = ADC_X

const LINE_STEP = 1, SAMPLE_STEP = 2, BITS_STEP = 3, DAC_STEP = 4, NYQUIST_STEP = 5, CLIP_STEP = 6
/** The most samples a graph shows (96 kHz: 48, and one at its right edge) */
const MAX_SAMPLES = 49
/** The sample whose number is shown along the wire (ringed in both graphs) */
const SHOWN = 12
/** Points a moving wave is drawn with */
const POINTS = 180

const RATE_OF: Partial<Record<ShapeId, Rate>> = { rate44: 44100, rate48: 48000, rate96: 96000 }
const BITS_OF: Partial<Record<ShapeId, number>> = { bits3: 3, bits4: 4, bits8: 8, bits16: 16, bits24: 24 }

interface Knobs { tone: number; level: number }

/** What the converter is set to at a step: what a later step adds stays at its start */
function setupAt(step: number, shapes: readonly ShapeId[], knobs: Knobs): Setup {
  return {
    rate: shapes.map((s) => RATE_OF[s]).find(Boolean) ?? 48000,
    jitter: shapes.includes('wobblyClock'),
    bits: step >= BITS_STEP ? shapes.map((s) => BITS_OF[s]).find(Boolean) ?? 3 : null,
    grade: shapes.includes('budgetConverter') ? 'budget' : 'quality',
    filter: !shapes.includes('noFilter'),
    tone: step >= NYQUIST_STEP ? knobs.tone : TONE_START,
    level: step >= CLIP_STEP ? knobs.level : LEVEL_START,
  }
}

/** One conversion kept: the picture and its painter ask for the same one, again and again */
let kept: { key: string; c: Conversion } | null = null
function conversionFor(setup: Setup): Conversion {
  const key = JSON.stringify(setup)
  if (kept?.key !== key) kept = { key, c: conversionOf(setup) }
  return kept.c
}

const timeX = (left: number) => (t: number) => left + (GRAPH_W * t) / WINDOW_S
const inX = timeX(IN_X), adcX = timeX(ADC_X), dacX = timeX(DAC_X)
const specX = (freq: number) => SPEC_X + (GRAPH_W * Math.min(freq, SPEC_TO)) / SPEC_TO
const specY = (db: number) => SPEC_TOP + Math.min(SPEC_BOTTOM - SPEC_TOP, Math.max(0, -db))
const noiseY = (db: number) => FS_TOP + PX_DB * Math.min(150, Math.max(0, -db))

/** A wave over a graph's 0.5 ms */
function wavePath(x: (t: number) => number, volts: (t: number) => number): string {
  let d = ''
  for (let i = 0; i <= POINTS; i++) {
    const t = (WINDOW_S * i) / POINTS
    d += `${i ? ' L' : 'M'}${x(t).toFixed(1)} ${vy(volts(t)).toFixed(1)}`
  }
  return d
}

const show = (el: SVGElement, on: boolean) => { el.style.display = on ? '' : 'none' }

/** A level in whole dB, with a real minus */
const minus = (db: number) => numberText(Math.round(db))

/** A whole number with thin spaces between its thousands, a real minus */
const numberText = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`

function makePainter(find: Finder, knobs: () => Knobs): Painter {
  const inTrace = find('inTrace'), received = find('received')
  const ticks = find.all('ticks'), stems = find.all('stems'), held = find.all('held'), errors = find.all('errors'), values = find.all('values')
  const dacDots = find.all('dacDots'), stairs = find('stairs'), output = find('output')
  const ringAdc = find('ringAdc'), ringDac = find('ringDac')
  const word = find.all('word'), code = find('code'), wire = find('wire')

  return (deg, step, shapes) => {
    const c = conversionFor(setupAt(step, shapes, knobs()))
    const { rate, bits } = c.setup
    inTrace.setAttribute('d', wavePath(inX, (t) => c.arriving(t, deg)))
    if (step < SAMPLE_STEP) return

    // The A/D converter: what reaches it, the clock's ticks, a sample at each
    received.setAttribute('d', wavePath(adcX, (t) => c.received(t, deg)))
    const last = Math.floor(WINDOW_S * rate + 1e-9)
    const first = -RECONSTRUCT_TAPS
    const samples = samplesOf(c, deg, first, last + RECONSTRUCT_TAPS)
    const rounded = step >= BITS_STEP
    const top = bits === null ? FS_VOLTS : codeRange(bits).top
    for (let n = 0; n < MAX_SAMPLES; n++) {
      const s = n <= last ? samples[n - first] : null
      const x = s ? adcX(s.at) : 0
      const on = !!s && x >= ADC_X - 0.5 && x <= ADC_X + GRAPH_W + 0.5
      for (const el of [ticks[n], stems[n], held[n], errors[n], values[n], dacDots[n]]) show(el, on)
      if (!s || !on) continue
      const hy = vy(s.held), qy = vy(s.value)
      put(ticks[n], 'x1', x); put(ticks[n], 'x2', x)
      put(stems[n], 'x1', x); put(stems[n], 'x2', x); put(stems[n], 'y2', rounded ? qy : hy)
      put(held[n], 'cx', x); put(held[n], 'cy', hy)
      // A sample stopped at full scale (or a few bits' top number) is red; rounded, the dot on the wave is hollow
      const stopped = c.clipped && Math.abs(s.held) >= 0.98 * (s.held > 0 ? top : FS_VOLTS)
      held[n].setAttribute('fill', stopped ? 'var(--signal-clipping)' : rounded ? 'none' : MOVER)
      show(errors[n], rounded); show(values[n], rounded)
      if (rounded) {
        put(errors[n], 'x1', x); put(errors[n], 'x2', x); put(errors[n], 'y1', hy); put(errors[n], 'y2', qy)
        put(values[n], 'cx', x); put(values[n], 'cy', qy)
        values[n].setAttribute('fill', stopped ? 'var(--signal-clipping)' : MOVER)
      }
      put(dacDots[n], 'cx', dacX(n / rate)); put(dacDots[n], 'cy', qy)
    }
    const shown = samples[SHOWN - first]
    put(ringAdc, 'cx', adcX(shown.at)); put(ringAdc, 'cy', vy(rounded ? shown.value : shown.held))
    if (step < BITS_STEP || bits === null) return

    // One sample's number along the wire, as its bits; the wire's dashes moving on
    const n = codeOf(shown.value, bits), on = bitsOf(n, bits)
    word.forEach((el, i) => {
      show(el, i < bits)
      if (i < bits) el.setAttribute('fill', on[i] ? MOVER : 'none')
    })
    code.textContent = numberText(n)
    wire.setAttribute('stroke-dashoffset', (-deg / 2).toFixed(1))
    if (step < DAC_STEP) return

    // The D/A converter: each number held until the next, and smoothed
    let d = ''
    for (let i = 0; i <= last; i++) {
      const y = vy(samples[i - first].value).toFixed(1), to = Math.min(dacX((i + 1) / rate), DAC_X + GRAPH_W).toFixed(1)
      d += i ? ` V${y} H${to}` : `M${DAC_X} ${y} H${to}`
    }
    stairs.setAttribute('d', d)
    output.setAttribute('d', wavePath(dacX, (t) => c.output(t, samples, first)))
    put(ringDac, 'cx', dacX(SHOWN / rate)); put(ringDac, 'cy', vy(shown.value))
  }
}

const THIN = { fill: 'none', stroke: INK, strokeWidth: 1.5 } as const
const FULL_SCALE = { stroke: 'var(--signal-clipping)', strokeWidth: 1.5, strokeDasharray: '8 6' } as const
const BOX = { rx: 10, fill: 'var(--lsc-sunken)', stroke: PART, strokeWidth: 2 } as const

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

/** As many of an element as a graph can have samples (the painter places and hides them) */
function Many({ name, children }: { name: string; children: (key: number) => ReactElement }) {
  return <g data-p={name}>{Array.from({ length: MAX_SAMPLES }, (_, i) => children(i))}</g>
}

/** A level's health as the canvas judges it, and the colour its word is written in */
function healthOf(rms: number, peak: number, domain: SignalDomain) {
  const health = getHealth(rms, domain, peak)
  return { health, colour: `var(--signal-${health}-text)` }
}

export function ConversionScene({ step, shapes, onPainter }: SceneProps) {
  const root = useRef<SVGGElement>(null)
  const [tone, setTone] = useState(TONE_START)
  const [level, setLevel] = useState(LEVEL_START)
  const knobsNow = useLatestRef({ tone, level })
  // The painter reads the knobs; a turn while the phase stands still paints the picture again where it was
  const painter = useRef<Painter | null>(null)
  const last = useRef<[number, number, readonly ShapeId[]]>([0, 1, []])
  const make = useCallback((find: Finder): Painter => {
    const paint = makePainter(find, () => knobsNow.current)
    painter.current = paint
    return (deg, s, picked) => {
      last.current = [deg, s, picked]
      paint(deg, s, picked)
    }
  }, [knobsNow])
  usePainter(root, onPainter, make)
  useEffect(() => { painter.current?.(...last.current) }, [tone, level])
  const { t, fmt } = useTranslation()
  const l = t.deepDive.labels

  const c = conversionFor(setupAt(step, shapes, { tone, level }))
  const { rate, bits, grade, filter, jitter } = c.setup
  const kHz = (hz: number) => fmt(t.formats.rate, { n: String(Math.round(hz / 10) / 100) })
  const floor = bits === null ? null : floorOf(bits, grade)
  /** The noise meter's two marks: the upper one's words above its line, the lower one's under it */
  const marks = floor ? [
    { db: floor.bits, text: fmt(l.bitsFloor, { bits: fmt(t.formats.bits, { n: String(bits) }), db: minus(floor.bits) }) },
    { db: floor.own, text: fmt(l.ownNoise, { db: minus(floor.own) }) },
  ].sort((a, b) => b.db - a.db) : []
  const analog = healthOf(c.analog.rms, c.analog.peak, 'analog')
  const digital = healthOf(c.digital.rms, c.digital.peak, 'digital')
  const toneText = kHz(tone), levelText = formatDb(level)
  const nyquist = rate / 2
  const folded = !filter && c.setup.tone > nyquist
  const arriveDb = 20 * Math.log10(c.amplitude / FS_VOLTS)

  return (
    <g ref={root}>
      {/* 1 · Line level: the line's graph, full scale's line and the analogue side's top over it */}
      <Step n={LINE_STEP} step={step}>
        <Label at={[IN_X + 8, AN_TOP - 22]}>{l.lineLevel}</Label>
        <Axes x={IN_X} />
        <line x1={IN_X} y1={AN_TOP} x2={IN_X + GRAPH_W} y2={AN_TOP} stroke="var(--signal-clipping)" strokeWidth={1.5} />
        <line x1={IN_X} y1={AN_BOTTOM} x2={IN_X + GRAPH_W} y2={AN_BOTTOM} stroke="var(--signal-clipping)" strokeWidth={1.5} />
        <FullScale from={IN_X} to={IN_X + GRAPH_W} />
        <Label at={[IN_X - 8, AN_TOP + 5]} anchor="end">+20 dBu</Label>
        <Label at={[IN_X - 8, FS_TOP + 5]} anchor="end">+18 dBu</Label>
        <Label at={[IN_X - 8, CY + 5]} anchor="end">{l.zeroV}</Label>
        <path data-p="inTrace" fill="none" stroke={TRACE} strokeWidth={3} strokeLinejoin="round" />
      </Step>

      {/* 2 · The A/D converter: its clock ticking above it, a sample at each tick */}
      <Step n={SAMPLE_STEP} step={step}>
        <line x1={IN_X + GRAPH_W + 20} y1={CY} x2={ADC_L} y2={CY} stroke={INK} strokeWidth={2} />
        <rect x={ADC_L} y={BOX_TOP} width={ADC_R - ADC_L} height={BOX_BOTTOM - BOX_TOP} {...BOX} />
        <Label at={[(ADC_L + ADC_R) / 2, BOX_BOTTOM + 26]} anchor="middle">{l.adc}</Label>
        <FullScale from={IN_X + GRAPH_W} to={ADC_X + GRAPH_W} />
        <Label at={[ADC_X + 6, FS_TOP - 8]}>{l.fullScale}</Label>
        <Axes x={ADC_X} />
        <path data-p="received" fill="none" stroke={TRACE} strokeWidth={2} strokeDasharray="5 4" opacity={0.6} />
        <Many name="ticks">{(k) => <line key={k} y1={FS_TOP} y2={FS_BOTTOM} stroke={MOVER} strokeWidth={1} opacity={0.35} />}</Many>
        <Many name="stems">{(k) => <line key={k} y1={CY} stroke={MOVER} strokeWidth={1.5} />}</Many>
        <Many name="errors">{(k) => <line key={k} stroke="var(--signal-clipping)" strokeWidth={2.5} />}</Many>
        <Many name="held">{(k) => <circle key={k} r={4.5} fill={MOVER} stroke={MOVER} strokeWidth={1.5} />}</Many>
        <Many name="values">{(k) => <circle key={k} r={4.5} fill={MOVER} />}</Many>
        <circle data-p="ringAdc" r={9} fill="none" stroke={INK} strokeWidth={1.5} style={bits === null ? { display: 'none' } : undefined} />
        {jitter && <Label at={[ADC_X + 10, BOX_BOTTOM - 16]}>{l.wobbleBigger}</Label>}

        {/* The clock: its ticks, as many a second as the sample rate */}
        <Label at={[(CLOCK_L + CLOCK_R) / 2, CLOCK_TOP - 8]} anchor="middle">{l.clock}</Label>
        <rect x={CLOCK_L} y={CLOCK_TOP} width={CLOCK_R - CLOCK_L} height={CLOCK_BOTTOM - CLOCK_TOP} {...BOX} rx={8} />
        <path d={clockPath(jitter)} fill="none" stroke={MOVER} strokeWidth={2} />
        <Label at={[(CLOCK_L + CLOCK_R) / 2, BOX_TOP - 10]} anchor="middle">{fmt(l.timesASecond, { n: numberText(rate) })}</Label>
        <path d={`M${CLOCK_L} ${CLOCK_WIRE_Y} H${ADC_X + GRAPH_W / 2} V${BOX_TOP}`} fill="none" stroke={MOVER} strokeWidth={1.5} strokeDasharray="2 4" />
      </Step>

      {/* 3 · Bit depth: the noise under the numbers; one sample's number along the wire */}
      <Step n={BITS_STEP} step={step}>
        <rect x={NOISE_X} y={FS_TOP} width={NOISE_W} height={FS_BOTTOM - FS_TOP} fill={FAINT} opacity={0.5} />
        {floor && (
          <>
            <rect x={NOISE_X} y={noiseY(floor.total)} width={NOISE_W} height={FS_BOTTOM - noiseY(floor.total)} fill={PART_3} />
            {marks.map((m, i) => (
              <g key={i}>
                <line x1={NOISE_X - 4} y1={noiseY(m.db)} x2={NOISE_X + NOISE_W + 4} y2={noiseY(m.db)} stroke={INK} strokeWidth={1.5} />
                <Label at={[NOISE_X + NOISE_W + 10, noiseY(m.db) + (i === 0 ? -5 : 17)]}>{m.text}</Label>
              </g>
            ))}
            {/* The signal, and how far above the noise it stands */}
            <line x1={NOISE_X - 6} y1={noiseY(c.digital.rms)} x2={NOISE_X + NOISE_W + 6} y2={noiseY(c.digital.rms)} stroke={TRACE} strokeWidth={3} />
            <path d={`M${NOISE_X - 12} ${noiseY(c.digital.rms)} V${noiseY(floor.total)}`} fill="none" stroke={TRACE} strokeWidth={1.5} markerStart={ARROW_INK} markerEnd={ARROW_INK} />
            <text className="lsc-dd-reading" x={NOISE_X + NOISE_W / 2} y={FS_BOTTOM + 24} textAnchor="middle">
              {fmt(l.dbAbove, { db: String(Math.max(0, Math.round(c.digital.rms - floor.total))) })}
            </text>
            <Label at={[NOISE_X + NOISE_W / 2, FS_BOTTOM + 44]} anchor="middle">{l.aboveNoise}</Label>
          </>
        )}
        <Label at={[NOISE_X + NOISE_W + 10, FS_TOP + 5]}>0 dBFS</Label>
        <line data-p="wire" x1={WIRE_L} y1={CY} x2={WIRE_R} y2={CY} stroke={MOVER} strokeWidth={3} strokeDasharray="12 5 4 5" />
        <text data-p="code" className="lsc-dd-reading" x={(WIRE_L + WIRE_R) / 2} y={CY - 14} textAnchor="middle" />
        <g data-p="word">
          {Array.from({ length: 24 }, (_, i) => (
            <rect key={i} x={WORD_X} y={WORD_TOP + i * BIT_PITCH} width={BIT} height={BIT} rx={1.5} stroke={MOVER} strokeWidth={1} fill="none" />
          ))}
        </g>
      </Step>

      {/* 4 · Back to voltage: each number held until the next, smoothed into the line out */}
      <Step n={DAC_STEP} step={step}>
        <path d={`M${CLOCK_R} ${CLOCK_WIRE_Y} H${DAC_X + GRAPH_W / 2} V${BOX_TOP}`} fill="none" stroke={MOVER} strokeWidth={1.5} strokeDasharray="2 4" />
        <rect x={DAC_L} y={BOX_TOP} width={DAC_R - DAC_L} height={BOX_BOTTOM - BOX_TOP} {...BOX} />
        <Label at={[(DAC_L + DAC_R) / 2, BOX_BOTTOM + 26]} anchor="middle">{l.dac}</Label>
        <FullScale from={WIRE_R} to={DAC_X + GRAPH_W} />
        <Axes x={DAC_X} />
        <path data-p="stairs" fill="none" stroke={MOVER} strokeWidth={1.5} opacity={0.8} />
        <Many name="dacDots">{(k) => <circle key={k} r={3.5} fill={MOVER} />}</Many>
        <path data-p="output" fill="none" stroke={TRACE} strokeWidth={3} strokeLinejoin="round" />
        <circle data-p="ringDac" r={9} fill="none" stroke={INK} strokeWidth={1.5} />
        <line x1={DAC_R} y1={CY} x2={OUT_END} y2={CY} stroke={INK} strokeWidth={2} markerEnd={ARROW_INK} />
        <Label at={[OUT_END + 8, CY + 5]}>{l.lineOutReading}</Label>
      </Step>

      {/* 5 · Nyquist: the tone's knob, the filter before the converter, the sines in the output */}
      <Step n={NYQUIST_STEP} step={step}>
        {filter && (
          <g>
            <rect x={FILTER_L} y={CY - 26} width={FILTER_R - FILTER_L} height={52} {...BOX} rx={6} />
            <path d={`M${FILTER_L + 8} ${CY - 6} H${FILTER_L + 30} Q${FILTER_L + 38} ${CY - 6} ${FILTER_L + 42} ${CY + 14}`} {...THIN} />
            <Label at={[(FILTER_L + FILTER_R) / 2, CY - 34]} anchor="middle">{l.filter}</Label>
          </g>
        )}
        <SceneKnob
          cx={TONE_X} cy={KNOB_Y} r={KNOB_R} color="var(--lsc-accent)"
          value={tone / 1000} min={TONE_MIN / 1000} max={TONE_MAX / 1000} round={(v) => Math.round(Math.min(TONE_MAX / 1000, Math.max(TONE_MIN / 1000, v)))}
          onChange={(v) => setTone(v * 1000)} label={l.tone} valueText={toneText} drag={300}
        />
        <Label at={[TONE_X, KNOB_Y + KNOB_R + 24]} anchor="middle">{l.tone}</Label>
        <Label at={[TONE_X, KNOB_Y + KNOB_R + 44]} anchor="middle">{toneText}</Label>

        {/* Above hearing, shaded; half the sample rate, dashed */}
        <rect x={specX(20000)} y={SPEC_TOP} width={specX(SPEC_TO) - specX(20000)} height={SPEC_BOTTOM - SPEC_TOP} fill={FAINT} opacity={0.35} />
        <line x1={SPEC_X} y1={SPEC_BOTTOM} x2={specX(SPEC_TO) + 10} y2={SPEC_BOTTOM} stroke={INK} strokeWidth={1.5} />
        <line x1={specX(nyquist)} y1={SPEC_TOP - 4} x2={specX(nyquist)} y2={SPEC_BOTTOM} stroke={MOVER} strokeWidth={1.5} strokeDasharray="5 4" />
        <Label at={[specX(nyquist) + 6, SPEC_BOTTOM + 20]}>{fmt(l.nyquistAt, { f: kHz(nyquist) })}</Label>
        <Label at={[SPEC_X, SPEC_BOTTOM + 20]} anchor="middle">0</Label>
        <Label at={[SPEC_X, SPEC_BOTTOM + 42]}>{l.harmonics}</Label>
        <Label at={[specX(SPEC_TO), SPEC_BOTTOM + 42]} anchor="end">{kHz(SPEC_TO)}</Label>
        {/* What came in, outlined; what the numbers hold, solid */}
        <rect x={specX(c.setup.tone) - 4} y={specY(arriveDb)} width={8} height={SPEC_BOTTOM - specY(arriveDb)} fill="none" stroke={INK} strokeWidth={1} strokeDasharray="3 2" />
        {c.components.map((s) => (
          <rect key={s.freq} x={specX(s.freq) - 3} y={specY(s.db)} width={6} height={Math.max(0, SPEC_BOTTOM - specY(s.db))} rx={1}
            fill={s.kind === 'tone' ? TRACE : 'var(--signal-clipping)'} />
        ))}
        {folded && (
          <path
            d={`M${specX(c.setup.tone)} ${specY(arriveDb) - 6} Q${specX(nyquist)} ${specY(arriveDb) - 40} ${specX(foldOf(c.setup.tone, rate))} ${specY(arriveDb) - 8}`}
            fill="none" stroke={FLOW} strokeWidth={2} markerEnd={ARROW}
          />
        )}
      </Step>

      {/* 6 · 0 dBFS, nothing above it: the level knob; the same signal on the analogue side's meter and in numbers */}
      <Step n={CLIP_STEP} step={step}>
        <SceneKnob
          cx={LEVEL_X} cy={KNOB_Y} r={KNOB_R} color="var(--lsc-accent)"
          value={level} min={LEVEL_MIN} max={LEVEL_MAX} round={(v) => Math.round(Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, v)))}
          onChange={setLevel} label={l.level} valueText={levelText}
        />
        <Label at={[LEVEL_X, KNOB_Y + KNOB_R + 24]} anchor="middle">{l.level}</Label>
        <Label at={[LEVEL_X, KNOB_Y + KNOB_R + 44]} anchor="middle">{levelText}</Label>
        <LevelMeter x={AN_METER_X} y={METER_TOP} w={METER_W} h={METER_H} rms={c.analog.rms} peak={c.analog.peak} />
        <text className="lsc-dd-reading" x={AN_METER_X + METER_W + 12} y={METER_TOP + 16}>{fmt(l.peak, { db: formatDb(c.analog.peak) })}</text>
        <text className="lsc-dd-reading" x={AN_METER_X + METER_W + 12} y={METER_TOP + 40} style={{ fill: analog.colour }}>{t.health[analog.health]}</text>
        <LevelMeter x={DIG_METER_X} y={METER_TOP} w={METER_W} h={METER_H} rms={c.digital.rms} peak={c.digital.peak} domain="digital" />
        <text className="lsc-dd-reading" x={DIG_METER_X + METER_W + 12} y={METER_TOP + 16}>{fmt(l.peak, { db: formatDb(c.digital.peak, 'digital') })}</text>
        <text className="lsc-dd-reading" x={DIG_METER_X + METER_W + 12} y={METER_TOP + 40} style={{ fill: digital.colour }}>{t.health[digital.health]}</text>
      </Step>
    </g>
  )
}

/** The clock's square wave in its box: steady, or each tick early or late as the samples are */
function clockPath(wobbly: boolean): string {
  const from = CLOCK_L + 10, to = CLOCK_R - 10, ticks = 8, w = (to - from) / ticks, hi = CLOCK_TOP + 12, lo = CLOCK_BOTTOM - 12
  let d = `M${from} ${lo}`
  for (let i = 0; i < ticks; i++) {
    const shift = wobbly ? [0.3, -0.25, 0.15, -0.3, 0.2, -0.1, 0.25, -0.2][i] * w : 0
    const up = from + i * w + shift, down = up + w / 2
    d += ` H${up.toFixed(1)} V${hi} H${down.toFixed(1)} V${lo}`
  }
  return `${d} H${to}`
}
