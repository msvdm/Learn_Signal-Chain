import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { CLIP_DBU, formatDb } from '../../signal/levels'
import { GAIN_MAX, GAIN_MIN, IN_PEAK, LINE_GAIN, MIC_LEVELS, RAIL as PRE_RAIL, RESTING as PRE_RESTING, SAMPLES, SWING_MAX as PRE_SWING, gainOf, levelsOf, preampCycle } from '../preamp'
import { GAIN, GAIN_DB, OUT_PEAK, PEAK_CURRENT, RAIL, RESTING, SWING_MAX, ampCycle, distortionOf, harmonicsOf, meanCurrents, powersOf } from '../amp'
import type { AmpClass, AmpCycle } from '../amp'
import { K, SWING, clamp, curvePath, rad, scatter, tableAt } from '../wave'
import type { ShapeId } from '../subjects'
import { ARROW, FAINT, FLOW, INK, MOVER, PART, PART_2, PART_3, TRACE } from './look'
import { KnobFace } from '../../components/controls/KnobFace'
import { takePress, usePointerDrag } from '../../hooks/usePointerDrag'
import { useLatestRef } from '../../hooks/useLatestRef'
import { put, usePainter } from './painter'
import type { Finder, Painter, SceneProps } from './painter'
import { Air, Label, Leader, Step } from './sceneParts'
import { Ground, LevelMeter, Plug, Transistor } from './circuitParts'
import { BASE_GAP, healthOfLevels, lengthOf, pointAlong, resistorPath, transistorLeads } from './circuit'
import type { Pt } from './circuit'

// Analogue amplification (Deep dive, D46): from a microphone to line level to a speaker, in one
// picture where height is voltage. The power supply's sides are lines across it — +9 V above and
// −9 V below for the preamp, ±12 V outside them for the speaker's stage — and what an amplifier
// gives is a point pulled between its two sides, its height drawn over time beside it.
// The microphone's ±2 mV, far too weak (1); the power supply's steady sides, waiting (2); a resistor
// pulling the output up to the + side and a transistor, steered by the microphone, pulling it down
// to the − side: the output moves, upside down (3); the gain knob — how hard the transistor pulls —
// up to line level, judged as the canvas judges a signal, and past it until the output meets its
// sides: clipping (4); the same again, 10 times bigger and the right way up, then two transistors
// between the ±12 V sides, one pushing and one pulling (5); the speaker they move, and its air (6);
// the classes, picked by buttons — only the current the two let through at rest changes —, with the
// heat they give, where the power goes, class B's notch and the sines an output is made of (7).
// The knob stays live from its step on and the whole chain follows it. The phase is the
// microphone's voltage, as in Magnetic induction: +2 mV at 0°. The numbers are preamp.ts's and amp.ts's.

// ── Where things are, in the scene's units ──────────────────────────────────
/** Height is voltage: the picture's middle line is 0 V */
const CY = 300, PX_V = 15
const vy = (volts: number) => CY - PX_V * volts
/** The supply's sides, as lines across the picture */
const P9 = vy(PRE_RAIL), M9 = vy(-PRE_RAIL), P12 = vy(RAIL), M12 = vy(-RAIL)
/** The power supply at the left, as tall as its sides are apart; they leave its right edge */
const PSU_W = 100, PSU_TOP = 100, PSU_BOTTOM = 500, RAIL_X = PSU_W
/** The microphone's panel: its frame, its graph's left edge and width (every graph's), half height (2 mV) */
const IN_X = 130, IN_W = 204, IN_HALF = 78, IN_SCOPE_X = 142, SCOPE_W = 150, IN_H = 55
/** The preamp's column: the resistor above its output, the transistor below */
const COL1 = 500, Q_Y = 368, RES_TOP = 195, RES_BOTTOM = 265
/** The gain knob, left of the column: the canvas's Preamp knob (a drag of DRAG_PX through its whole range) */
const KNOB_X = 412, KNOB_Y = 258, KNOB_R = 22, DRAG_PX = 150
/** The line out's panel, from side to side: its left edge is where the output's height is read */
const LINE_X = 590, LINE_W = 220, LINE_SCOPE_X = LINE_X + 14
/** The voltage made 10 times bigger: a triangle, as Magnetic induction names an amplifier */
const TRI_X = LINE_X + LINE_W + 36, TRI_TIP = TRI_X + 60, TRI_HALF = 30
/** The speaker's stage: the line driving the two bases, the column, the transistors */
const DRIVE_X = TRI_TIP + 36, COL2 = DRIVE_X + 60, Q1_Y = 210, Q2_Y = 390
/** The heat sinks, right of each transistor */
const SINK_X = COL2 + 34, SINK_W = 60, SINK_H = 76
/** The speaker's panel, from side to side */
const OUT_X = COL2 + 130, OUT_W = 180, OUT_SCOPE_X = OUT_X + 14
/** The speaker (as Magnetic induction draws it): its magnet's back, its leads, its wires, its air */
const SPK_X = OUT_X + OUT_W + 90, SPK_Y = CY, LEAD_A = SPK_X + 63.8, LEAD_B = SPK_X + 72.6
const WIRE_UP_X = SPK_X - 70, WIRE_TOP = SPK_Y - 80, RETURN_TOP = SPK_Y - 58, RETURN_X = SPK_X - 50, GROUND_Y = SPK_Y + 130
const AIR_X = SPK_X + 182, AIR_W = 120, AIR_Y = SPK_Y - 130, AIR_H = 262, LOUDER = 1.8
/** Under the picture, at the classes' step: where the power goes, the output's sines, class B's notch */
const PANEL_Y = 560
const POWER_X = IN_X, BAR0 = POWER_X + 200, PX_PER_W = 16
const HARM_X = 700, HARM_BOTTOM = PANEL_Y + 130, HARM_H = 100, HARM_STEP = 34, HARM_W = 22
/** The zoom on the notch: 10 times larger both ways, ±ZOOM_DEG around 90° and ±ZOOM_VOLTS */
const ZOOM_DEG = 9, ZOOM_VOLTS = 0.5, ZOOM_PX_DEG = (10 * SCOPE_W) / 360, ZOOM_PX_V = 10 * PX_V
const ZOOM_X = OUT_X + 52, ZOOM_W = 2 * ZOOM_DEG * ZOOM_PX_DEG, ZOOM_CY = PANEL_Y + 90, ZOOM_HALF = ZOOM_VOLTS * ZOOM_PX_V + 10

