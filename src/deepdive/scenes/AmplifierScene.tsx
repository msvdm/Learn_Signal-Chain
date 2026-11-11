import { useMemo, useRef } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { GAIN, GAIN_DB, IN_PEAK, OUT_PEAK, PEAK_CURRENT, RESTING, SAMPLES, SWING_MAX, VBE, ampCycle, at, classOf, distortionOf, harmonicsOf, meanCurrents, powersOf } from '../amp'
import type { AmpClass, AmpCycle, Distortion } from '../amp'
import { K, SWING, clamp, curvePath, rad, scatter } from '../wave'
import type { ShapeId } from '../subjects'
import { ARROW, FAINT, FLOW, INK, MOVER, PART, PART_2, PART_3, TRACE } from './look'
import { put, usePainter } from './painter'
import type { Finder, Painter, SceneProps } from './painter'
import { Air, Label, Leader, Step } from './sceneParts'

// Analogue amplification (Deep dive, D46): the microphone's ±2 mV, too weak to move a speaker (1);
// a power supply's ±12 V, steady, waiting (2); a transistor between the + side and the speaker —
// a small current at its base lets a big one through, but one way only: the top half (3); then two,
// one pushing from +, one pulling to −, in class A (both always open, 4), B (each its half: a notch
// at zero, 5) and AB (both a little open, 6) — the same drawing, only the resting current changes;
// last, the amplifier pushed: the shapes it can give and the harmonics they add (7). The charges
// move along the wires as the currents say, the heat sinks give off what the transistors lose, and
// the power's bars say where the supply's energy goes. The phase is the microphone's voltage, as in
// Magnetic induction: at 0° it is +2 mV, and the speaker +10 V. The numbers are amp.ts's.

// ── Where things are, in the scene's units ──────────────────────────────────
/** The power supply's box; its + terminal (the + side runs right from it), its 0 V terminal; the − side runs down from its bottom */
const PSU_X = -80, PSU_Y = 30, PSU_W = 280, PSU_H = 120
const PLUS_Y = 70, ZERO_Y = 112, MINUS_X = -30, MINUS_Y = 760
/** The transistors' column: where the current runs; each transistor's middle; the output, between them */
const COL_X = 652, Q1_Y = 300, Q2_Y = 540, Q_R = 34, NODE_Y = 420
/** Where the sides end while there is no transistor yet */
const PLUS_END = 230, MINUS_END = 610
/** The bases' bar, and the line driving them */
const BAR_X = 626, DRIVE_X = 560
/** The microphone's graph: its frame, its graph's left edge and width, middle line and half height (2 mV) */
const IN_X = 46, IN_SCOPE_X = 66, SCOPE_W = 290, IN_Y = 420, IN_H = 55
/** The voltage gain's triangle: its base, its tip, half its height */
const TRI_X = 410, TRI_TIP = 480, TRI_HALF = 30
/** The resting current's box, between the two bases */
const BIAS_TOP = 380, BIAS_BOTTOM = 460
/** The speaker's graph: its frame, its graph's left edge, middle line, and how far 12 V reaches */
const OUT_X = 830, OUT_SCOPE_X = 850, OUT_Y = 200, PX_PER_V = 66 / 12
/** The zoom on class B's notch: its frame, the phases it shows (90° ± ZOOM_DEG), 10 times larger both ways */
const ZOOM_X = 1180, ZOOM_W = 160, ZOOM_DEG = 8.7
const ZOOM_PX_PER_DEG = (10 * SCOPE_W) / 360, ZOOM_PX_PER_V = 10 * PX_PER_V
/** The speaker: where its magnet's back stands, its middle, its leads (the coil's), where its air starts */
const SPK_X = 1000, SPK_Y = 430, LEAD_A = 1063.8, LEAD_B = 1072.6, AIR_X = 1182, LOUDER = 1.8
/** The speaker's wires: the signal's, coming over its top; the return's, down to 0 V */
const WIRE_UP_X = 930, WIRE_TOP = 350, RETURN_TOP = 372, RETURN_X = 950, GROUND_Y = 560
/** The heat sinks, right of each transistor */
const SINK_X = 686, SINK_W = 60, SINK_H = 76
/** The power's bars and the harmonics' panel, under the picture */
const POWER_X = 40, POWER_Y = 818, BAR0 = 230, PX_PER_W = 18
const HARM_X = 830, HARM_Y = 818, HARM_BOTTOM = 950, HARM_H = 100, HARM_STEP = 44, HARM_W = 26
/** The caption saying what a step's class does, right of the column */
const NOTE_X = 700, NOTE_Y = 664

/** The steps of the classes, and the shapes' */
const A_STEP = 4, B_STEP = 5, AB_STEP = 6, SHAPE_STEP = 7

/** The charges on the wires, every DOT_GAP; how far a coulomb-ish of charge moves them (spacings a cycle, per ampere on average) */
const DOT_GAP = 26, GAPS_PER_AMP = 8, SPEAKER_TO_AND_FRO = 32

