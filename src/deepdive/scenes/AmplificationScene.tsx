import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { CLIP_DBU, formatDb } from '../../signal/levels'
import {
  GAIN_MAX, GAIN_MIN, HUM_PEAK, IN_PEAK, LINE_GAIN, MIC_LEVELS, RAIL as PRE_RAIL, SAMPLES, STAGE_CURRENT, SWING_MAX as PRE_SWING,
  emitterResistor, gainOf, gainResistor, humAt, levelsOf, preampCycle,
} from '../preamp'
import type { Input, PreampCycle, Wiring } from '../preamp'
import {
  GAIN, GAIN_DB, OUT_PEAK, PEAK_CURRENT, RAIL, RESTING, SWING_MAX, VOLUME_FULL, VOLUME_OFF,
  ampCycle, distortionOf, harmonicsOf, meanCurrents, powersOf, volumeOf,
} from '../amp'
import type { AmpClass, AmpCycle } from '../amp'
import { K, SWING, clamp, curvePath, rad, scatter, swing, tableAt } from '../wave'
import type { ShapeId } from '../subjects'
import { ARROW, ARROW_INK, FAINT, FLOW, INK, MOVER, PART, PART_2, PART_3, TRACE } from './look'
import { KnobFace } from '../../components/controls/KnobFace'
import { takePress, usePointerDrag } from '../../hooks/usePointerDrag'
import { useLatestRef } from '../../hooks/useLatestRef'
import { put, usePainter } from './painter'
import type { Finder, Painter, SceneProps } from './painter'
import { Air, Label, Leader, Step } from './sceneParts'
import { Ground, LevelMeter, Plug, Transistor } from './circuitParts'
import { BASE_GAP, healthOfLevels, lengthOf, pointAlong, resistorPath, transistorLeads } from './circuit'
import type { Pt } from './circuit'
import { MicrophoneParts } from './micParts'
import { MIC_FACE, MIC_MIDDLE, moveMicrophone } from './mic'

// Analogue amplification (Deep dive, D46): from a microphone to line level to a speaker, in one
// picture where height is voltage. The power supply's sides are lines across it — +9 V above and
// −9 V below for the preamp, ±12 V outside them for the speaker's stage — and what an amplifier
// gives is a point between its two sides, its height drawn over time beside it.
// (1) The sound moves the microphone's diaphragm (as in Magnetic induction): ±10 mV, too quiet,
//     between pin 2 and pin 3 of its XLR; a mains cable across the microphone's puts a hum on the
//     wires — balanced, the same on both; unbalanced (a button), only on the one wire.
// (2) The power supply's steady sides, waiting.
// (3) The clean preamp chip (as the THAT1510), open: its two input transistors, one steered by each
//     wire; what they make of the difference between them comes out — pin 3 turned over and added
//     to pin 2, the hum meets itself upside down and is gone.
// (4) The gain knob, the resistor between the two transistors: the smaller, the bigger the current
//     through it and the output — up to line level, judged as the canvas judges a signal, and past
//     it until the output meets its sides: clipping.
// (5) The power amplifier: its Volume (only turning down), the voltage 10 times bigger, two
//     transistors between the ±12 V sides, one pushing and one pulling, and the speaker they move.
// (6) The classes, picked by buttons — only the current the two let through at rest changes —, with
//     the heat, where the power goes, class B's notch and the sines an output is made of.
// (7) The preamp's input, picked by buttons: the clean chip, or a transformer and one transistor —
//     the new sines that adds, more as it is driven harder.
// Both knobs stay live from their step on and the whole chain follows them. The phase is the
// microphone's voltage, as in Magnetic induction: +10 mV at 0°. The numbers are preamp.ts's and amp.ts's.

// ── Where things are, in the scene's units ──────────────────────────────────
/** Height is voltage: the picture's middle line is 0 V */
const CY = 300, PX_V = 15
const vy = (volts: number) => CY - PX_V * volts
/** The supply's sides, as lines across the picture */
const P9 = vy(PRE_RAIL), M9 = vy(-PRE_RAIL), P12 = vy(RAIL), M12 = vy(-RAIL)
/** The power supply at the left, as tall as its sides are apart; they leave its right edge */
const PSU_W = 100, PSU_TOP = 100, PSU_BOTTOM = 500, RAIL_X = PSU_W

/** 1 · the air before the microphone; where its diaphragm rests (the drawing's own units moved there) */
const AIR1_X = 112, AIR1_W = 76, AIR1_Y = CY - 69, AIR1_H = 138
const MIC_X = 200, MIC_MOVE = `translate(${MIC_X - MIC_FACE},${CY - MIC_MIDDLE})`
/** The coil's two leads: where they leave it (its bottom), how far right of the diaphragm (pin 2's, pin 3's) */
const LEAD_TOP = CY + 20, LEAD_2 = 28, LEAD_3 = 20
/**
 * The readings above the picture and below it, each with a leader to the wires it reads: the
 * microphone's voltage (between its two leads), pin 2's, the difference above the chip; pin 3's
 * below. Their middle lines; how far each panel reaches either side of it
 */
const TOP_Y = 40, PINS_HALF = 48, PIN3_Y = 544
/** The microphone's voltage panel: its frame, its graph's left edge and width (every graph's), half height (10 mV) */
const IN_X = 230, IN_W = 220, IN_HALF = 56, IN_SCOPE_X = IN_X + 12, SCOPE_W = 150, IN_H = 26
/** The XLR socket: its body, its pins (2 above, 1, 3 below) */
const XLR_X = 352, XLR_W = 32, PIN_X = XLR_X + 8, PIN_GAP = 16
/** The cable: its shield from the socket to the chip, its two wires inside */
const CABLE_X = XLR_X + XLR_W, CABLE_END = 600, CABLE_HALF = 26, WIRE_2 = CY - 14, WIRE_3 = CY + 14
/** The mains cable lying across it, and its field */
const MAINS_X = 425, MAINS_HALF = 100, FIELD = [18, 30, 42]
/** Pin 2's graph above the picture, pin 3's below; their scale (3 px a millivolt) */
const PINS_X = 466, PINS_W = 172, PX_MV = 3, PINS_SCOPE_X = PINS_X + 10
const LEADER_X = 552, MIC_LEADER_X = PIN_X - 20