/** The steps: the knob's, the speaker's stage, the speaker, the classes */
const GAIN_STEP = 4, POWER_STEP = 5, SPEAKER_STEP = 6, CLASS_STEP = 7

/** The classes' buttons (`Subject.shapes`); before their step the stage runs in class A, their first */
const CLASS_OF: Partial<Record<ShapeId, AmpClass>> = { classA: 'a', classB: 'b', classAB: 'ab' }
const classAt = (step: number, shape: ShapeId | undefined): AmpClass => (step >= CLASS_STEP && shape && CLASS_OF[shape]) || 'a'
/** The gain a step shows: line level, the knob's from the knob's step on */
const gainAt = (step: number, knob: number) => (step >= GAIN_STEP ? knob : LINE_GAIN)

/** The charges on the wires, every DOT_GAP; how far they move a cycle (the preamp's: its 1 mA on average at every gain; the stage's: per ampere) */
const DOT_GAP = 26, PRE_GAPS = 4, GAPS_PER_AMP = 8, SPEAKER_TO_AND_FRO = 32
/** The preamp's current: from the + side down its column to the − side */
const PRE_LOOP: readonly Pt[] = [[RAIL_X, P9], [COL1, P9], [COL1, M9], [RAIL_X, M9]]
/** The stage's: from the + side through the upper transistor to the output; from it through the lower one to the − side; from it to the speaker */
const UPPER_WIRE: readonly Pt[] = [[RAIL_X, P12], [COL2, P12], [COL2, CY]]
const LOWER_WIRE: readonly Pt[] = [[COL2, CY], [COL2, M12], [RAIL_X, M12]]
const SPEAKER_WIRE: readonly Pt[] = [[COL2, CY], [WIRE_UP_X, CY], [WIRE_UP_X, WIRE_TOP], [LEAD_B, WIRE_TOP], [LEAD_B, SPK_Y]]
const PRE_LEN = lengthOf(PRE_LOOP), UPPER_LEN = lengthOf(UPPER_WIRE), LOWER_LEN = lengthOf(LOWER_WIRE), SPEAKER_LEN = lengthOf(SPEAKER_WIRE)
/** A side's part of the preamp's loop: all that is drawn of it before the transistor comes */
const PRE_SIDE = COL1 - RAIL_X
/** The speaker's wire runs through its panel: no charges are drawn over the graph */
const PANEL_FROM = OUT_X - COL2, PANEL_TO = OUT_X + OUT_W - COL2

const AIR_DOTS = scatter(29, 290, { x: AIR_X, y: AIR_Y, w: AIR_W, h: AIR_H })

const inX = (deg: number) => IN_SCOPE_X + (SCOPE_W * deg) / 360
const inY = (deg: number) => CY - IN_H * Math.cos(rad(deg))
const lineX = (deg: number) => LINE_SCOPE_X + (SCOPE_W * deg) / 360
const outX = (deg: number) => OUT_SCOPE_X + (SCOPE_W * deg) / 360
const zoomX = (deg: number) => ZOOM_X + ZOOM_W / 2 + (deg - 90) * ZOOM_PX_DEG
const zoomY = (volts: number) => ZOOM_CY - ZOOM_PX_V * volts

/** A reading's sign and digits (none shows as +0.0, never −0.0) */
function signed(value: number, digits: number): string {
  const shown = value.toFixed(digits)
  return Number(shown) < 0 ? `−${shown.slice(1)}` : `+${Number(shown) === 0 ? (0).toFixed(digits) : shown}`
}

/** A table over one cycle as a graph (height is voltage), up to `to` degrees */
const tracePath = (table: Float64Array, to: number, x: (deg: number) => number) => curvePath(to, x, (deg) => vy(tableAt(table, deg)))