type Pt = readonly [number, number]
/** The wires the charges move on: from the + side through the upper transistor to the output; from the output through the lower one to the − side; from the output to the speaker */
const UPPER_WIRE: readonly Pt[] = [[PSU_X + PSU_W, PLUS_Y], [COL_X, PLUS_Y], [COL_X, NODE_Y]]
const LOWER_WIRE: readonly Pt[] = [[COL_X, NODE_Y], [COL_X, MINUS_Y], [MINUS_X, MINUS_Y], [MINUS_X, PSU_Y + PSU_H]]
const SPEAKER_WIRE: readonly Pt[] = [[COL_X, NODE_Y], [WIRE_UP_X, NODE_Y], [WIRE_UP_X, WIRE_TOP], [LEAD_B, WIRE_TOP], [LEAD_B, SPK_Y]]

const lengthOf = (wire: readonly Pt[]) => wire.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - wire[i][0], p[1] - wire[i][1]), 0)
/** The point `s` along a wire */
function pointAlong(wire: readonly Pt[], s: number): Pt {
  for (let i = 1; i < wire.length; i++) {
    const [x0, y0] = wire[i - 1], [x1, y1] = wire[i], seg = Math.hypot(x1 - x0, y1 - y0)
    if (s <= seg) return [x0 + ((x1 - x0) * s) / seg, y0 + ((y1 - y0) * s) / seg]
    s -= seg
  }
  return wire[wire.length - 1]
}

const UPPER_LEN = lengthOf(UPPER_WIRE), LOWER_LEN = lengthOf(LOWER_WIRE), SPEAKER_LEN = lengthOf(SPEAKER_WIRE)
/** Before the transistors come, only the sides' part of their wires is drawn */
const UPPER_SIDE = COL_X - (PSU_X + PSU_W) + (PLUS_END - PLUS_Y)
const LOWER_SIDE_FROM = MINUS_END - NODE_Y

const AIR_DOTS = scatter(29, 380, { x: AIR_X, y: 300, w: 156, h: 262 })

const inX  = (deg: number) => IN_SCOPE_X + (SCOPE_W * deg) / 360
const inY  = (deg: number) => IN_Y - IN_H * Math.cos(rad(deg))
const outX = (deg: number) => OUT_SCOPE_X + (SCOPE_W * deg) / 360
const outY = (volts: number) => OUT_Y - PX_PER_V * volts
const zoomX = (deg: number) => ZOOM_X + ZOOM_W / 2 + (deg - 90) * ZOOM_PX_PER_DEG
const zoomY = (volts: number) => OUT_Y - ZOOM_PX_PER_V * volts

/** Is this shape one of the last step's? (the type is every subject's shapes) */
const DISTORTIONS: readonly Distortion[] = ['clean', 'rounded', 'oneSided', 'flat', 'notch']
const distortionOfShape = (shape: ShapeId | undefined): Distortion =>
  DISTORTIONS.includes(shape as Distortion) ? (shape as Distortion) : 'clean'

/** The amplifier a step shows: none before the transistor; the shape picked at the last */
function cycleAt(step: number, shape: ShapeId | undefined): AmpCycle | null {
  if (step < 3) return null
  const cls: AmpClass = step === 3 ? 'one' : step === A_STEP ? 'a' : step === B_STEP ? 'b' : step === AB_STEP ? 'ab' : classOf(distortionOfShape(shape))
  return ampCycle(cls, step >= SHAPE_STEP ? distortionOfShape(shape) : 'clean')
}

/** A reading's sign and digits (none shows as +0.0, never −0.0) */
function signed(value: number, digits: number): string {
  const shown = value.toFixed(digits)
  return Number(shown) < 0 ? `−${shown.slice(1)}` : `+${Number(shown) === 0 ? (0).toFixed(digits) : shown}`
}

/** A table over one cycle as a graph, up to `to` degrees */
const tracePath = (table: Float64Array, to: number) => curvePath(to, outX, (deg) => outY(at(table, deg)))

/** The parts of the output graph where the tops are cut off (the wanted voltage past the sides), up to `to` degrees */
function clippedPath(c: AmpCycle, to: number): string {
  let path = '', drawing = false
  for (let i = 0; i <= Math.min(SAMPLES, Math.round(to * 2)); i++) {
    if (Math.abs(c.wanted[i]) > SWING_MAX + 1e-9) {
      path += `${drawing ? ' L' : ' M'}${outX(i / 2).toFixed(1)} ${outY(c.out[i]).toFixed(1)}`
      drawing = true
    } else drawing = false
  }
  return path
}

/** Spacings the charges move along a transistor's wire in a cycle: as many as its average current says, at least one */
const gapsFor = (mean: number) => (mean > 1e-9 ? Math.max(1, Math.round(mean * GAPS_PER_AMP)) : 0)

/**
 * The heat waves' squiggle, a wave longer than the room it rises in at both ends: lifted by up to
 * one wave (two a cycle), it always fills that room
 */