/** 3 · the chip: its frame, the difference part at its top, its two input transistors' columns */
const CHIP_X = 610, CHIP_R = 925, CHIP_TOP = 176, CHIP_BOTTOM = 426
const BOX_X = 640, BOX_R = 900, BOX_TOP = 190, BOX_BOTTOM = 232, PLUS_X = 770
const COL_A = 665, COL_B = 875, Q_Y = 280, E_Y = 360, SOURCE_Y = 403
/** The gain resistor between the two, and the knob under it */
const RG_FROM = 710, RG_TO = 830, KNOB_X = 697, KNOB_Y = SOURCE_Y, KNOB_R = 16
/** Where pin 3's wire runs under the first transistor, hopping over its column */
const PIN3_RUN = 330, PIN3_UP = 815, HOP = 8
/** Where the output leaves both inputs for the line out */
const OUT_TURN = 945
/** The difference's graph, above the chip */
const DIFF_X = 654, DIFF_W = 330, DIFF_SCOPE_X = DIFF_X + 12, LEGEND_X = DIFF_SCOPE_X + SCOPE_W + 14, DIFF_LEADER_X = BOX_X + 170
/** 7 · the transformer input in the chip's place: its coils and core, its transistor's column */
const COIL_1 = 622, COIL_2 = 662, COL_T = PLUS_X, QT_Y = 300, RC_TOP = 180, RC_BOTTOM = 230, NODE_T = 250, RE_TOP = 350, RE_BOTTOM = 410
const KNOB_T_X = 810, KNOB_T_Y = 385

/** 4 · the line out's panel, from side to side: its left edge is where the output's height is read */
const LINE_X = 965, LINE_W = 200, LINE_SCOPE_X = LINE_X + 14
/** 5 · the Volume: a resistor from the line to 0 V, its wiper taking a share of it; its knob */
const POT_X = 1230, POT_TOP = 236, POT_BOTTOM = 326, WIPER_X = 1258, VOL_X = 1280, VOL_Y = 392, VOL_R = 18
/** The voltage made 10 times bigger: a triangle, as Magnetic induction names an amplifier */
const TRI_X = 1290, TRI_TIP = TRI_X + 60, TRI_HALF = 30
/** The speaker's stage: the line driving the two bases, the column, the transistors */
const DRIVE_X = TRI_TIP + 36, COL2 = DRIVE_X + 60, Q1_Y = 210, Q2_Y = 390
/** The heat sinks, right of each transistor */
const SINK_X = COL2 + 34, SINK_W = 60, SINK_H = 76
/** The speaker's panel, from side to side */
const OUT_X = COL2 + 130, OUT_W = 170, OUT_SCOPE_X = OUT_X + 10
/** The speaker (as Magnetic induction draws it): its magnet's back, its leads, its wires, its air */
const SPK_X = OUT_X + OUT_W + 80, SPK_Y = CY, LEAD_A = SPK_X + 63.8, LEAD_B = SPK_X + 72.6
const WIRE_UP_X = SPK_X - 70, WIRE_TOP = SPK_Y - 80, RETURN_TOP = SPK_Y - 58, RETURN_X = SPK_X - 50, GROUND_Y = SPK_Y + 130
const AIR_X = SPK_X + 182, AIR_W = 110, AIR_Y = SPK_Y - 130, AIR_H = 262, LOUDER = 1.8
/** Under the picture, at the classes' step: where the power goes, the output's sines, class B's notch */
const PANEL_Y = 640
const POWER_X = 130, BAR0 = POWER_X + 200, PX_PER_W = 16
const HARM_X = 760, HARM_BOTTOM = PANEL_Y + 130, HARM_H = 100, HARM_STEP = 34, HARM_W = 22
/** The zoom on the notch: 10 times larger both ways, ±ZOOM_DEG around 90° and ±ZOOM_VOLTS */
const ZOOM_DEG = 9, ZOOM_VOLTS = 0.5, ZOOM_PX_DEG = (10 * SCOPE_W) / 360, ZOOM_PX_V = 10 * PX_V
const ZOOM_X = OUT_X + 52, ZOOM_W = 2 * ZOOM_DEG * ZOOM_PX_DEG, ZOOM_CY = PANEL_Y + 90, ZOOM_HALF = ZOOM_VOLTS * ZOOM_PX_V + 10

/** The steps: the chip's, the gain knob's, the power amplifier's, the classes', the inputs' */
const CHIP_STEP = 3, GAIN_STEP = 4, POWER_STEP = 5, CLASS_STEP = 6

/** What the buttons pick (`Subject.shapes`): each group's first until another is picked at its step */
const CLASS_OF: Partial<Record<ShapeId, AmpClass>> = { classA: 'a', classB: 'b', classAB: 'ab' }
const classOf = (shapes: readonly ShapeId[]): AmpClass => shapes.map((s) => CLASS_OF[s]).find(Boolean) ?? 'a'
const wiringOf = (shapes: readonly ShapeId[]): Wiring => (shapes.includes('unbalanced') ? 'unbalanced' : 'balanced')
const inputOf = (shapes: readonly ShapeId[]): Input => (shapes.includes('transformer') ? 'transformer' : 'chip')
/** The gain a step shows: line level, the knob's from the knob's step on; the Volume full before its step */
const gainAt = (step: number, knob: number) => (step >= GAIN_STEP ? knob : LINE_GAIN)
const volumeAt = (step: number, volume: number) => (step >= POWER_STEP ? volume : VOLUME_FULL)

/** The charges on the wires, every DOT_GAP; how far they move a cycle */
const DOT_GAP = 26, RAIL_GAPS = 4, COLUMN_GAPS = 2, GAPS_PER_AMP = 8, SPEAKER_TO_AND_FRO = 32
/** Through the gain resistor, to and fro: px per ampere × radian (±15 px at line level) */
const GAIN_TO_AND_FRO = 150000
/** The preamp's: the supply's sides as far as the chip; down each input transistor's column; through the gain resistor; the transformer input's one column */
const PLUS_WIRE: readonly Pt[] = [[RAIL_X, P9], [PLUS_X, P9]]
const MINUS_WIRE: readonly Pt[] = [[COL_B, M9], [RAIL_X, M9]]
const COLUMN_A: readonly Pt[] = [[COL_A, BOX_BOTTOM], [COL_A, M9]]
const COLUMN_B: readonly Pt[] = [[COL_B, BOX_BOTTOM], [COL_B, M9]]
const GAIN_WIRE: readonly Pt[] = [[COL_A, E_Y], [COL_B, E_Y]]
const COLUMN_T: readonly Pt[] = [[COL_T, P9], [COL_T, M9]]
/** The stage's: from the + side through the upper transistor to the output; from it through the lower one to the − side; from it to the speaker */
const UPPER_WIRE: readonly Pt[] = [[RAIL_X, P12], [COL2, P12], [COL2, CY]]
const LOWER_WIRE: readonly Pt[] = [[COL2, CY], [COL2, M12], [RAIL_X, M12]]
const SPEAKER_WIRE: readonly Pt[] = [[COL2, CY], [WIRE_UP_X, CY], [WIRE_UP_X, WIRE_TOP], [LEAD_B, WIRE_TOP], [LEAD_B, SPK_Y]]
/** The speaker's wire runs through its panel: no charges are drawn over the graph */
const PANEL_FROM = OUT_X - COL2, PANEL_TO = OUT_X + OUT_W - COL2