/** The parts of a graph where the output stands at its limit (the tops cut off), up to `to` degrees */
function clippedPath(table: Float64Array, limit: number, to: number, x: (deg: number) => number): string {
  let path = '', drawing = false
  for (let i = 0; i <= Math.min(SAMPLES, Math.round(to * 2)); i++) {
    if (Math.abs(table[i]) >= limit - 1e-9) {
      path += `${drawing ? ' L' : ' M'}${x(i / 2).toFixed(1)} ${vy(table[i]).toFixed(1)}`
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
const HEAT_WAVE = 22, HEAT_RISE = 44
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

/** `knob`: the gain the knob is at just now (it is dragged outside the player) */
function makePainter(find: Finder, knob: () => number): Painter {
  const air = find.dots('air', AIR_DOTS).map((el, i) => ({ el, x: AIR_DOTS[i].x }))
  for (const { el } of air) el.setAttribute('fill', INK)
  const inTrace = find('inTrace'), inDot = find('inDot'), inReading = find('inReading')
  const q = find('qFill'), lineLevel = find('lineLevel')
  const lineTrace = find('lineTrace'), lineDot = find('lineDot'), lineGuide = find('lineGuide'), lineReading = find('lineReading'), lineClip = find('lineClip')
  const q1 = find('q1Fill'), q2 = find('q2Fill'), outLevel = find('outLevel')
  const outTrace = find('outTrace'), outDot = find('outDot'), outGuide = find('outGuide'), outReading = find('outReading'), outClip = find('outClip')
  const cone = find('cone'), cap = find('cap'), coil = find.all('coil')
  const heat1 = find.all('heat1'), heat2 = find.all('heat2'), zoomDot = find('zoomDot')
  const wires = ([['preDots', PRE_LOOP, PRE_LEN], ['upperDots', UPPER_WIRE, UPPER_LEN], ['lowerDots', LOWER_WIRE, LOWER_LEN], ['speakerDots', SPEAKER_WIRE, SPEAKER_LEN]] as const)
    .map(([name, wire, len]) => ({ wire, len, dots: find.all<SVGCircleElement>(name) }))
  const f = (n: number) => n.toFixed(1)

  /** Puts a wire's charges `moved` along it; `shown`: whether the point `s` along it is drawn */
  function place(i: number, moved: number, shown?: (s: number) => boolean) {
    const { wire, len, dots } = wires[i]
    dots.forEach((dot, j) => {
      const s = (((j * DOT_GAP + moved) % len) + len) % len
      const [x, y] = pointAlong(wire, s)
      put(dot, 'cx', x); put(dot, 'cy', y)
      dot.style.display = !shown || shown(s) ? '' : 'none'
    })
  }

  /** A graph at the phase: its line so far, the moment on it, the same height at its left edge, and where its tops are cut off */
  function graph(table: Float64Array, limit: number, deg: number, x: (deg: number) => number, parts: { trace: SVGElement; dot: SVGElement; guide: SVGElement; clip: SVGElement }) {
    const y = vy(tableAt(table, deg))
    parts.trace.setAttribute('d', tracePath(table, Math.round(deg), x))
    put(parts.dot, 'cx', x(deg)); put(parts.dot, 'cy', y)
    put(parts.guide, 'x2', x(deg)); put(parts.guide, 'y1', y); put(parts.guide, 'y2', y)
    parts.clip.setAttribute('d', clippedPath(table, limit, deg, x))
  }

  return (deg, step, shape) => {
    const gain = gainAt(step, knob())
    const pre = preampCycle(gain)

    // 1 · the microphone's voltage
    inTrace.setAttribute('d', curvePath(Math.round(deg), inX, inY))
    put(inDot, 'cx', inX(deg)); put(inDot, 'cy', inY(deg))
    inReading.textContent = signed(IN_PEAK * 1000 * Math.cos(rad(deg)), 2)

    // 2 · the sides' charges, waiting; from 3 on they move as the transistor's current says
    if (step >= 2) {
      place(0, step >= 3 ? PRE_GAPS * DOT_GAP * tableAt(pre.moved, deg) : 0, (s) => step >= 3 || s <= PRE_SIDE || s >= PRE_LEN - PRE_SIDE)
    }
    if (step < 3) return

    // 3 · the transistor opens as far as its current, and the output's height follows
    const line = tableAt(pre.out, deg)
    q.setAttribute('fill-opacity', (0.06 + (0.6 * tableAt(pre.current, deg)) / (2 * PRE_RESTING)).toFixed(3))
    put(lineLevel, 'cy', vy(line))

    // 4 · that height over time: the line out
    if (step >= GAIN_STEP) {
      graph(pre.out, PRE_SWING, deg, lineX, { trace: lineTrace, dot: lineDot, guide: lineGuide, clip: lineClip })
      lineReading.textContent = signed(line, 2)
    }
    if (step < POWER_STEP) return

    // 5 · the two transistors open as far as their currents; the charges on their wires; the speaker's voltage
    const amp = ampCycle(classAt(step, shape), gain)
    const mean = meansOf(amp), out = tableAt(amp.out, deg)
    place(1, gapsFor(mean.upper) * DOT_GAP * tableAt(amp.upperMoved, deg))
    place(2, gapsFor(mean.lower) * DOT_GAP * tableAt(amp.lowerMoved, deg))
    place(3, SPEAKER_TO_AND_FRO * tableAt(amp.speakerMoved, deg), (s) => s < PANEL_FROM - 4 || (step >= SPEAKER_STEP && s > PANEL_TO + 4))
    q1.setAttribute('fill-opacity', (0.06 + (0.6 * tableAt(amp.upper, deg)) / PEAK_CURRENT).toFixed(3))
    q2.setAttribute('fill-opacity', (0.06 + (0.6 * tableAt(amp.lower, deg)) / PEAK_CURRENT).toFixed(3))
    put(outLevel, 'cy', vy(out))
    graph(amp.out, SWING_MAX, deg, outX, { trace: outTrace, dot: outDot, guide: outGuide, clip: outClip })
    outReading.textContent = signed(out, 1)

    // 6 · the speaker's cone follows the voltage, and the air before it
    if (step >= SPEAKER_STEP) {
      const push = (9 * out) / OUT_PEAK
      cone.setAttribute('d',
        `M202 550 Q${f(196 + push / 2)} 548 ${f(194 + push)} 558 C${f(184 + push)} 590 ${f(150 + push)} 624 ${f(118 + push)} 644 ` +
        `Q${f(142 + push)} 660 ${f(118 + push)} 676 C${f(150 + push)} 696 ${f(184 + push)} 730 ${f(194 + push)} 762 Q${f(196 + push / 2)} 772 202 770`)
      cap.setAttribute('d', `M${f(118 + push)} 644 Q${f(142 + push)} 660 ${f(118 + push)} 676 Z`)
      coil.forEach((turn, i) => put(turn, 'cx', 96 + i * 4 + push))
      for (const p of air) {
        const later = deg - (K * (p.x - AIR_X) * 180) / Math.PI
        const volts = tableAt(amp.out, ((later % 360) + 360) % 360)
        put(p.el, 'cx', clamp(p.x + (LOUDER * SWING * volts) / OUT_PEAK, AIR_X - 2, AIR_X + AIR_W + 2))
      }
    }

    // 7 · the heat each transistor gives, rising off its heat sink; the moment on the notch's zoom
    if (step >= CLASS_STEP) {
      const rise = (((2 * deg) / 360) * HEAT_WAVE) % HEAT_WAVE
      const show = (waves: SVGElement[], y: number, watts: number) => waves.forEach((w, i) => {
        w.setAttribute('opacity', Math.min(1, 0.04 + watts / HEAT_FULL).toFixed(3))
        w.setAttribute('transform', `translate(${SINK_X + HEAT_XS[i]} ${f(y - SINK_H / 2 - 4 - rise)})`)
      })
      show(heat1, Q1_Y, tableAt(amp.upperHeat, deg))
      show(heat2, Q2_Y, tableAt(amp.lowerHeat, deg))
      const near = Math.abs(deg - 90) <= ZOOM_DEG && Math.abs(out) <= ZOOM_VOLTS
      zoomDot.style.display = near ? '' : 'none'
      if (near) { put(zoomDot, 'cx', zoomX(deg)); put(zoomDot, 'cy', zoomY(out)) }
    }
  }
}

const WIRE = { fill: 'none', stroke: INK, strokeWidth: 2 } as const
const THIN = { fill: 'none', stroke: INK, strokeWidth: 1.5 } as const

export function AmplificationScene({ step, shape, onPainter }: SceneProps) {
  const root = useRef<SVGGElement>(null)
  const [knob, setKnob] = useState(LINE_GAIN)
  const knobNow = useLatestRef(knob)
  // The painter reads the knob; a turn while the phase stands still paints the picture again where it was
  const painter = useRef<Painter | null>(null)
  const last = useRef<[number, number, ShapeId | undefined]>([0, 1, undefined])
  const make = useCallback((find: Finder): Painter => {
    const paint = makePainter(find, () => knobNow.current)
    painter.current = paint
    return (deg, step, shape) => {
      last.current = [deg, step, shape]
      paint(deg, step, shape)
    }
  }, [knobNow])
  usePainter(root, onPainter, make)
  useEffect(() => { painter.current?.(...last.current) }, [knob])
  const drag = usePointerDrag<{ y: number; gain: number }>((e, from) => {
    setKnob(gainOf(from.gain + ((from.y - e.clientY) / DRAG_PX) * (GAIN_MAX - GAIN_MIN)))
  })
  const onKnobDown = (e: ReactPointerEvent) => {
    if (takePress(e)) drag.start({ y: e.clientY, gain: knob })
  }
  // ↑ ↓ turn it a dB at a time (← → are the steps')
  const onKnobKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    setKnob((g) => gainOf(g + (e.key === 'ArrowUp' ? 1 : -1)))
  }
  const { t, fmt } = useTranslation()
  const l = t.deepDive.labels

  // One cycle's worth of work each, and only when the step, the knob or the class changes
  const gain = gainAt(step, knob)
  const pre = preampCycle(gain)
  const cls = classAt(step, shape)
  const amp = ampCycle(cls, gain)
  const line = levelsOf(pre.out)
  const mic = healthOfLevels(MIC_LEVELS.rms, MIC_LEVELS.peak), lineHealth = healthOfLevels(line.rms, line.peak)
  const lineGhost = tracePath(pre.out, 360, lineX), outGhost = tracePath(amp.out, 360, outX)
  const atClasses = step >= CLASS_STEP
  const power = atClasses ? powersOf(amp) : null
  const harmonics = atClasses ? harmonicsOf(amp.out) : []
  const showZoom = atClasses && cls === 'b'
  let zoomCurve = ''
  if (showZoom) {
    for (let deg = 90 - ZOOM_DEG; deg <= 90 + ZOOM_DEG + 1e-9; deg += 0.25) zoomCurve += `${zoomCurve ? ' L' : 'M'}${zoomX(deg).toFixed(1)} ${zoomY(tableAt(amp.out, deg)).toFixed(1)}`
  }
  const watts = (w: number, digits = 1) => fmt(l.watts, { w: w.toFixed(digits) })
  const bars = power ? [
    { name: l.fromMicrophone, w: power.microphone, colour: TRACE, digits: 9 },
    { name: l.fromSupply, w: power.supply, colour: PART, digits: 1 },
    { name: l.intoSpeaker, w: power.speaker, colour: TRACE, digits: 1 },
    { name: l.heat, w: power.heat, colour: FLOW, digits: 1 },
  ] : []
  const bar = (x: number) => x - BASE_GAP

  return (
    <g ref={root}>
      {/* 1 · the microphone's voltage, and its level as the desk would read it */}
      <Step n={1} step={step}>
        <rect x={IN_X} y={CY - IN_HALF} width={IN_W} height={2 * IN_HALF} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
        <Scope x={inX} top={CY - IN_HALF + 8} bottom={CY + IN_HALF - 8} />
        <g stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4">
          <line x1={IN_SCOPE_X - 6} y1={CY - IN_H} x2={IN_SCOPE_X + SCOPE_W + 6} y2={CY - IN_H} />
          <line x1={IN_SCOPE_X - 6} y1={CY + IN_H} x2={IN_SCOPE_X + SCOPE_W + 6} y2={CY + IN_H} />
        </g>
        <Label at={[IN_X + 12, CY - IN_HALF + 17]}>{l.fromMicrophone}</Label>
        <path d={curvePath(360, inX, inY)} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
        <path data-p="inTrace" fill="none" stroke={TRACE} strokeWidth={3} strokeLinecap="round" />
        <circle data-p="inDot" r={6} fill={MOVER} />
        <LevelMeter x={IN_X + IN_W - 28} y={CY - IN_HALF + 10} w={14} h={2 * IN_HALF - 20} rms={MIC_LEVELS.rms} peak={MIC_LEVELS.peak} />
        <text className="lsc-dd-reading" x={IN_X} y={CY + IN_HALF + 20}>
          <tspan data-p="inReading">+2.00</tspan> {l.mv}
        </text>
        <text className="lsc-dd-reading" x={IN_X} y={CY + IN_HALF + 40}>
          {formatDb(MIC_LEVELS.rms)} · <tspan style={{ fill: mic.colour, fontWeight: 600 }}>{t.health[mic.health]}</tspan>
        </text>
      </Step>

      {/* 2 · the power supply: from the wall, two steady sides — lines across the picture, above and below */}
      <Step n={2} step={step}>
        <g transform={`rotate(90 ${PSU_W / 2} ${PSU_TOP - 22})`}>
          <path d={`M${PSU_W / 2} ${PSU_TOP - 22} h22`} fill="none" stroke={PART} strokeWidth={4} strokeLinecap="round" />
          <Plug x={PSU_W / 2} y={PSU_TOP - 22} />
        </g>
        <Label at={[PSU_W / 2 + 24, PSU_TOP - 38]}>{l.wallSocket}</Label>
        <rect x={0} y={PSU_TOP} width={PSU_W} height={PSU_BOTTOM - PSU_TOP} rx={10} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={2} />
        <Label at={[PSU_W / 2, CY - 40]} anchor="middle">{l.powerSupply}</Label>
        <path d={`M${RAIL_X} ${P9} H${COL1} M${RAIL_X} ${M9} H${COL1}`} {...WIRE} />
        <path d={`M${RAIL_X} ${CY} H${IN_X} M${RAIL_X + 15} ${CY} v10`} {...THIN} />
        <Ground x={RAIL_X + 15} y={CY + 10} />
        <Label at={[RAIL_X + 6, CY - 8]}>{l.zeroV}</Label>
        <Label at={[RAIL_X + 8, P9 - 8]}>{l.plus9}</Label>
        <Label at={[RAIL_X + 8, M9 + 18]}>{l.minus9}</Label>
        <Step n={2} until={2} step={step}>
          <Label at={[RAIL_X + 110, P9 - 8]}>{l.waiting}</Label>
        </Step>
        <Dots name="preDots" length={PRE_LEN} />
      </Step>

      {/* 3 · between the two sides: a resistor pulling the output up, a transistor — steered by the microphone — pulling it down */}
      <Step n={3} step={step}>
        <path d={`M${COL1} ${P9} V${RES_TOP} M${COL1} ${RES_BOTTOM} V${CY}`} {...WIRE} />
        <path d={resistorPath(COL1, RES_TOP, RES_BOTTOM)} {...WIRE} strokeLinejoin="round" />
        <path d={transistorLeads(COL1, Q_Y, CY, M9)} {...WIRE} />
        <Transistor x={COL1} y={Q_Y} fill="qFill" pnp={false} />
        <path d={`M${IN_X + IN_W} ${CY} h46 V${Q_Y} H${bar(COL1)}`} {...THIN} />
        <Label at={[COL1 + 20, (RES_TOP + RES_BOTTOM) / 2 + 4]}>{l.resistor}</Label>
        <Label at={[COL1 - 54, Q_Y + 26]} anchor="end">{l.transistor}</Label>
        {/* The output, and its height read between the two sides */}
        <path d={`M${COL1} ${P9} H${LINE_X} M${COL1} ${M9} H${LINE_X}`} {...WIRE} />
        <path d={`M${COL1} ${CY} H${LINE_X}`} {...THIN} />
        <circle cx={COL1} cy={CY} r={4} fill={INK} />
        <line x1={LINE_X} y1={P9} x2={LINE_X} y2={M9} stroke={PART} strokeWidth={1.5} />
      </Step>

      {/* 4 · that height over time — the line out, judged as the desk would — and the gain knob */}
      <Step n={GAIN_STEP} step={step}>
        <rect x={LINE_X} y={P9} width={LINE_W} height={M9 - P9} fill="var(--lsc-sunken)" />
        <path d={`M${LINE_X} ${P9} H${LINE_X + LINE_W} V${M9} H${LINE_X}`} {...WIRE} />
        <Scope x={lineX} top={P9 + 6} bottom={M9 - 6} />
        <g stroke="var(--signal-clipping)" strokeWidth={0.75} strokeDasharray="6 4" opacity={0.7}>
          <line x1={LINE_X} y1={vy(PRE_SWING)} x2={LINE_X + LINE_W} y2={vy(PRE_SWING)} />
          <line x1={LINE_X} y1={vy(-PRE_SWING)} x2={LINE_X + LINE_W} y2={vy(-PRE_SWING)} />
        </g>
        <Label at={[LINE_X + LINE_W + 6, vy(PRE_SWING) + 4]}>{`+${CLIP_DBU} dBu`}</Label>
        <line data-p="lineGuide" x1={LINE_X} y1={CY} x2={LINE_X} y2={CY} stroke={MOVER} strokeWidth={1} strokeDasharray="3 3" />
        <path d={lineGhost} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
        <path data-p="lineTrace" fill="none" stroke={TRACE} strokeWidth={3} strokeLinecap="round" />
        <path data-p="lineClip" fill="none" stroke="var(--signal-clipping)" strokeWidth={4} strokeLinecap="round" />
        <circle data-p="lineDot" r={6} fill={MOVER} />
        <LevelMeter x={LINE_X + LINE_W - 28} y={P9 + 10} w={14} h={M9 - P9 - 20} rms={line.rms} peak={line.peak} />
        <Label at={[LINE_X, P9 - 8]}>{l.lineOutReading}</Label>
        <text className="lsc-dd-reading" x={LINE_X} y={M9 + 20}>
          <tspan data-p="lineReading">−1.00</tspan> {l.volts}
        </text>
        <text className="lsc-dd-reading" x={LINE_X + LINE_W} y={M9 + 20} textAnchor="end">
          {formatDb(line.rms)} · <tspan style={{ fill: lineHealth.colour, fontWeight: 600 }}>{t.health[lineHealth.health]}</tspan>
        </text>

        {/* The gain knob: how hard the transistor pulls */}
        <Leader x1={KNOB_X + 14} y1={KNOB_Y + 18} x2={COL1 - 36} y2={Q_Y - 26} />
        <g
          role="slider" tabIndex={0} aria-label={l.gainKnob}
          aria-valuemin={GAIN_MIN} aria-valuemax={GAIN_MAX} aria-valuenow={knob} aria-valuetext={`+${knob} ${l.db}`}
          onPointerDown={onKnobDown} onKeyDown={onKnobKey}
          style={{ cursor: 'ns-resize', touchAction: 'none', outline: 'none' }}
        >
          <KnobFace cx={KNOB_X} cy={KNOB_Y} r={KNOB_R} value={(knob - GAIN_MIN) / (GAIN_MAX - GAIN_MIN)} color="var(--lsc-accent)" />
        </g>
        <Label at={[KNOB_X, KNOB_Y - KNOB_R - 24]} anchor="middle">{l.gainKnob}</Label>
        <Label at={[KNOB_X, KNOB_Y - KNOB_R - 8]} anchor="middle">+{gain} {l.db}</Label>
      </Step>

      {/* 3 again, over the line out's panel: the output's height at this moment */}
      <Step n={3} step={step}>
        <circle data-p="lineLevel" cx={LINE_X} cy={CY} r={7} fill={MOVER} />
      </Step>

      {/* 5 · the voltage 10 times bigger and the right way up again; then two transistors between the ±12 V sides, one pushing, one pulling */}
      <Step n={POWER_STEP} step={step}>
        <path d={`M${RAIL_X} ${P12} H${OUT_X} M${RAIL_X} ${M12} H${OUT_X}`} {...WIRE} />
        <Label at={[RAIL_X + 8, P12 - 8]}>{l.plus12}</Label>
        <Label at={[RAIL_X + 8, M12 + 18]}>{l.minus12}</Label>
        <Dots name="upperDots" length={UPPER_LEN} />
        <Dots name="lowerDots" length={LOWER_LEN} />

        <path d={`M${LINE_X + LINE_W} ${CY} H${TRI_X} M${TRI_TIP} ${CY} H${DRIVE_X} M${DRIVE_X} ${Q1_Y} H${bar(COL2)} M${DRIVE_X} ${Q2_Y} H${bar(COL2)} M${DRIVE_X} ${Q1_Y} V${Q2_Y}`} {...THIN} />
        <path d={`M${TRI_X} ${CY - TRI_HALF} L${TRI_TIP} ${CY} L${TRI_X} ${CY + TRI_HALF} Z`} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={2} strokeLinejoin="round" />
        <Label at={[(TRI_X + TRI_TIP) / 2, CY - TRI_HALF - 28]} anchor="middle">{fmt(l.voltageGain, { gain: String(Math.round(GAIN)) })}</Label>
        <Label at={[(TRI_X + TRI_TIP) / 2, CY - TRI_HALF - 12]} anchor="middle">+{Math.round(GAIN_DB)} {l.db}</Label>
        <Label at={[(TRI_X + TRI_TIP) / 2, CY + TRI_HALF + 22]} anchor="middle">{l.upsideDownAgain}</Label>

        <path d={transistorLeads(COL2, Q1_Y, P12, CY)} {...WIRE} />
        <path d={transistorLeads(COL2, Q2_Y, CY, M12)} {...WIRE} />
        <Transistor x={COL2} y={Q1_Y} fill="q1Fill" pnp={false} />
        <Transistor x={COL2} y={Q2_Y} fill="q2Fill" pnp />
        <Label at={[COL2, P12 - 8]} anchor="middle">{l.pushes}</Label>
        <Label at={[COL2, M12 + 18]} anchor="middle">{l.pulls}</Label>
        <path d={`M${COL2} ${CY} H${OUT_X}`} {...THIN} />
        <circle cx={COL2} cy={CY} r={4} fill={INK} />
        <Dots name="speakerDots" length={SPEAKER_LEN} />

        {/* The speaker's voltage: its height between the two sides, and over time */}
        <rect x={OUT_X} y={P12} width={OUT_W} height={M12 - P12} fill="var(--lsc-sunken)" />
        <path d={`M${OUT_X} ${P12} H${OUT_X + OUT_W} V${M12} H${OUT_X}`} {...WIRE} />
        <line x1={OUT_X} y1={P12} x2={OUT_X} y2={M12} stroke={PART} strokeWidth={1.5} />
        <Scope x={outX} top={P12 + 6} bottom={M12 - 6} />
        <g stroke="var(--signal-clipping)" strokeWidth={0.75} strokeDasharray="6 4" opacity={0.7}>
          <line x1={OUT_X} y1={vy(SWING_MAX)} x2={OUT_X + OUT_W} y2={vy(SWING_MAX)} />
          <line x1={OUT_X} y1={vy(-SWING_MAX)} x2={OUT_X + OUT_W} y2={vy(-SWING_MAX)} />
        </g>
        <line data-p="outGuide" x1={OUT_X} y1={CY} x2={OUT_X} y2={CY} stroke={MOVER} strokeWidth={1} strokeDasharray="3 3" />
        <path d={outGhost} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
        <path data-p="outTrace" fill="none" stroke={TRACE} strokeWidth={3} strokeLinecap="round" />
        <path data-p="outClip" fill="none" stroke="var(--signal-clipping)" strokeWidth={4} strokeLinecap="round" />
        <circle data-p="outDot" r={6} fill={MOVER} />
        <circle data-p="outLevel" cx={OUT_X} cy={CY} r={7} fill={MOVER} />
        <Label at={[OUT_X, P12 - 8]}>{l.toSpeaker}</Label>
        <text className="lsc-dd-reading" x={OUT_X} y={M12 + 20}>
          <tspan data-p="outReading">+10.0</tspan> {l.volts}
        </text>
      </Step>

      {/* 6 · the speaker and the air before it */}
      <Step n={SPEAKER_STEP} step={step}>
        <path d={`M${OUT_X + OUT_W} ${CY} H${WIRE_UP_X} V${WIRE_TOP} H${LEAD_B} V${SPK_Y}`} {...THIN} />
        <path d={`M${LEAD_A} ${SPK_Y} V${RETURN_TOP} H${RETURN_X} V${GROUND_Y}`} {...THIN} />
        <Ground x={RETURN_X} y={GROUND_Y} />
        <Label at={[RETURN_X + 18, GROUND_Y + 12]}>{l.zeroV}</Label>
        <Speaker />
        <Air id="lsc-dd-air-amp" x={AIR_X} y={AIR_Y} w={AIR_W} h={AIR_H} r={60} />
        <g data-p="air" mask="url(#lsc-dd-air-amp)" />
        <Label at={[AIR_X + 40, AIR_Y + AIR_H + 22]} anchor="middle" flow>{l.soundWave}</Label>
        <line x1={AIR_X + 88} y1={AIR_Y + AIR_H + 18} x2={AIR_X + 122} y2={AIR_Y + AIR_H + 18} stroke={FLOW} strokeWidth={2} markerEnd={ARROW} />
      </Step>

      {/* 7 · the classes: the heat, where the power goes, the sines in the output, class B's notch */}
      <Step n={CLASS_STEP} step={step}>
        <HeatSink y={Q1_Y} waves="heat1" />
        <HeatSink y={Q2_Y} waves="heat2" />
        <Label at={[SINK_X + SINK_W / 2, CY - 12]} anchor="middle">{l.heatSink}</Label>

        {power && (
          <>
            <Label at={[POWER_X, PANEL_Y]}>{l.powerTitle}</Label>
            {bars.map((b, i) => {
              const y = PANEL_Y + 30 + i * 30
              return (
                <g key={i}>
                  <text className="lsc-dd-reading" x={POWER_X} y={y + 5}>{b.name}</text>
                  <rect x={BAR0} y={y - 9} width={Math.max(1, b.w * PX_PER_W)} height={18} rx={3} fill={b.colour} />
                  <text className="lsc-dd-reading" x={BAR0 + b.w * PX_PER_W + 8} y={y + 5}>{watts(b.w, b.digits)}</text>
                </g>
              )
            })}
            <Label at={[POWER_X, PANEL_Y + 160]}>
              {fmt(l.reaches, { pct: String(Math.round((100 * power.speaker) / power.supply)) })} · {fmt(l.silentHeat, { w: power.silentHeat.toFixed(1) })} · {fmt(l.restingCurrent, { a: `${RESTING[cls].toFixed(2)} ${l.amps}` })}
            </Label>

            <Label at={[HARM_X, PANEL_Y]}>{l.harmonics}</Label>
            <text className="lsc-dd-reading" x={HARM_X + 400} y={PANEL_Y} textAnchor="end">
              {fmt(l.newSines, { pct: (100 * distortionOf(harmonics)).toFixed(1) })}
            </text>
            {[0, -20, -40, -60].map((db) => (
              <g key={db}>
                <line x1={HARM_X + 40} y1={HARM_BOTTOM - HARM_H * (1 + db / 60)} x2={HARM_X + 400} y2={HARM_BOTTOM - HARM_H * (1 + db / 60)} stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4" />
                <Label at={[HARM_X + 34, HARM_BOTTOM - HARM_H * (1 + db / 60) + 4]} anchor="end">{db === 0 ? `0 ${l.db}` : `−${-db}`}</Label>
              </g>
            ))}
            {harmonics.map((h, i) => {
              const db = h > 0 && harmonics[0] > 0 ? 20 * Math.log10(h / harmonics[0]) : -Infinity
              const height = db > -60 ? HARM_H * (1 + db / 60) : 0
              const x = HARM_X + 52 + i * HARM_STEP
              return (
                <g key={i}>
                  {height > 0 && <rect x={x} y={HARM_BOTTOM - height} width={HARM_W} height={height} rx={2} fill={i ? 'var(--signal-clipping)' : TRACE} />}
                  <Label at={[x + HARM_W / 2, HARM_BOTTOM + 16]} anchor="middle">{i + 1}</Label>
                </g>
              )
            })}
          </>
        )}

        {/* Class B's notch, ten times larger */}
        <g style={showZoom ? undefined : { display: 'none' }}>
          <rect x={outX(90) - ZOOM_DEG * (SCOPE_W / 360)} y={vy(ZOOM_VOLTS)} width={2 * ZOOM_DEG * (SCOPE_W / 360)} height={2 * ZOOM_VOLTS * PX_V} fill="none" stroke={INK} strokeWidth={1} />
          <Leader x1={outX(90)} y1={vy(-ZOOM_VOLTS)} x2={ZOOM_X + ZOOM_W / 2} y2={ZOOM_CY - ZOOM_HALF} />
          <rect x={ZOOM_X - 8} y={ZOOM_CY - ZOOM_HALF} width={ZOOM_W + 16} height={2 * ZOOM_HALF} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
          <clipPath id="lsc-dd-amp-zoom"><rect x={ZOOM_X - 8} y={ZOOM_CY - ZOOM_HALF} width={ZOOM_W + 16} height={2 * ZOOM_HALF} rx={8} /></clipPath>
          <line x1={ZOOM_X - 2} y1={ZOOM_CY} x2={ZOOM_X + ZOOM_W + 2} y2={ZOOM_CY} stroke={PART} strokeWidth={0.75} />
          <path d={zoomCurve} clipPath="url(#lsc-dd-amp-zoom)" fill="none" stroke={TRACE} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <circle data-p="zoomDot" r={6} fill={MOVER} />
          <Label at={[ZOOM_X + ZOOM_W + 18, ZOOM_CY - ZOOM_HALF + 14]}>{l.zoom}</Label>
          <Label at={[ZOOM_X + ZOOM_W + 18, ZOOM_CY + 4]}>{l.notch}</Label>
        </g>
      </Step>
    </g>
  )
}

/** A graph's quarter lines and its 0 V line, between `top` and `bottom` */
function Scope({ x, top, bottom }: { x: (deg: number) => number; top: number; bottom: number }) {
  return (
    <>
      <g stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4">
        {[90, 180, 270].map((deg) => <line key={deg} x1={x(deg)} y1={top} x2={x(deg)} y2={bottom} />)}
      </g>
      <line x1={x(0) - 6} y1={CY} x2={x(360) + 6} y2={CY} stroke={PART} strokeWidth={0.75} />
    </>
  )
}

/** A wire's charges, every DOT_GAP along it: the painter moves them (`name`) */
function Dots({ name, length }: { name: string; length: number }) {
  return (
    <g data-p={name} fill={MOVER}>
      {Array.from({ length: Math.floor(length / DOT_GAP) }, (_, i) => <circle key={i} r={3} />)}
    </g>
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