const HEAT_WAVE = 24, HEAT_RISE = 70
const squiggle = (() => {
  let d = ''
  for (let y = -HEAT_WAVE; y <= HEAT_RISE + HEAT_WAVE; y += 3) d += `${d ? ' L' : 'M'}${(3 * Math.sin((y / HEAT_WAVE) * 2 * Math.PI)).toFixed(1)} ${-y}`
  return d
})()
/** The heat waves' places along a sink */
const HEAT_XS = [14, 30, 46]
/** The most heat a transistor gives at one moment here (class A near 0 V: about 7.6 W) */
const HEAT_FULL = 8

/** Each cycle's average currents, worked out once (the painter asks on every picture) */
const means = new WeakMap<AmpCycle, { upper: number; lower: number }>()
function meansOf(c: AmpCycle) {
  let m = means.get(c)
  if (!m) means.set(c, (m = meanCurrents(c)))
  return m
}

function makePainter(find: Finder): Painter {
  const air = find.dots('air', AIR_DOTS).map((el, i) => ({ el, x: AIR_DOTS[i].x }))
  for (const { el } of air) el.setAttribute('fill', INK)
  const inTrace = find('inTrace'), inDot = find('inDot'), inReading = find('inReading')
  const outTrace = find('outTrace'), outDot = find('outDot'), outReading = find('outReading'), clipTrace = find('clipTrace')
  const zoomDot = find('zoomDot')
  const cone = find('cone'), cap = find('cap'), coil = find.all('coil')
  const q1 = find('q1Fill'), q2 = find('q2Fill')
  const heat1 = find.all('heat1'), heat2 = find.all('heat2')
  const wires = ([['upperDots', UPPER_WIRE, UPPER_LEN], ['lowerDots', LOWER_WIRE, LOWER_LEN], ['speakerDots', SPEAKER_WIRE, SPEAKER_LEN]] as const)
    .map(([name, wire, len]) => ({ wire, len, dots: find.all<SVGCircleElement>(name) }))
  const f = (n: number) => n.toFixed(1)

  /** Puts a wire's charges `moved` along it; `shown`: whether the point `s` along it is drawn yet */
  function place(i: number, moved: number, shown: (s: number) => boolean) {
    const { wire, len, dots } = wires[i]
    dots.forEach((dot, j) => {
      const s = (((j * DOT_GAP + moved) % len) + len) % len
      const [x, y] = pointAlong(wire, s)
      put(dot, 'cx', x); put(dot, 'cy', y)
      dot.style.display = shown(s) ? '' : 'none'
    })
  }

  return (deg, step, shape) => {
    const r = rad(deg)
    const c = cycleAt(step, shape)

    // 1 · the microphone's voltage
    inTrace.setAttribute('d', curvePath(Math.round(deg), inX, inY))
    put(inDot, 'cx', inX(deg)); put(inDot, 'cy', inY(deg))
    inReading.textContent = signed(IN_PEAK * 1000 * Math.cos(r), 2)

    // The speaker: straight from the microphone it hardly moves (2 mV of 10 V's push); then the amplifier's output
    const volts = (d: number) => (c ? at(c.out, ((d % 360) + 360) % 360) : IN_PEAK * Math.cos(rad(d)))
    const push = (9 * volts(deg)) / OUT_PEAK
    cone.setAttribute('d',
      `M202 550 Q${f(196 + push / 2)} 548 ${f(194 + push)} 558 C${f(184 + push)} 590 ${f(150 + push)} 624 ${f(118 + push)} 644 ` +
      `Q${f(142 + push)} 660 ${f(118 + push)} 676 C${f(150 + push)} 696 ${f(184 + push)} 730 ${f(194 + push)} 762 Q${f(196 + push / 2)} 772 202 770`)
    cap.setAttribute('d', `M${f(118 + push)} 644 Q${f(142 + push)} 660 ${f(118 + push)} 676 Z`)
    coil.forEach((turn, i) => put(turn, 'cx', 96 + i * 4 + push))
    for (const p of air) {
      const later = deg - (K * (p.x - AIR_X) * 180) / Math.PI
      put(p.el, 'cx', clamp(p.x + (LOUDER * SWING * volts(later)) / OUT_PEAK, AIR_X - 2, AIR_X + 158))
    }

    // 2 · the sides' charges, waiting; from 3 on they move as the transistors' currents say
    if (step >= 2) {
      const mean = c ? meansOf(c) : { upper: 0, lower: 0 }
      place(0, c ? gapsFor(mean.upper) * DOT_GAP * at(c.upperMoved, deg) : 0, (s) => step >= 3 || s <= UPPER_SIDE)
      place(1, c ? gapsFor(mean.lower) * DOT_GAP * at(c.lowerMoved, deg) : 0, (s) => step >= A_STEP || s >= LOWER_SIDE_FROM)
    }

    if (!c) return
    // 3 · the transistors open as far as their currents, the speaker's current to and fro, the output's graph
    place(2, SPEAKER_TO_AND_FRO * at(c.speakerMoved, deg), () => true)
    q1.setAttribute('fill-opacity', (0.06 + (0.6 * at(c.upper, deg)) / PEAK_CURRENT).toFixed(3))
    q2.setAttribute('fill-opacity', (0.06 + (0.6 * at(c.lower, deg)) / PEAK_CURRENT).toFixed(3))
    const out = at(c.out, deg)
    outTrace.setAttribute('d', tracePath(c.out, Math.round(deg)))
    put(outDot, 'cx', outX(deg)); put(outDot, 'cy', outY(out))
    outReading.textContent = signed(out, 1)
    clipTrace.setAttribute('d', clippedPath(c, deg))

    // 4 · the heat each transistor gives, rising off its heat sink
    if (step >= A_STEP) {
      const rise = (((2 * deg) / 360) * HEAT_WAVE) % HEAT_WAVE
      const show = (waves: SVGElement[], y: number, watts: number) => waves.forEach((w, i) => {
        w.setAttribute('opacity', Math.min(1, 0.04 + watts / HEAT_FULL).toFixed(3))
        w.setAttribute('transform', `translate(${SINK_X + HEAT_XS[i]} ${f(y - SINK_H / 2 - 4 - rise)})`)
      })
      show(heat1, Q1_Y, at(c.upperHeat, deg))
      show(heat2, Q2_Y, at(c.lowerHeat, deg))
    }

    // 5 · the notch, ten times larger: the moment, while it is within the zoom
    const near = Math.abs(deg - 90) <= ZOOM_DEG
    zoomDot.style.display = near ? '' : 'none'
    if (near) { put(zoomDot, 'cx', zoomX(deg)); put(zoomDot, 'cy', zoomY(out)) }
  }
}