const MIC_AIR = scatter(17, 140, { x: AIR1_X, y: AIR1_Y, w: AIR1_W, h: AIR1_H })
const AIR_DOTS = scatter(29, 270, { x: AIR_X, y: AIR_Y, w: AIR_W, h: AIR_H })

const inX = (deg: number) => IN_SCOPE_X + (SCOPE_W * deg) / 360
const inY = (deg: number) => TOP_Y - IN_H * Math.cos(rad(deg))
const pinsX = (deg: number) => PINS_SCOPE_X + (SCOPE_W * deg) / 360
const diffX = (deg: number) => DIFF_SCOPE_X + (SCOPE_W * deg) / 360
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
/** A table of millivolts' worth as a small graph around `mid`, PX_MV a millivolt */
const mvPath = (table: Float64Array, to: number, x: (deg: number) => number, mid: number, sign = 1) =>
  curvePath(to, x, (deg) => mid - sign * PX_MV * 1000 * tableAt(table, deg))

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

/** The preamp and the power stage a step shows, at the knobs' places and the buttons picked */
function chainAt(step: number, shapes: readonly ShapeId[], knob: number, volume: number): { pre: PreampCycle; amp: AmpCycle } {
  const pre = preampCycle(gainAt(step, knob), wiringOf(shapes), inputOf(shapes))
  return { pre, amp: ampCycle(classOf(shapes), pre.out, volumeAt(step, volume)) }
}