export function AmplifierScene({ step, shape, onPainter }: SceneProps) {
  const root = useRef<SVGGElement>(null)
  usePainter(root, onPainter, makePainter)
  const { t, fmt } = useTranslation()
  const l = t.deepDive.labels
  const c = cycleAt(step, shape)
  const distortion = distortionOfShape(shape)
  const showZoom = step === B_STEP || (step >= SHAPE_STEP && distortion === 'notch')

  // What the step's amplifier gives: its graph over the cycle, its power, its harmonics
  const ghost = useMemo(() => (c ? tracePath(c.out, 360) : ''), [c])
  const wanted = useMemo(() => (c && step >= SHAPE_STEP ? tracePath(c.wanted, 360) : ''), [c, step])
  const power = c ? powersOf(c) : null
  const harmonics = useMemo(() => (c ? harmonicsOf(c.out) : []), [c])
  const zoomCurve = useMemo(() => {
    const b = ampCycle('b')
    let d = ''
    for (let deg = 90 - ZOOM_DEG; deg <= 90 + ZOOM_DEG + 1e-9; deg += 0.25) d += `${d ? ' L' : 'M'}${zoomX(deg).toFixed(1)} ${zoomY(at(b.out, deg)).toFixed(1)}`
    return d
  }, [])

  const watts = (w: number) => fmt(l.watts, { w: w.toFixed(1) })
  const resting = c ? RESTING[c.cls] : 0
  // Each bar its own number, rounded (class B: 9.2 = 6.1 + 3.2, a tenth lost to the rounding)
  const bars = power ? [
    { name: l.fromSupply, w: power.supply, colour: PART },
    { name: l.intoSpeaker, w: power.speaker, colour: TRACE },
    { name: l.heat, w: power.heat, colour: FLOW },
  ] : []
  const note =
    step === 3 ? l.oneWay
    : step === A_STEP ? l.classA
    : step === B_STEP ? l.classB
    : step === AB_STEP ? l.classAB
    : null
  const shapeNote: Record<Distortion, string> = {
    clean: l.cleanCopy, rounded: l.roundedTops, oneSided: l.oneSide,
    flat: fmt(l.flatTops, { v: `${SWING_MAX} ${l.volts}` }), notch: l.notchAtZero,
  }

  return (
    <g ref={root}>
      {/* 1 · the microphone's voltage, wired straight to a speaker */}
      <Step n={1} step={step}>
        <rect x={IN_X} y={IN_Y - 78} width={330} height={156} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
        <g stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4">
          {[90, 180, 270].map((deg) => <line key={deg} x1={inX(deg)} y1={IN_Y - 70} x2={inX(deg)} y2={IN_Y + 70} />)}
          <line x1={IN_X + 10} y1={IN_Y - IN_H} x2={IN_X + 320} y2={IN_Y - IN_H} />
          <line x1={IN_X + 10} y1={IN_Y + IN_H} x2={IN_X + 320} y2={IN_Y + IN_H} />
        </g>
        <line x1={IN_X + 10} y1={IN_Y} x2={IN_X + 320} y2={IN_Y} stroke={PART} strokeWidth={0.75} />
        <Label at={[IN_X + 12, IN_Y - 61]}>{l.fromMicrophone}</Label>
        <path d={curvePath(360, inX, inY)} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
        <path data-p="inTrace" fill="none" stroke={TRACE} strokeWidth={3} strokeLinecap="round" />
        <circle data-p="inDot" r={6} fill={MOVER} />
        <Label at={[IN_X - 6, IN_Y - IN_H + 4]} anchor="end">+2 {l.mv}</Label>
        <Label at={[IN_X - 6, IN_Y + 4]} anchor="end">0</Label>
        <Label at={[IN_X - 6, IN_Y + IN_H + 4]} anchor="end">−2 {l.mv}</Label>
        <text className="lsc-dd-reading" x={IN_X} y={IN_Y + 100}>
          {l.fromMicrophone}: <tspan data-p="inReading">+2.00</tspan> {l.mv}
        </text>

        {/* Its wire into the speaker: straight at first, through the amplifier once it comes */}
        <Step n={1} until={2} step={step}>
          <line x1={IN_X + 330} y1={IN_Y} x2={COL_X} y2={NODE_Y} stroke={INK} strokeWidth={1.5} />
          <Label at={[1090, 612]} anchor="middle">{l.tooWeak}</Label>
        </Step>
        <path d={`M${COL_X} ${NODE_Y} H${WIRE_UP_X} V${WIRE_TOP} H${LEAD_B} V${SPK_Y}`} fill="none" stroke={INK} strokeWidth={1.5} />
        <path d={`M${LEAD_A} ${SPK_Y} V${RETURN_TOP} H${RETURN_X} V${GROUND_Y}`} fill="none" stroke={INK} strokeWidth={1.5} />
        <Ground x={RETURN_X} y={GROUND_Y} />
        <Label at={[RETURN_X + 22, GROUND_Y + 12]}>{l.zeroV}</Label>
        <Speaker />
        <Air id="lsc-dd-air-amp" x={AIR_X} y={300} w={156} h={262} r={70} />
        <g data-p="air" mask="url(#lsc-dd-air-amp)" />
        <Label at={[AIR_X + 60, 584]} anchor="middle" flow>{l.soundWave}</Label>
        <line x1={AIR_X + 114} y1={580} x2={AIR_X + 154} y2={580} stroke={FLOW} strokeWidth={2} markerEnd={ARROW} />
      </Step>

      {/* 2 · the power supply: from the wall, two steady sides */}
      <Step n={2} step={step}>
        <path d={`M${PSU_X - 80} ${PSU_Y + 60} H${PSU_X}`} fill="none" stroke={PART} strokeWidth={4} strokeLinecap="round" />
        <Plug x={PSU_X - 80} y={PSU_Y + 60} />
        <Label at={[PSU_X - 128, PSU_Y + 30]}>{l.wallSocket}</Label>
        <rect x={PSU_X} y={PSU_Y} width={PSU_W} height={PSU_H} rx={10} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={2} />
        <text className="lsc-dd-reading" x={PSU_X + PSU_W / 2 - 20} y={PSU_Y + PSU_H / 2 + 5} textAnchor="middle">{l.powerSupply}</text>
        <path d={`M${PSU_X + PSU_W} ${PLUS_Y} H${COL_X} V${PLUS_END}`} fill="none" stroke={INK} strokeWidth={2} />
        <path d={`M${MINUS_X} ${PSU_Y + PSU_H} V${MINUS_Y} H${COL_X} V${MINUS_END}`} fill="none" stroke={INK} strokeWidth={2} />
        <path d={`M${PSU_X + PSU_W} ${ZERO_Y} H${PSU_X + PSU_W + 30} V${ZERO_Y + 12}`} fill="none" stroke={INK} strokeWidth={1.5} />
        <Ground x={PSU_X + PSU_W + 30} y={ZERO_Y + 12} />
        <Label at={[PSU_X + PSU_W + 52, ZERO_Y + 24]}>{l.zeroV}</Label>
        <Label at={[PSU_X + PSU_W + 10, PLUS_Y - 10]}>{l.plus12}</Label>
        <Label at={[MINUS_X + 10, PSU_Y + PSU_H + 40]}>{l.minus12}</Label>
        <Label at={[(PSU_X + PSU_W + COL_X) / 2 + 40, PLUS_Y - 10]} anchor="middle">{l.waiting}</Label>
        <g data-p="upperDots" fill={MOVER}>
          {Array.from({ length: Math.floor(UPPER_LEN / DOT_GAP) }, (_, i) => <circle key={i} r={3} />)}
        </g>
        <g data-p="lowerDots" fill={MOVER}>
          {Array.from({ length: Math.floor(LOWER_LEN / DOT_GAP) }, (_, i) => <circle key={i} r={3} />)}
        </g>
      </Step>

      {/* 3 · the voltage made bigger, and a transistor letting the + side's current through */}
      <Step n={3} step={step}>
        <line x1={IN_X + 330} y1={IN_Y} x2={TRI_X} y2={IN_Y} stroke={INK} strokeWidth={1.5} />
        <path d={`M${TRI_X} ${IN_Y - TRI_HALF} L${TRI_TIP} ${IN_Y} L${TRI_X} ${IN_Y + TRI_HALF} Z`}
          fill="var(--lsc-sunken)" stroke={PART} strokeWidth={2} strokeLinejoin="round" />
        <Label at={[(TRI_X + TRI_TIP) / 2, IN_Y - TRI_HALF - 14]} anchor="middle">
          {fmt(l.voltageGain, { gain: String(Math.round(GAIN)), db: String(Math.round(GAIN_DB)) })}
        </Label>
        <path d={`M${TRI_TIP} ${IN_Y} H${DRIVE_X} V${Q1_Y} H${BAR_X}`} fill="none" stroke={INK} strokeWidth={1.5} />
        <path d={`M${COL_X} ${PLUS_END} V${Q1_Y - 28} L${BAR_X} ${Q1_Y - 8} M${BAR_X} ${Q1_Y + 8} L${COL_X} ${Q1_Y + 28} V${NODE_Y}`}
          fill="none" stroke={INK} strokeWidth={2} />
        <Transistor y={Q1_Y} fill="q1Fill" pnp={false} />
        <circle cx={COL_X} cy={NODE_Y} r={4} fill={INK} />
        <Label at={[COL_X - 50, Q1_Y - 46]} anchor="end">{step >= A_STEP ? l.pushes : l.transistor}</Label>
        <Step n={3} until={3} step={step}>
          <Label at={[BAR_X - 30, Q1_Y - 10]} anchor="end">{l.base}</Label>
          <Label at={[COL_X - 14, PLUS_END - 24]} anchor="end" flow>{l.bigCurrent}</Label>
        </Step>
        <g data-p="speakerDots" fill={MOVER}>
          {Array.from({ length: Math.floor(SPEAKER_LEN / DOT_GAP) }, (_, i) => <circle key={i} r={3} />)}
        </g>

        {/* The speaker's voltage */}
        <rect x={OUT_X} y={OUT_Y - 96} width={330} height={192} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
        <g stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4">
          {[90, 180, 270].map((deg) => <line key={deg} x1={outX(deg)} y1={OUT_Y - 88} x2={outX(deg)} y2={OUT_Y + 88} />)}
        </g>
        <g stroke={PART} strokeWidth={0.75} strokeDasharray="6 4">
          <line x1={OUT_X + 10} y1={outY(12)} x2={OUT_X + 320} y2={outY(12)} />
          <line x1={OUT_X + 10} y1={outY(-12)} x2={OUT_X + 320} y2={outY(-12)} />
        </g>
        <line x1={OUT_X + 10} y1={OUT_Y} x2={OUT_X + 320} y2={OUT_Y} stroke={PART} strokeWidth={0.75} />
        <Label at={[OUT_X + 12, OUT_Y - 78]}>{l.toSpeaker}</Label>
        <Label at={[OUT_X - 6, outY(12) + 4]} anchor="end">{l.plus12}</Label>
        <Label at={[OUT_X - 6, OUT_Y + 4]} anchor="end">0</Label>
        <Label at={[OUT_X - 6, outY(-12) + 4]} anchor="end">{l.minus12}</Label>
        <clipPath id="lsc-dd-amp-out"><rect x={OUT_X} y={OUT_Y - 96} width={330} height={192} rx={8} /></clipPath>
        {/* What it should give, pushed harder: past the sides it leaves the graph */}
        {wanted && <path d={wanted} clipPath="url(#lsc-dd-amp-out)" fill="none" stroke={INK} strokeWidth={1.25} strokeDasharray="5 4" opacity={0.6} />}
        <path d={ghost} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
        <path data-p="outTrace" fill="none" stroke={TRACE} strokeWidth={3} strokeLinecap="round" />
        <path data-p="clipTrace" fill="none" stroke="var(--signal-clipping)" strokeWidth={4} strokeLinecap="round" />
        <circle data-p="outDot" r={6} fill={MOVER} />
        <text className="lsc-dd-reading" x={OUT_X} y={OUT_Y + 120}>
          {l.toSpeaker}: <tspan data-p="outReading">+10.0</tspan> {l.volts}
        </text>
        {note && <Label at={[NOTE_X, NOTE_Y]}>{note}</Label>}
        {step === B_STEP && <Label at={[NOTE_X, NOTE_Y + 20]}>{fmt(l.classBNotch, { v: `${VBE} ${l.volts}` })}</Label>}
      </Step>

      {/* 4 · a second transistor pulling to the − side, the resting current, the heat, the power */}
      <Step n={A_STEP} step={step}>
        <path d={`M${DRIVE_X} ${IN_Y} V${Q2_Y} H${BAR_X}`} fill="none" stroke={INK} strokeWidth={1.5} />
        <path d={`M${COL_X} ${NODE_Y} V${Q2_Y - 28} L${BAR_X} ${Q2_Y - 8} M${BAR_X} ${Q2_Y + 8} L${COL_X} ${Q2_Y + 28} V${MINUS_END}`}
          fill="none" stroke={INK} strokeWidth={2} />
        <Transistor y={Q2_Y} fill="q2Fill" pnp />
        <Label at={[COL_X - 50, Q2_Y + 56]} anchor="end">{l.pulls}</Label>
        <rect x={DRIVE_X - 12} y={BIAS_TOP} width={24} height={BIAS_BOTTOM - BIAS_TOP} rx={4} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={2} />
        <Leader x1={DRIVE_X - 14} y1={BIAS_BOTTOM - 6} x2={DRIVE_X - 30} y2={BIAS_BOTTOM + 22} />
        <Label at={[DRIVE_X - 32, BIAS_BOTTOM + 34]} anchor="end">{fmt(l.restingCurrent, { a: `${resting.toFixed(2)} ${l.amps}` })}</Label>
        <HeatSink y={Q1_Y} waves="heat1" />
        <HeatSink y={Q2_Y} waves="heat2" />
        <Label at={[SINK_X + SINK_W + 10, Q1_Y + 4]}>{l.heatSink}</Label>
      </Step>

      {/* The power at full volume, through the classes' steps */}
      <Step n={A_STEP} until={AB_STEP} step={step}>
        {power && (
          <>
            <Label at={[POWER_X, POWER_Y]}>{l.powerTitle}</Label>
            {bars.map((b, i) => {
              const y = POWER_Y + 30 + i * 32
              return (
                <g key={i}>
                  <text className="lsc-dd-reading" x={POWER_X} y={y + 5}>{b.name}</text>
                  <rect x={BAR0} y={y - 9} width={Math.max(1, b.w * PX_PER_W)} height={18} rx={3} fill={b.colour} />
                  <text className="lsc-dd-reading" x={BAR0 + b.w * PX_PER_W + 8} y={y + 5}>{watts(b.w)}</text>
                </g>
              )
            })}
            <Label at={[POWER_X, POWER_Y + 130]}>
              {fmt(l.reaches, { pct: String(Math.round((100 * power.speaker) / power.supply)) })} · {fmt(l.silentHeat, { w: power.silentHeat.toFixed(1) })}
            </Label>
            <Label at={[POWER_X, POWER_Y + 154]}>{l.microphonePower}</Label>
          </>
        )}
      </Step>

      {/* 5 · class B's notch, ten times larger */}
      <Step n={B_STEP} step={step}>
        <g style={showZoom ? undefined : { display: 'none' }}>
          <rect x={outX(90) - ZOOM_DEG * (SCOPE_W / 360)} y={OUT_Y - 9.6} width={2 * ZOOM_DEG * (SCOPE_W / 360)} height={19.2}
            fill="none" stroke={INK} strokeWidth={1} />
          <Leader x1={outX(90) + 8} y1={OUT_Y - 10} x2={ZOOM_X} y2={OUT_Y - 60} />
          <rect x={ZOOM_X} y={OUT_Y - 96} width={ZOOM_W} height={192} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
          <line x1={ZOOM_X + 8} y1={OUT_Y} x2={ZOOM_X + ZOOM_W - 8} y2={OUT_Y} stroke={PART} strokeWidth={0.75} />
          <path d={zoomCurve} fill="none" stroke={TRACE} strokeWidth={3} strokeLinecap="round" />
          <circle data-p="zoomDot" r={6} fill={MOVER} />
          <Label at={[ZOOM_X + 10, OUT_Y - 78]}>{l.zoom}</Label>
          <Label at={[ZOOM_X + ZOOM_W / 2, OUT_Y + 22]} anchor="middle">{l.notch}</Label>
        </g>
      </Step>

      {/* 7 · the sines in the output: the first, and what the amplifier added */}
      <Step n={SHAPE_STEP} step={step}>
        {step >= SHAPE_STEP && harmonics.length > 0 && (
          <>
            <Label at={[HARM_X, HARM_Y]}>{l.harmonics}</Label>
            <text className="lsc-dd-reading" x={HARM_X + 500} y={HARM_Y} textAnchor="end">
              {fmt(l.newSines, { pct: (100 * distortionOf(harmonics)).toFixed(1) })}
            </text>
            {[0, -20, -40, -60].map((db) => (
              <g key={db}>
                <line x1={HARM_X + 40} y1={HARM_BOTTOM - HARM_H * (1 + db / 60)} x2={HARM_X + 500} y2={HARM_BOTTOM - HARM_H * (1 + db / 60)} stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4" />
                <Label at={[HARM_X + 34, HARM_BOTTOM - HARM_H * (1 + db / 60) + 4]} anchor="end">{db === 0 ? `0 ${l.db}` : `−${-db}`}</Label>
              </g>
            ))}
            {harmonics.map((h, i) => {
              const db = 20 * Math.log10(h / harmonics[0])
              const height = db > -60 ? HARM_H * (1 + db / 60) : 0
              const x = HARM_X + 52 + i * HARM_STEP
              return (
                <g key={i}>
                  {height > 0 && <rect x={x} y={HARM_BOTTOM - height} width={HARM_W} height={height} rx={2} fill={i ? 'var(--signal-clipping)' : TRACE} />}
                  <Label at={[x + HARM_W / 2, HARM_BOTTOM + 16]} anchor="middle">{i + 1}</Label>
                </g>
              )
            })}
            <Label at={[HARM_X, HARM_BOTTOM + 44]}>{shapeNote[distortion]}</Label>
            <line x1={OUT_X + 294} y1={OUT_Y - 82} x2={OUT_X + 318} y2={OUT_Y - 82} stroke={INK} strokeWidth={1.25} strokeDasharray="5 4" opacity={0.6} />
            <Label at={[OUT_X + 288, OUT_Y - 78]} anchor="end">{l.shouldGive}</Label>
          </>
        )}
      </Step>
    </g>
  )
}

/** A transistor's circle and its base bar; `fill` opens as far as its current (named for the painter). The emitter's arrow: out of it (the upper one) or into it (the lower one). */
function Transistor({ y, fill, pnp }: { y: number; fill: string; pnp: boolean }) {
  // The emitter's lead runs from the bar (BAR_X, y ± 8) to the column (COL_X, y ± 28): its arrow sits along it
  const [x0, y0, x1, y1] = pnp ? [COL_X, y - 28, BAR_X, y - 8] : [BAR_X, y + 8, COL_X, y + 28]
  const mx = x0 + (x1 - x0) * 0.75, my = y0 + (y1 - y0) * 0.75
  const a = Math.atan2(y1 - y0, x1 - x0), s = 7
  const head = `M${mx} ${my} L${(mx - s * Math.cos(a - 0.45)).toFixed(1)} ${(my - s * Math.sin(a - 0.45)).toFixed(1)} ` +
    `L${(mx - s * Math.cos(a + 0.45)).toFixed(1)} ${(my - s * Math.sin(a + 0.45)).toFixed(1)} Z`
  return (
    <>
      <circle data-p={fill} cx={COL_X - 12} cy={y} r={Q_R} fill={MOVER} fillOpacity={0.06} stroke={PART} strokeWidth={2} />
      <line x1={BAR_X} y1={y - 18} x2={BAR_X} y2={y + 18} stroke={INK} strokeWidth={4} />
      <path d={head} fill={INK} />
    </>
  )
}