/** `knobs`: where the gain knob and the Volume are just now (they are turned outside the player) */
function makePainter(find: Finder, knobs: () => { gain: number; volume: number }): Painter {
  const micAir = find.dots('micAir', MIC_AIR).map((el, i) => ({ el, x: MIC_AIR[i].x }))
  const air = find.dots('air', AIR_DOTS).map((el, i) => ({ el, x: AIR_DOTS[i].x }))
  for (const { el } of [...micAir, ...air]) el.setAttribute('fill', INK)
  const diaphragm = find('diaphragm'), micCoil = find.all('coil'), lead2 = find('lead2'), lead3 = find('lead3')
  const inTrace = find('inTrace'), inDot = find('inDot'), inReading = find('inReading')
  const field = find('field')
  const pin2Trace = find('pin2Trace'), pin2Dot = find('pin2Dot'), pin2Reading = find('pin2Reading')
  const pin3Trace = find('pin3Trace'), pin3Dot = find('pin3Dot'), pin3Reading = find('pin3Reading')
  const diff2 = find('diff2'), diff3 = find('diff3'), diffTrace = find('diffTrace'), diffDot = find('diffDot')
  const qA = find('qAFill'), qB = find('qBFill'), qT = find('qTFill'), lineLevel = find('lineLevel')
  const lineTrace = find('lineTrace'), lineDot = find('lineDot'), lineGuide = find('lineGuide'), lineReading = find('lineReading'), lineClip = find('lineClip')
  const q1 = find('q1Fill'), q2 = find('q2Fill'), outLevel = find('outLevel')
  const outTrace = find('outTrace'), outDot = find('outDot'), outGuide = find('outGuide'), outReading = find('outReading'), outClip = find('outClip')
  const cone = find('cone'), cap = find('cap'), coil = find.all('speakerCoil')
  const heat1 = find.all('heat1'), heat2 = find.all('heat2'), zoomDot = find('zoomDot')
  const wires = ([
    ['plusDots', PLUS_WIRE], ['minusDots', MINUS_WIRE], ['columnADots', COLUMN_A], ['columnBDots', COLUMN_B],
    ['gainDots', GAIN_WIRE], ['columnTDots', COLUMN_T], ['upperDots', UPPER_WIRE], ['lowerDots', LOWER_WIRE], ['speakerDots', SPEAKER_WIRE],
  ] as const).map(([name, wire]) => ({ wire, len: lengthOf(wire), dots: find.all<SVGCircleElement>(name) }))
  const [PLUS, MINUS, COLUMN_A_I, COLUMN_B_I, GAIN_I, COLUMN_T_I, UPPER, LOWER, SPEAKER] = wires.map((_, i) => i)
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

  /** A small millivolt graph at the phase: its line so far and the moment on it */
  function small(table: Float64Array, deg: number, x: (deg: number) => number, mid: number, trace: SVGElement, dot: SVGElement) {
    trace.setAttribute('d', mvPath(table, Math.round(deg), x, mid))
    put(dot, 'cx', x(deg)); put(dot, 'cy', mid - PX_MV * 1000 * tableAt(table, deg))
  }

  return (deg, step, shapes) => {
    const r = rad(deg), whole = Math.round(deg)
    const { gain, volume } = knobs()
    const { pre, amp } = chainAt(step, shapes, gain, volume)
    const chip = pre.input === 'chip'

    // 1 · the sound moves the diaphragm and its coil; the coil's voltage between its two leads; on the wires, the hum after the mains cable
    for (const p of micAir) put(p.el, 'cx', clamp(p.x + swing(r, p.x - MIC_X), AIR1_X - 2, AIR1_X + AIR1_W + 2))
    const u = 0.5 * SWING * Math.sin(r)
    moveMicrophone(diaphragm, micCoil, u)
    lead2.setAttribute('d', `M${f(MIC_X + LEAD_2 + u)} ${LEAD_TOP} V395 H${PIN_X - 24} V${CY - PIN_GAP} H${PIN_X}`)
    lead3.setAttribute('d', `M${f(MIC_X + LEAD_3 + u)} ${LEAD_TOP} V407 H${PIN_X - 16} V${CY + PIN_GAP} H${PIN_X}`)
    inTrace.setAttribute('d', curvePath(whole, inX, inY))
    put(inDot, 'cx', inX(deg)); put(inDot, 'cy', inY(deg))
    inReading.textContent = signed(IN_PEAK * 1000 * Math.cos(r), 1)
    field.setAttribute('opacity', (0.1 + (0.8 * Math.abs(humAt(r))) / HUM_PEAK).toFixed(3))
    small(pre.pin2, deg, pinsX, TOP_Y, pin2Trace, pin2Dot)
    small(pre.pin3, deg, pinsX, PIN3_Y, pin3Trace, pin3Dot)
    pin2Reading.textContent = signed(1000 * tableAt(pre.pin2, deg), 1)
    pin3Reading.textContent = signed(1000 * tableAt(pre.pin3, deg), 1)

    // 2 · the sides' charges, waiting; from 3 on they move (the chip draws a steady current, the transformer's transistor as much as it lets through)
    if (step >= 2) {
      const moved = step >= CHIP_STEP ? RAIL_GAPS * DOT_GAP * (chip ? deg / 360 : tableAt(pre.movedA, deg)) : 0
      place(PLUS, moved)
      place(MINUS, moved, chip || step < CHIP_STEP ? undefined : (s) => s >= COL_B - COL_T)
    }
    if (step < CHIP_STEP) return

    // 3 · the difference: pin 2, pin 3 turned over, and the two added up; the transistors open as far as their currents; the output's height
    diff2.setAttribute("d", mvPath(pre.pin2, whole, diffX, TOP_Y))
    diff3.setAttribute('d', mvPath(pre.pin3, whole, diffX, TOP_Y, -1))
    small(pre.diff, deg, diffX, TOP_Y, diffTrace, diffDot)
    if (chip) {
      qA.setAttribute('fill-opacity', (0.06 + (0.6 * tableAt(pre.currentA, deg)) / (2 * STAGE_CURRENT)).toFixed(3))
      qB.setAttribute('fill-opacity', (0.06 + (0.6 * tableAt(pre.currentB, deg)) / (2 * STAGE_CURRENT)).toFixed(3))
      place(COLUMN_A_I, COLUMN_GAPS * DOT_GAP * tableAt(pre.movedA, deg))
      place(COLUMN_B_I, COLUMN_GAPS * DOT_GAP * tableAt(pre.movedB, deg))
      place(GAIN_I, GAIN_TO_AND_FRO * tableAt(pre.gainMoved, deg))
    } else {
      qT.setAttribute('fill-opacity', (0.06 + (0.6 * tableAt(pre.currentA, deg)) / (2 * STAGE_CURRENT)).toFixed(3))
      place(COLUMN_T_I, RAIL_GAPS * DOT_GAP * tableAt(pre.movedA, deg))
    }
    const line = tableAt(pre.out, deg)
    put(lineLevel, 'cy', vy(line))

    // 4 · that height over time: the line out
    if (step >= GAIN_STEP) {
      graph(pre.out, PRE_SWING, deg, lineX, { trace: lineTrace, dot: lineDot, guide: lineGuide, clip: lineClip })
      lineReading.textContent = signed(line, 2)
    }
    if (step < POWER_STEP) return

    // 5 · the two transistors open as far as their currents; the charges on their wires; the speaker's voltage; its cone and the air before it
    const mean = meansOf(amp), out = tableAt(amp.out, deg)
    place(UPPER, gapsFor(mean.upper) * DOT_GAP * tableAt(amp.upperMoved, deg))
    place(LOWER, gapsFor(mean.lower) * DOT_GAP * tableAt(amp.lowerMoved, deg))
    place(SPEAKER, SPEAKER_TO_AND_FRO * tableAt(amp.speakerMoved, deg), (s) => s < PANEL_FROM - 4 || s > PANEL_TO + 4)
    q1.setAttribute('fill-opacity', (0.06 + (0.6 * tableAt(amp.upper, deg)) / PEAK_CURRENT).toFixed(3))
    q2.setAttribute('fill-opacity', (0.06 + (0.6 * tableAt(amp.lower, deg)) / PEAK_CURRENT).toFixed(3))
    put(outLevel, 'cy', vy(out))
    graph(amp.out, SWING_MAX, deg, outX, { trace: outTrace, dot: outDot, guide: outGuide, clip: outClip })
    outReading.textContent = signed(out, 1)
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

    // 6 · the heat each transistor gives, rising off its heat sink; the moment on the notch's zoom
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

/** A resistance as its value is read: ohms, or kilo-ohms from 1000 */
function ohmsText(ohms: number, l: { ohms: string; kOhms: string }, fmt: (s: string, v: Record<string, string>) => string): string {
  if (!Number.isFinite(ohms)) return '∞'
  if (ohms >= 1000) return fmt(l.kOhms, { r: (ohms / 1000).toFixed(1) })
  return fmt(l.ohms, { r: ohms >= 100 ? String(Math.round(ohms)) : ohms.toFixed(1) })
}

export function AmplificationScene({ step, shapes, onPainter }: SceneProps) {
  const root = useRef<SVGGElement>(null)
  const [gain, setGain] = useState(LINE_GAIN)
  const [volume, setVolume] = useState(VOLUME_FULL)
  const knobsNow = useLatestRef({ gain, volume })
  // The painter reads the knobs; a turn while the phase stands still paints the picture again where it was
  const painter = useRef<Painter | null>(null)
  const last = useRef<[number, number, readonly ShapeId[]]>([0, 1, []])
  const make = useCallback((find: Finder): Painter => {
    const paint = makePainter(find, () => knobsNow.current)
    painter.current = paint
    return (deg, step, shapes) => {
      last.current = [deg, step, shapes]
      paint(deg, step, shapes)
    }
  }, [knobsNow])
  usePainter(root, onPainter, make)
  useEffect(() => { painter.current?.(...last.current) }, [gain, volume])
  const { t, fmt } = useTranslation()
  const l = t.deepDive.labels

  // One cycle's worth of work each, and only when the step, a knob or a button changes
  const wiring = wiringOf(shapes), input = inputOf(shapes), cls = classOf(shapes)
  const { pre, amp } = chainAt(step, shapes, gain, volume)
  const chip = input === 'chip', balanced = wiring === 'balanced'
  const shownGain = gainAt(step, gain)
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
  const gainText = `+${shownGain} ${l.db}`
  const resistance = chip
    ? fmt(l.rg, { r: ohmsText(gainResistor(shownGain), l, fmt) })
    : fmt(l.re, { r: ohmsText(emitterResistor(shownGain), l, fmt) })
  const volumeText = volume <= VOLUME_OFF ? l.volumeOff : `${volume < 0 ? '−' : ''}${Math.abs(volume)} ${l.db}`
  /** The wiper's height: the knob's place along the resistor (a volume pot's: dB along its turn) */
  const wiperY = POT_BOTTOM - ((POT_BOTTOM - POT_TOP) * (volume - VOLUME_OFF)) / (VOLUME_FULL - VOLUME_OFF)
  const shown = (on: boolean) => (on ? undefined : { display: 'none' })

  return (
    <g ref={root}>
      {/* 1 · the sound, the microphone, its voltage, and its cable with the hum on it */}
      <Step n={1} step={step}>
        <Air id="lsc-dd-air-amp-mic" x={AIR1_X} y={AIR1_Y} w={AIR1_W} h={AIR1_H} r={50} />
        <g data-p="micAir" mask="url(#lsc-dd-air-amp-mic)" />
        <Label at={[AIR1_X + AIR1_W / 2, AIR1_Y + AIR1_H + 22]} anchor="middle" flow>{l.soundWave}</Label>
        <g transform={MIC_MOVE}><MicrophoneParts /></g>
        <Label at={[MIC_X + 2, CY - 92]} anchor="middle">{l.diaphragm}</Label>
        <path data-p="lead2" {...THIN} />
        <path data-p="lead3" {...THIN} />

        <rect x={IN_X} y={TOP_Y - IN_HALF} width={IN_W} height={2 * IN_HALF} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
        <Scope x={inX} top={TOP_Y - IN_HALF + 26} bottom={TOP_Y + IN_HALF - 8} mid={TOP_Y} />
        <g stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4">
          <line x1={IN_SCOPE_X - 6} y1={TOP_Y - IN_H} x2={IN_SCOPE_X + SCOPE_W + 6} y2={TOP_Y - IN_H} />
          <line x1={IN_SCOPE_X - 6} y1={TOP_Y + IN_H} x2={IN_SCOPE_X + SCOPE_W + 6} y2={TOP_Y + IN_H} />
        </g>
        <Label at={[IN_X + 12, TOP_Y - IN_HALF + 17]}>{l.fromMicrophone}</Label>
        <path d={curvePath(360, inX, inY)} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
        <path data-p="inTrace" fill="none" stroke={TRACE} strokeWidth={3} strokeLinecap="round" />
        <circle data-p="inDot" r={6} fill={MOVER} />
        <LevelMeter x={IN_X + IN_W - 28} y={TOP_Y - IN_HALF + 10} w={14} h={2 * IN_HALF - 20} rms={MIC_LEVELS.rms} peak={MIC_LEVELS.peak} />
        <text className="lsc-dd-reading" x={IN_X} y={TOP_Y - IN_HALF - 10}>
          <tspan data-p="inReading">+10.0</tspan> {l.mv} · {formatDb(MIC_LEVELS.rms)} · <tspan style={{ fill: mic.colour, fontWeight: 600 }}>{t.health[mic.health]}</tspan>
        </text>
        {/* What it reads: the voltage between the coil's two leads */}
        <Leader x1={MIC_LEADER_X} y1={TOP_Y + IN_HALF} x2={MIC_LEADER_X} y2={WIRE_2 - 6} />

        {/* The XLR socket: pin 2 and pin 3 the microphone's two sides, pin 1 the shield — unbalanced, pin 3 joined to it */}
        <rect x={XLR_X} y={CY - 34} width={XLR_W} height={68} rx={6} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1.5} />
        {[[2, CY - PIN_GAP], [1, CY], [3, CY + PIN_GAP]].map(([n, y]) => (
          <g key={n}>
            <circle cx={PIN_X} cy={y} r={3} fill={INK} />
            <text className="lsc-dd-label" x={PIN_X + 7} y={y + 4} style={{ fontSize: 11 }}>{n}</text>
          </g>
        ))}
        {!balanced && <path d={`M${PIN_X - 3} ${CY + PIN_GAP} Q${PIN_X - 9} ${CY + PIN_GAP / 2} ${PIN_X - 3} ${CY}`} {...THIN} />}
        <Label at={[XLR_X + XLR_W / 2, CY + 52]} anchor="middle">{l.xlr}</Label>

        {/* The mains cable lying across the microphone's, and its field */}
        <line x1={MAINS_X} y1={CY - MAINS_HALF} x2={MAINS_X} y2={CY + MAINS_HALF} stroke={PART_3} strokeWidth={9} strokeLinecap="round" />
        <g data-p="field" fill="none" stroke={MOVER} strokeWidth={1.2} opacity={0.1}>
          {FIELD.map((rr) => <circle key={rr} cx={MAINS_X} cy={CY} r={rr} />)}
        </g>
        <Label at={[MAINS_X - 10, CY - MAINS_HALF + 10]} anchor="end">{l.mainsCable}</Label>

        {/* The cable: its shield (pin 1) to 0 V, its wires — one, unbalanced */}
        <rect x={CABLE_X} y={CY - CABLE_HALF} width={CABLE_END - CABLE_X} height={2 * CABLE_HALF} rx={12} fill="none" stroke={PART} strokeWidth={2} />
        <path d={`M${PIN_X} ${CY} H${CABLE_X}`} {...THIN} />
        <path d={`M${PIN_X} ${WIRE_2} H${CABLE_END}`} {...WIRE} />
        <path d={`M${PIN_X} ${WIRE_3} H${CABLE_END}`} {...WIRE} style={shown(balanced)} />
        <path d={`M${CABLE_END - 10} ${CY + CABLE_HALF} V${CY + 48}`} {...THIN} />
        <Ground x={CABLE_END - 10} y={CY + 48} />
        {!balanced && <path d={`M${CABLE_END} ${CY + CABLE_HALF} V${WIRE_3}`} {...THIN} />}

        {/* What each wire carries, after the mains cable */}
        <PinGraph y={TOP_Y} name={l.pin2} reading="pin2Reading" trace="pin2Trace" dot="pin2Dot" mv={l.mv} table={pre.pin2} />
        <PinGraph y={PIN3_Y} name={l.pin3} reading="pin3Reading" trace="pin3Trace" dot="pin3Dot" mv={l.mv} table={pre.pin3} />
        <Leader x1={LEADER_X} y1={TOP_Y + PINS_HALF} x2={LEADER_X} y2={WIRE_2 - 3} />
        <Leader x1={LEADER_X} y1={PIN3_Y - PINS_HALF} x2={LEADER_X} y2={WIRE_3 + 3} />
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
        <path d={`M${RAIL_X} ${P9} H${PLUS_X} M${RAIL_X} ${M9} H${COL_B}`} {...WIRE} />
        <path d={`M${PSU_W / 2} ${PSU_BOTTOM} v14`} {...THIN} />
        <Ground x={PSU_W / 2} y={PSU_BOTTOM + 14} />
        <Label at={[PSU_W / 2 + 18, PSU_BOTTOM + 27]}>{l.zeroV}</Label>
        <Label at={[RAIL_X + 8, P9 - 8]}>{l.plus9}</Label>
        <Label at={[RAIL_X + 8, M9 + 18]}>{l.minus9}</Label>
        <Step n={2} until={2} step={step}>
          <Label at={[RAIL_X + 340, P9 - 8]}>{l.waiting}</Label>
        </Step>
        <Dots name="plusDots" wire={PLUS_WIRE} />
        <Dots name="minusDots" wire={MINUS_WIRE} />
      </Step>

      {/* 3 · the difference, above the chip: pin 2, pin 3 turned over, the two added up */}
      <Step n={CHIP_STEP} step={step}>
        <rect x={DIFF_X} y={TOP_Y - PINS_HALF} width={DIFF_W} height={2 * PINS_HALF} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
        <line x1={DIFF_SCOPE_X - 4} y1={TOP_Y} x2={DIFF_SCOPE_X + SCOPE_W + 4} y2={TOP_Y} stroke={PART} strokeWidth={0.75} />
        <path data-p="diff2" fill="none" stroke={PART_2} strokeWidth={1.5} />
        <path data-p="diff3" fill="none" stroke={PART_2} strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={mvPath(pre.diff, 360, diffX, TOP_Y)} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
        <path data-p="diffTrace" fill="none" stroke={TRACE} strokeWidth={3} strokeLinecap="round" />
        <circle data-p="diffDot" r={5} fill={MOVER} />
        <Legend x={LEGEND_X} y={TOP_Y - 22} line={<line x2={18} stroke={PART_2} strokeWidth={1.5} />}>{l.pin2}</Legend>
        <Legend x={LEGEND_X} y={TOP_Y} line={<line x2={18} stroke={PART_2} strokeWidth={1.5} strokeDasharray="4 3" />}>{l.pin3TurnedOver}</Legend>
        <Legend x={LEGEND_X} y={TOP_Y + 22} line={<line x2={18} stroke={TRACE} strokeWidth={3} />}>{l.pin2MinusPin3}</Legend>
        <Leader x1={chip ? DIFF_LEADER_X : COIL_1 + 20} y1={TOP_Y + PINS_HALF} x2={chip ? DIFF_LEADER_X : COIL_1 + 20} y2={chip ? BOX_TOP : CY - 60} />

        {/* The clean chip, open: the difference part, its two input transistors, the gain resistor between them */}
        <g style={shown(chip)}>
          <rect x={CHIP_X} y={CHIP_TOP} width={CHIP_R - CHIP_X} height={CHIP_BOTTOM - CHIP_TOP} rx={10} fill="none" stroke={PART} strokeWidth={1.5} strokeDasharray="6 4" />
          <rect x={BOX_X} y={BOX_TOP} width={BOX_R - BOX_X} height={BOX_BOTTOM - BOX_TOP} rx={6} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={2} />
          <Label at={[(BOX_X + BOX_R) / 2, (BOX_TOP + BOX_BOTTOM) / 2 + 4]} anchor="middle">{l.difference}</Label>
          <path d={`M${PLUS_X} ${P9} V${BOX_TOP}`} {...WIRE} />
          <path d={transistorLeads(COL_A, Q_Y, BOX_BOTTOM, E_Y)} {...WIRE} />
          <path d={transistorLeads(COL_B, Q_Y, BOX_BOTTOM, E_Y)} {...WIRE} />
          <Transistor x={COL_A} y={Q_Y} fill="qAFill" pnp={false} />
          <Transistor x={COL_B} y={Q_Y} fill="qBFill" pnp={false} />
          {[COL_A, COL_B].map((x) => <CurrentSource key={x} x={x} />)}
          {/* The gain resistor: it turns (the knob, from its step on) */}
          <path d={`M${COL_A} ${E_Y} H${RG_FROM} ${resistorAcross(RG_FROM, RG_TO, E_Y)} H${COL_B}`} {...WIRE} strokeLinejoin="round" />
          <line x1={RG_FROM + 24} y1={E_Y + 20} x2={RG_TO - 24} y2={E_Y - 20} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
          <circle cx={COL_A} cy={E_Y} r={4} fill={INK} />
          <circle cx={COL_B} cy={E_Y} r={4} fill={INK} />
          {/* Pin 2 into the first transistor; pin 3 under it, hopping over its column, into the second */}
          <path d={`M${CABLE_END} ${WIRE_2} H${CHIP_X + 15} V${Q_Y} H${bar(COL_A)}`} {...WIRE} />
          <path d={`M${CABLE_END} ${WIRE_3} H${CHIP_X + 20} V${PIN3_RUN} H${COL_A - HOP} a${HOP} ${HOP} 0 0 1 ${2 * HOP} 0 H${PIN3_UP} V${Q_Y} H${bar(COL_B)}`} {...WIRE} />
          <path d={`M${BOX_R} ${(BOX_TOP + BOX_BOTTOM) / 2} H${OUT_TURN} V${CY} H${LINE_X}`} {...THIN} />
          <Dots name="columnADots" wire={COLUMN_A} />
          <Dots name="columnBDots" wire={COLUMN_B} />
          <Dots name="gainDots" wire={GAIN_WIRE} />
          <Label at={[CHIP_X + 8, CHIP_BOTTOM + 30]}>{l.preampChip}</Label>
        </g>

        {/* The transformer input in its place (step 7): its two coils on one core, one transistor, a resistor above it, the gain knob's below */}
        <g style={shown(!chip)}>
          <path d={`M${CABLE_END} ${WIRE_2} H${COIL_1 - 12} V${CY - 42} H${COIL_1} M${CABLE_END} ${WIRE_3} H${COIL_1 - 12} V${CY + 42} H${COIL_1}`} {...WIRE} />
          <path d={coilPath(COIL_1, CY - 42, CY + 42, 1)} {...WIRE} />
          <path d={`M${COIL_1 + 18} ${CY - 56} V${CY + 56} M${COIL_1 + 22} ${CY - 56} V${CY + 56}`} stroke={PART} strokeWidth={2} />
          <path d={coilPath(COIL_2, CY - 60, CY + 60, -1)} {...WIRE} />
          <path d={`M${COIL_2} ${CY - 60} H${COIL_2 + 48} V${QT_Y} H${bar(COL_T)} M${COIL_2} ${CY + 60} V${CY + 80}`} {...WIRE} />
          <Ground x={COIL_2} y={CY + 80} />
          <path d={`M${COL_T} ${P9} V${RC_TOP} M${COL_T} ${RC_BOTTOM} V${NODE_T}`} {...WIRE} />
          <path d={resistorPath(COL_T, RC_TOP, RC_BOTTOM)} {...WIRE} strokeLinejoin="round" />
          <path d={transistorLeads(COL_T, QT_Y, NODE_T, RE_TOP)} {...WIRE} />
          <Transistor x={COL_T} y={QT_Y} fill="qTFill" pnp={false} />
          <path d={`${resistorPath(COL_T, RE_TOP, RE_BOTTOM)} V${M9}`} {...WIRE} strokeLinejoin="round" />
          <line x1={COL_T - 20} y1={RE_BOTTOM - 8} x2={COL_T + 20} y2={RE_TOP + 8} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
          <circle cx={COL_T} cy={NODE_T} r={4} fill={INK} />
          <path d={`M${COL_T} ${NODE_T} H${OUT_TURN} V${CY} H${LINE_X}`} {...THIN} />
          <Label at={[COL_T + 18, (RC_TOP + RC_BOTTOM) / 2 + 4]}>{l.resistor}</Label>
          <Label at={[COL_T - 40, QT_Y + 52]} anchor="end">{l.transistor}</Label>
          <Label at={[CHIP_X + 8, CHIP_BOTTOM + 26]}>{l.inputTransformer}</Label>
          <Label at={[CHIP_X + 8, CHIP_BOTTOM + 43]}>{l.noPower}</Label>
          <Dots name="columnTDots" wire={COLUMN_T} />
        </g>

        {/* The sides go on to the line out; its left edge, where the output's height is read */}
        <path d={`M${PLUS_X} ${P9} H${LINE_X} M${COL_B} ${M9} H${LINE_X}`} {...WIRE} />
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
          <tspan data-p="lineReading">+1.00</tspan> {l.volts}
        </text>
        <text className="lsc-dd-reading" x={LINE_X + LINE_W} y={M9 + 20} textAnchor="end">
          {formatDb(line.rms)} · <tspan style={{ fill: lineHealth.colour, fontWeight: 600 }}>{t.health[lineHealth.health]}</tspan>
        </text>

        {/* The gain knob: the resistor it turns — between the chip's two transistors, or below the transformer input's one */}
        <SceneKnob
          cx={chip ? KNOB_X : KNOB_T_X} cy={chip ? KNOB_Y : KNOB_T_Y} r={KNOB_R} color="var(--lsc-accent)"
          value={gain} min={GAIN_MIN} max={GAIN_MAX} round={gainOf} onChange={setGain}
          label={l.gainKnob} valueText={gainText}
        />
        <Label at={[(chip ? KNOB_X : KNOB_T_X) + KNOB_R + 6, (chip ? KNOB_Y : KNOB_T_Y) - 4]}>{l.gainKnob}</Label>
        <Label at={[(chip ? KNOB_X : KNOB_T_X) + KNOB_R + 6, (chip ? KNOB_Y : KNOB_T_Y) + 13]}>{`${gainText} · ${resistance}`}</Label>
      </Step>

      {/* 3 again, over the line out's panel: the output's height at this moment */}
      <Step n={CHIP_STEP} step={step}>
        <circle data-p="lineLevel" cx={LINE_X} cy={CY} r={7} fill={MOVER} />
      </Step>

      {/* 5 · the Volume, the voltage 10 times bigger; two transistors between the ±12 V sides, one pushing, one pulling; the speaker */}
      <Step n={POWER_STEP} step={step}>
        <path d={`M${RAIL_X} ${P12} H${OUT_X} M${RAIL_X} ${M12} H${OUT_X}`} {...WIRE} />
        <Label at={[RAIL_X + 8, P12 - 8]}>{l.plus12}</Label>
        <Label at={[RAIL_X + 8, M12 + 18]}>{l.minus12}</Label>
        <Dots name="upperDots" wire={UPPER_WIRE} />
        <Dots name="lowerDots" wire={LOWER_WIRE} />

        {/* The Volume: the line across a resistor to 0 V, the wiper taking what the knob says */}
        <path d={`M${LINE_X + LINE_W} ${CY} H${POT_X - 25} V${POT_TOP - 10} H${POT_X} V${POT_TOP} M${POT_X} ${POT_BOTTOM} V${POT_BOTTOM + 14}`} {...THIN} />
        <path d={resistorPath(POT_X, POT_TOP, POT_BOTTOM)} {...THIN} strokeLinejoin="round" />
        <Ground x={POT_X} y={POT_BOTTOM + 14} />
        <line x1={WIPER_X} y1={wiperY} x2={POT_X + 12} y2={wiperY} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
        <path d={`M${WIPER_X} ${wiperY} V${CY} H${TRI_X}`} {...THIN} />
        <SceneKnob
          cx={VOL_X} cy={VOL_Y} r={VOL_R} color="var(--lsc-knob-gray)"
          value={volume} min={VOLUME_OFF} max={VOLUME_FULL} round={volumeOf} onChange={setVolume}
          label={l.volume} valueText={volumeText}
        />
        <Label at={[VOL_X, VOL_Y + VOL_R + 18]} anchor="middle">{l.volume}</Label>
        <Label at={[VOL_X, VOL_Y + VOL_R + 35]} anchor="middle">{volumeText}</Label>

        <path d={`M${TRI_TIP} ${CY} H${DRIVE_X} M${DRIVE_X} ${Q1_Y} H${bar(COL2)} M${DRIVE_X} ${Q2_Y} H${bar(COL2)} M${DRIVE_X} ${Q1_Y} V${Q2_Y}`} {...THIN} />
        <path d={`M${TRI_X} ${CY - TRI_HALF} L${TRI_TIP} ${CY} L${TRI_X} ${CY + TRI_HALF} Z`} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={2} strokeLinejoin="round" />
        <Label at={[(TRI_X + TRI_TIP) / 2, CY - TRI_HALF - 28]} anchor="middle">{fmt(l.voltageGain, { gain: String(Math.round(GAIN)) })}</Label>
        <Label at={[(TRI_X + TRI_TIP) / 2, CY - TRI_HALF - 12]} anchor="middle">+{Math.round(GAIN_DB)} {l.db}</Label>

        <path d={transistorLeads(COL2, Q1_Y, P12, CY)} {...WIRE} />
        <path d={transistorLeads(COL2, Q2_Y, CY, M12)} {...WIRE} />
        <Transistor x={COL2} y={Q1_Y} fill="q1Fill" pnp={false} />
        <Transistor x={COL2} y={Q2_Y} fill="q2Fill" pnp />
        <Label at={[COL2, P12 - 8]} anchor="middle">{l.pushes}</Label>
        <Label at={[COL2, M12 + 18]} anchor="middle">{l.pulls}</Label>
        <path d={`M${COL2} ${CY} H${OUT_X}`} {...THIN} />
        <circle cx={COL2} cy={CY} r={4} fill={INK} />
        <Dots name="speakerDots" wire={SPEAKER_WIRE} />

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

        <path d={`M${OUT_X + OUT_W} ${CY} H${WIRE_UP_X} V${WIRE_TOP} H${LEAD_B} V${SPK_Y}`} {...THIN} />
        <path d={`M${LEAD_A} ${SPK_Y} V${RETURN_TOP} H${RETURN_X} V${GROUND_Y}`} {...THIN} />
        <Ground x={RETURN_X} y={GROUND_Y} />
        <Label at={[RETURN_X + 18, GROUND_Y + 12]}>{l.zeroV}</Label>
        <Speaker />
        <Air id="lsc-dd-air-amp" x={AIR_X} y={AIR_Y} w={AIR_W} h={AIR_H} r={55} />
        <g data-p="air" mask="url(#lsc-dd-air-amp)" />
        <Label at={[AIR_X + 36, AIR_Y + AIR_H + 22]} anchor="middle" flow>{l.soundWave}</Label>
        <line x1={AIR_X + 84} y1={AIR_Y + AIR_H + 18} x2={AIR_X + 114} y2={AIR_Y + AIR_H + 18} stroke={FLOW} strokeWidth={2} markerEnd={ARROW} />
      </Step>

      {/* 6 · the classes: the heat, where the power goes, the sines in the output, class B's notch */}
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
        <g style={shown(showZoom)}>
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
function Scope({ x, top, bottom, mid = CY }: { x: (deg: number) => number; top: number; bottom: number; mid?: number }) {
  return (
    <>
      <g stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4">
        {[90, 180, 270].map((deg) => <line key={deg} x1={x(deg)} y1={top} x2={x(deg)} y2={bottom} />)}
      </g>
      <line x1={x(0) - 6} y1={mid} x2={x(360) + 6} y2={mid} stroke={PART} strokeWidth={0.75} />
    </>
  )
}

/** One wire's voltage from 0 V, small, above or below the picture: its name, its reading, its graph (`table`'s ghost; the painter draws the rest) */
function PinGraph({ y, name, reading, trace, dot, mv, table }: {
  y: number; name: string; reading: string; trace: string; dot: string; mv: string; table: Float64Array
}) {
  return (
    <>
      <rect x={PINS_X} y={y - PINS_HALF} width={PINS_W} height={2 * PINS_HALF} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
      <Scope x={pinsX} top={y - PINS_HALF + 8} bottom={y + PINS_HALF - 8} mid={y} />
      <path d={mvPath(table, 360, pinsX, y)} fill="none" stroke={TRACE} strokeWidth={2.5} opacity={0.3} />
      <path data-p={trace} fill="none" stroke={TRACE} strokeWidth={2.5} strokeLinecap="round" />
      <circle data-p={dot} r={4.5} fill={MOVER} />
      <Label at={[PINS_X + 8, y - PINS_HALF + 15]}>{name}</Label>
      <text className="lsc-dd-label" x={PINS_X + PINS_W - 8} y={y - PINS_HALF + 15} textAnchor="end">
        <tspan data-p={reading}>+0.0</tspan> {mv}
      </text>
    </>
  )
}

/** A line of a graph's key: its sample, then its name */
function Legend({ x, y, line, children }: { x: number; y: number; line: ReactElement; children: string }) {
  return (
    <>
      <g transform={`translate(${x} ${y})`}>{line}</g>
      <Label at={[x + 24, y + 4]}>{children}</Label>
    </>
  )
}

/** A resistor on a wire running across at `y`, from `x0` to `x1`: the wire's zigzag between them (path commands, no move) */
function resistorAcross(x0: number, x1: number, y: number, half = 10): string {
  const teeth = 6, pitch = (x1 - x0) / (teeth * 2)
  let d = ''
  for (let i = 0; i < teeth * 2; i++) d += ` L${(x0 + pitch * (i + 0.5)).toFixed(1)} ${y + (i % 2 ? -half : half)}`
  return `${d} L${x1} ${y}`
}

/** A coil on a wire running down at `x`, from `y0` to `y1`: its turns bulge to the right (`way` 1) or the left (−1) */
function coilPath(x: number, y0: number, y1: number, way: 1 | -1): string {
  const turns = 6, step = (y1 - y0) / turns
  let d = `M${x} ${y0}`
  for (let i = 0; i < turns; i++) d += ` a${step / 2} ${step / 2} 0 0 ${way === 1 ? 1 : 0} 0 ${step}`
  return d
}

/** A current that stays the same, from a transistor's emitter at E_Y down to the − side: a circle with its arrow */
function CurrentSource({ x }: { x: number }) {
  return (
    <>
      <path d={`M${x} ${E_Y} V${SOURCE_Y - 11} M${x} ${SOURCE_Y + 11} V${M9}`} {...WIRE} />
      <circle cx={x} cy={SOURCE_Y} r={11} fill="none" stroke={INK} strokeWidth={1.5} />
      <line x1={x} y1={SOURCE_Y - 6} x2={x} y2={SOURCE_Y + 6} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
    </>
  )
}

/** A knob turned by dragging it up or down (`drag` px for its whole range) or with ↑ ↓ (← → are the steps') */
function SceneKnob({ cx, cy, r, color, value, min, max, round, onChange, label, valueText, drag = 150 }: {
  cx: number; cy: number; r: number; color: string
  value: number; min: number; max: number; round: (v: number) => number; onChange: (v: number) => void
  label: string; valueText: string; drag?: number
}) {
  const dragging = usePointerDrag<{ y: number; value: number }>((e, from) => {
    onChange(round(from.value + ((from.y - e.clientY) / drag) * (max - min)))
  })
  const onDown = (e: ReactPointerEvent) => {
    if (takePress(e)) dragging.start({ y: e.clientY, value })
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    onChange(round(value + (e.key === 'ArrowUp' ? 1 : -1)))
  }
  return (
    <g
      role="slider" tabIndex={0} aria-label={label}
      aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText}
      onPointerDown={onDown} onKeyDown={onKey}
      style={{ cursor: 'ns-resize', touchAction: 'none', outline: 'none' }}
    >
      <KnobFace cx={cx} cy={cy} r={r} value={(value - min) / (max - min)} color={color} />
    </g>
  )
}

/** A wire's charges, every DOT_GAP along it: the painter moves them (`name`) */
function Dots({ name, wire }: { name: string; wire: readonly Pt[] }) {
  return (
    <g data-p={name} fill={MOVER}>
      {Array.from({ length: Math.floor(lengthOf(wire) / DOT_GAP) }, (_, i) => <circle key={i} r={3} />)}
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
      <g data-p="speakerCoil" fill="none" stroke={INK} strokeWidth={1.5}>
        {Array.from({ length: 6 }, (_, i) => <ellipse key={i} cy={660} rx={2.5} ry={16} />)}
      </g>
      <path data-p="cone" fill="none" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
    </g>
  )
}