/** A heat sink right of a transistor: a plate and its fins; the heat rising off it (`waves`, named for the painter) */
function HeatSink({ y, waves }: { y: number; waves: string }) {
  const top = y - SINK_H / 2, clip = `lsc-dd-heat-${waves}`
  return (
    <>
      <rect x={SINK_X} y={top} width={6} height={SINK_H} fill={PART_2} />
      {Array.from({ length: 8 }, (_, i) => <rect key={i} x={SINK_X + 6} y={top + 2 + i * 10} width={SINK_W - 6} height={4} fill={PART_3} />)}
      <clipPath id={clip}><rect x={SINK_X - 4} y={top - HEAT_RISE - 6} width={SINK_W + 8} height={HEAT_RISE} /></clipPath>
      <g clipPath={`url(#${clip})`}>
        {/* Where each wave stands is the painter's: it lifts them as the phase runs */}
        <g data-p={waves} fill="none" stroke={FLOW} strokeWidth={2} strokeLinecap="round">
          {HEAT_XS.map((dx) => <path key={dx} d={squiggle} transform={`translate(${SINK_X + dx} ${top - 4})`} opacity={0.04} />)}
        </g>
      </g>
    </>
  )
}

/** The 0 V sign: three lines, shorter and shorter */
function Ground({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={INK} strokeWidth={1.5} strokeLinecap="round">
      <line x1={x - 12} y1={y} x2={x + 12} y2={y} />
      <line x1={x - 8} y1={y + 5} x2={x + 8} y2={y + 5} />
      <line x1={x - 4} y1={y + 10} x2={x + 4} y2={y + 10} />
    </g>
  )
}

/** A mains plug, its cable leaving to the right from (x, y) */
function Plug({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 34} y={y - 16} width={34} height={32} rx={6} fill={PART_2} />
      <rect x={x - 48} y={y - 10} width={14} height={4} rx={1} fill={PART} />
      <rect x={x - 48} y={y + 6} width={14} height={4} rx={1} fill={PART} />
    </g>
  )
}

/** The speaker, as Magnetic induction draws it: its magnet's back at SPK_X, its middle at SPK_Y */
function Speaker() {
  return (
    <g transform={`translate(${SPK_X},${SPK_Y}) scale(1.1) translate(-44,-660)`}>
      <path d="M92 612 L112 604 L198 548 M92 708 L112 716 L198 772" fill="none" stroke={PART} strokeWidth={3} strokeLinejoin="round" />
      <rect x={200} y={538} width={6} height={22} fill={PART_2} />
      <rect x={200} y={760} width={6} height={22} fill={PART_2} />
      <rect x={44} y={626} width={14} height={68} fill={PART} />
      <rect x={58} y={606} width={26} height={108} fill={PART_2} />
      <rect x={84} y={610} width={8} height={100} fill={PART_3} />
      <rect x={92} y={647} width={24} height={26} fill={PART} />
      <path data-p="cap" fill={PART} fillOpacity={0.45} stroke="none" />
      <g data-p="coil" fill="none" stroke={INK} strokeWidth={1.5}>
        {Array.from({ length: 6 }, (_, i) => <ellipse key={i} cy={660} rx={2.5} ry={16} />)}
      </g>
      <path data-p="cone" fill="none" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
    </g>
  )
}
