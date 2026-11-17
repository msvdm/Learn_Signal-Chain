import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { CLIP_DBU, formatDb } from '../../signal/levels'
import {
  GAIN_MAX, GAIN_MIN, IN_PEAK, LINE_GAIN, LINE_TOP, MIC_LEVELS, RAIL as PRE_RAIL, SAMPLES, STAGE_CURRENT, SWING_MAX as PRE_SWING,
  gainOf, gainResistor, levelsOf, preampCycle,
} from '../preamp'
import type { Input, PreampCycle } from '../preamp'
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
import { BASE_GAP, TRANSISTOR_R, healthOfLevels, lengthOf, pointAlong, resistorPath, transistorLeads } from './circuit'
import type { Pt } from './circuit'
import { MicrophoneParts } from './micParts'
import { MIC_FACE, MIC_MIDDLE, moveMicrophone } from './mic'

// Analogue amplification (Deep dive, D46): from a microphone to line level to a speaker, in one
// picture where height is voltage, the signal running left to right. Each stage has its own power
// supply above it: its + side drops straight down at its left onto a line along the stage's top —
// +9 V for the preamp, +12 V for the speaker's stage —, its − side down at its right, past the
// stage's output (the output hops over it), onto a line along its bottom. Nothing powered runs past
// the microphone; each supply's 0 V goes to ground, as the cable's shield does from pin 1 at the
// preamp. What an amplifier gives is drawn over time by the wire that carries it — the line out's on
// the line, between the two stages; the speaker's under the speaker cable — height is voltage there too.
// (1) The sound moves the microphone's diaphragm (as in Magnetic induction): ±10 mV, too quiet,
//     between pin 2 and pin 3 of its cable, an XLR at each end; a hum gets onto the wires — a dim cloud named Noise over
//     the cable (the teacher says where it comes from) —, the same on both: the cable is balanced (the
//     teacher says why).
// (2) The preamp's power supply: the wall's 230 V, swinging both ways 50 times a second, turned into
//     two steady sides, waiting.
// (3) The clean preamp chip (as the THAT1510), open: its two input transistors, one steered by each
//     wire; what they make of the difference between them comes out — pin 3 turned over and added
//     to pin 2, the hum meets itself upside down and is gone. With it, the gain knob, the resistor
//     between the two transistors: the smaller, the bigger the current through it and the output —
//     up to line level, judged as the canvas judges a signal, and past it until the output meets its
//     sides: clipping.
// (4) The power amplifier, its own power supply above it: its Volume (only turning down), the voltage
//     10 times bigger, two transistors between the ±12 V sides, one pushing and one pulling, and the
//     speaker they move, along a speaker cable (a speakON at each end).
// (5) Two choices in one row of buttons: the classes — A, both transistors always open (their
//     current at rest); B, each open only for its half (the notch); D, the two switched fully on and off
//     in pulses as wide as the signal is high, a filter (a coil and a capacitor) smoothing them —, with
//     the heat, where the power goes and the sines an output is made of; and the preamp's input — the clean chip, or a transformer, the gain
//     knob turning its voltage down, and one transistor with nothing to straighten its curve: the
//     new sines that adds, its tops uneven, more as it is driven harder.
// The knobs stand below their stages, each with a leader to the resistor it turns; both stay live
// from their step on and the whole chain follows them. The phase is the
// microphone's voltage, as in Magnetic induction: +10 mV at 0°. The numbers are preamp.ts's and amp.ts's.

// ── Where things are, in the scene's units ──────────────────────────────────
/** Height is voltage: the picture's middle line is 0 V */
const CY = 300, PX_V = 15
const vy = (volts: number) => CY - PX_V * volts
/** The supplies' sides, as lines along each stage's top and bottom */
const P9 = vy(PRE_RAIL), M9 = vy(-PRE_RAIL), P12 = vy(RAIL), M12 = vy(-RAIL)
/**
 * A stage's power supply above it: its box, as wide and tall for both (the wall's voltage over time
 * inside it, turned into the steady sides), its top and bottom; both bottoms above the +12 V line
 */
const PSU_W = 340, PSU_TOP = -70, PSU_BOTTOM = 90
/**
 * The preamp's power supply, above the line out: its box; its + side dropping onto the +9 V line at its
 * left, its − side further right — left of the line out's graph — down to −9 V
 */
const PRE_PSU_L = 928, PRE_PLUS_X = 950, PRE_MINUS_X = 1050

/** 1 · the air before the microphone; where its diaphragm rests (the drawing's own units moved there) */
const AIR1_X = 112, AIR1_W = 76, AIR1_Y = CY - 69, AIR1_H = 138
const MIC_X = 200, MIC_MOVE = `translate(${MIC_X - MIC_FACE},${CY - MIC_MIDDLE})`
/** The coil's two leads: where they leave it (its bottom), how far right of the diaphragm (pin 2's, pin 3's) */
const LEAD_TOP = CY + 20, LEAD_2 = 28, LEAD_3 = 20
/**
 * The readings, each with a leader to the wires it reads: the microphone's voltage (between its two
 * leads) above the picture, pin 2's above the cable, pin 3's below it, the difference above the chip.
 * Their middle lines; how far each pin's panel reaches either side of it
 */
const TOP_Y = 40, PINS_HALF = 48, PIN2_Y = 168, PIN3_Y = 462, DIFF_Y = 72
/** The microphone's voltage panel: its frame, its graph's left edge and width (every graph's), half height (10 mV) */
const IN_X = 230, IN_W = 220, IN_HALF = 56, IN_SCOPE_X = IN_X + 12, SCOPE_W = 150, IN_H = 26
/** The XLR at each end of the cable: its body, its pins (2 above, 1, 3 below) — the microphone's on their left, the preamp's on their right */
const XLR_X = 352, XLR_W = 32, PIN_X = XLR_X + 8, PIN_GAP = 16
/** The cable: its shield from one XLR to the other, its two wires inside */
const CABLE_X = XLR_X + XLR_W, CABLE_END = 548, CABLE_HALF = 26, WIRE_2 = CY - 14, WIRE_3 = CY + 14
const XLR2_X = CABLE_END, PIN2_X = XLR2_X + XLR_W - 8
/** The shield's 0 V: from pin 1 at the preamp's end, down past pin 3's wire (which hops over it) */
const SHIELD_X = PIN2_X + 14, SHIELD_Y = CY + 60
/**
 * Balanced, its two wires twist round each other as a real cable's do: TWISTS turns from TWIST_FROM to
 * TWIST_TO, each wire back at its own height at both ends and where the pins' leaders meet them (a
 * whole number of turns in)
 */
const TWIST_FROM = 392, TWIST_TO = 532, TWISTS = 4
/** The noise on it: a still, dim cloud over the cable, its puffs (x, y from its middle, radius); its top, where its name stands above it */
const NOISE_X = 470, NOISE_Y = CY
const NOISE_PUFFS = [[-36, 6, 22], [-12, -8, 28], [16, -4, 26], [38, 8, 20], [0, 12, 24]] as const
const NOISE_TOP = NOISE_Y + Math.min(...NOISE_PUFFS.map(([, dy, r]) => dy - r))
/** Pin 2's graph above the cable, pin 3's below it; their scale (3 px a millivolt) */
const PINS_X = 376, PINS_W = 172, PX_MV = 3, PINS_SCOPE_X = PINS_X + 10
const LEADER_X = TWIST_TO, MIC_LEADER_X = PIN_X - 20

/** 3 · the chip: its frame, the difference part at its top, its two input transistors' columns */
const CHIP_X = 610, CHIP_R = 925, CHIP_TOP = 176, CHIP_BOTTOM = 426
const BOX_X = 640, BOX_R = 900, BOX_TOP = 190, BOX_BOTTOM = 232, PLUS_X = 770
const COL_A = 665, COL_B = 875, Q_Y = 280, E_Y = 360, SOURCE_Y = 403
/** The gain resistor between the two, and the knob under it */
const RG_FROM = 710, RG_TO = 830
/** The gain knob under the chip, a leader up to the resistor it turns, its words under it; as big as a transistor's circle */
const KNOB_Y = 557, KNOB_X = 739, KNOB_R = TRANSISTOR_R
/** Where pin 3's wire runs under the first transistor, hopping over its column */
const PIN3_RUN = 330, PIN3_UP = 815, HOP = 8
/** Where the output leaves both inputs for the line out */
const OUT_TURN = 945
/** The difference's graph, above the chip: as wide as its graph */
const DIFF_X = 628, DIFF_W = 180, DIFF_SCOPE_X = DIFF_X + 12, DIFF_LEADER_X = DIFF_X + DIFF_W / 2
/** 7 · the transformer input in the chip's place: its coils and core, its transistor's column */
const COIL_1 = 622, COIL_2 = 662, COL_T = PLUS_X, QT_Y = 300, RC_TOP = 180, RC_BOTTOM = 230, NODE_T = 250, RE_TOP = 350, RE_BOTTOM = 410
/** Its second coil; the gain knob's resistor from it to 0 V and its wiper; the capacitor beside the resistor below the transistor; its names' place */
const COIL_2_TOP = CY - 60, COIL_2_BOTTOM = CY + 40, GPOT_X = 700, GPOT_TOP = 250, GPOT_BOTTOM = 330, GWIPER_X = 716
const CAP_X = 805, CAP_Y = 380, TR_LABEL_X = 720, KNOB_T_X = GPOT_X + 4

/** How far right the +9 V line runs, past the chip's output */
const LINE_X = 965
/**
 * The two outputs' heights over time, each by the wire carrying it: how many px a volt; the line out's
 * graph on the line, between the two stages (its middle line, its name above it; the line runs behind
 * it), the speaker's under the speaker cable
 */
const G_PX_V = 9
const LINE_G_X = 1168, LINE_W = 200, LINE_SCOPE_X = LINE_G_X + 14, LINE_MID = CY - 55
const lineGy = (volts: number) => LINE_MID - G_PX_V * volts
/** The headroom's bracket, left of the line out's graph: from line level's top up to where it clips */
const ROOM_X = LINE_G_X - 12
/** 5 · the Volume: a resistor from the line to 0 V, its wiper taking a share of it; its knob */
const POT_X = 1553, POT_TOP = 236, POT_BOTTOM = 326, WIPER_X = POT_X + 28, VOL_X = POT_X + 36, VOL_Y = 565, VOL_R = TRANSISTOR_R
/** The voltage made 10 times bigger: a triangle, as Magnetic induction names an amplifier */
const TRI_X = POT_X + 60, TRI_TIP = TRI_X + 60, TRI_HALF = 30
/** The speaker's stage: the line driving the two bases, the column, the transistors */
const DRIVE_X = TRI_TIP + 36, COL2 = DRIVE_X + 60, Q1_Y = 210, Q2_Y = 390
/** The heat sinks, right of each transistor */
const SINK_X = COL2 + 34, SINK_W = 60, SINK_H = 76
/** Where the +12 V line ends, right of the heat sinks; the − side's place follows it */
const OUT_X = COL2 + 110
/** Its power supply, above it: its box; its + side down onto the +12 V line at its left, its − side right of the speaker's line down to −12 V */
const AMP_PSU_L = POT_X + 40, AMP_PLUS_X = AMP_PSU_L + 10, AMP_MINUS_X = OUT_X + 30
/**
 * The speaker cable: a speakON at each end (its pins + at 0 V's height, − below — the amplifier's on their
 * left, the speaker's on their right), the − wire to 0 V at the amplifier's end
 */
const SPK_PLUG_W = 28, SPK_PLUG_1 = AMP_MINUS_X + 30, SPK_CABLE_END = SPK_PLUG_1 + SPK_PLUG_W + 207, SPK_PLUG_2 = SPK_CABLE_END
const SPK_PIN_1 = SPK_PLUG_1 + 8, SPK_PIN_2 = SPK_PLUG_2 + SPK_PLUG_W - 8, RETURN_Y = CY + PIN_GAP, AMP_GROUND_X = AMP_MINUS_X + 18
/**
 * The speaker's voltage over time, under the speaker cable between its two plugs: its graph, its
 * middle line
 */
const OUT_W = 170, OUT_G_X = (SPK_PLUG_1 + SPK_PLUG_W + SPK_PLUG_2 - OUT_W) / 2, OUT_SCOPE_X = OUT_G_X + 10, OUT_MID = 471
const outGy = (volts: number) => OUT_MID - G_PX_V * volts
/**
 * The speaker (as Magnetic induction draws it), just past the cable and lower than it: its magnet's
 * back, its leads (the + wire runs along the cable's height and down into its lead; the − one comes up
 * to the cable's − pin), its air; the − wire's 0 V at the amplifier's end
 */
const SPK_X = SPK_PLUG_2 + SPK_PLUG_W + 20, SPK_Y = CY + 80, LEAD_A = SPK_X + 63.8, LEAD_B = SPK_X + 72.6, GROUND_Y = CY + 130
const AIR_X = SPK_X + 182, AIR_W = 110, AIR_Y = SPK_Y - 130, AIR_H = 262, LOUDER = 1.8
/** At the classes' step: where the power goes, right of the power amplifier's supply */
const PANEL_Y = -32, POWER_X = 2041, BAR0 = POWER_X + 200, PX_PER_W = 16
/** The output's sines, under the line out's graph */
const HARM_X = 1100, HARM_Y = 395, HARM_BOTTOM = HARM_Y + 150, HARM_H = 100, HARM_STEP = 34, HARM_W = 22

/** Class D's filter: a coil on the output's line, then a capacitor from it to 0 V */
const FCOIL_FROM = COL2 + 12, FCOIL_TO = COL2 + 62, FCAP_X = COL2 + 82, FCAP_Y = CY + 18
/** Class D's words under the speaker's graph: its key, the pulses' real speed */
const D_KEY_X = OUT_G_X, D_KEY_Y = 630

/** The steps: the chip's with its gain knob and line out, the power amplifier's, the classes' and inputs' */
const CHIP_STEP = 3, GAIN_STEP = CHIP_STEP, POWER_STEP = 4, CLASS_STEP = 5

/** What the buttons pick (`Subject.shapes`): each group's first until another is picked at its step */
const CLASS_OF: Partial<Record<ShapeId, AmpClass>> = { classA: 'a', classB: 'b', classD: 'd' }
const classOf = (shapes: readonly ShapeId[]): AmpClass => shapes.map((s) => CLASS_OF[s]).find(Boolean) ?? 'a'
const inputOf = (shapes: readonly ShapeId[]): Input => (shapes.includes('transformer') ? 'transformer' : 'chip')
/** The gain a step shows: line level, the knob's from the knob's step on; the Volume full before its step */
const gainAt = (step: number, knob: number) => (step >= GAIN_STEP ? knob : LINE_GAIN)
const volumeAt = (step: number, volume: number) => (step >= POWER_STEP ? volume : VOLUME_FULL)

/** The charges on the wires, every DOT_GAP; how far they move a cycle */
const DOT_GAP = 26, RAIL_GAPS = 4, COLUMN_GAPS = 2, GAPS_PER_AMP = 8, SPEAKER_TO_AND_FRO = 32
/** Through the gain resistor, to and fro: px per ampere × radian (±15 px at line level) */
const GAIN_TO_AND_FRO = 150000
/** The preamp's: from its supply down its + side to the chip, from the chip along −9 V and back up its − side; down each input transistor's column; through the gain resistor; the transformer input's one column */
const PLUS_WIRE: readonly Pt[] = [[PRE_PLUS_X, PSU_BOTTOM], [PRE_PLUS_X, P9], [PLUS_X, P9]]
const MINUS_WIRE: readonly Pt[] = [[COL_A, M9], [PRE_MINUS_X, M9], [PRE_MINUS_X, PSU_BOTTOM]]
const COLUMN_A: readonly Pt[] = [[COL_A, BOX_BOTTOM], [COL_A, M9]]
const COLUMN_B: readonly Pt[] = [[COL_B, BOX_BOTTOM], [COL_B, M9]]
const GAIN_WIRE: readonly Pt[] = [[COL_A, E_Y], [COL_B, E_Y]]
const COLUMN_T: readonly Pt[] = [[COL_T, P9], [COL_T, M9]]
/** The stage's: from the + side through the upper transistor to the output; from it through the lower one to the − side; from it to the speaker */
const UPPER_WIRE: readonly Pt[] = [[AMP_PLUS_X, PSU_BOTTOM], [AMP_PLUS_X, P12], [COL2, P12], [COL2, CY]]
const LOWER_WIRE: readonly Pt[] = [[COL2, CY], [COL2, M12], [AMP_MINUS_X, M12], [AMP_MINUS_X, PSU_BOTTOM]]
const SPEAKER_WIRE: readonly Pt[] = [[COL2, CY], [LEAD_B, CY], [LEAD_B, SPK_Y]]
/** Where an output hops over a − side (how far along each wire): no charges are drawn in the hop */
const PRE_HOP_S = PRE_MINUS_X - COL_A + M9 - CY, AMP_HOP_S = 2 * (M12 - CY) + AMP_MINUS_X - COL2, SPEAKER_HOP_S = AMP_MINUS_X - COL2
const offHop = (s: number, at: number) => Math.abs(s - at) > HOP + 3
/** Class D: no charges drawn on its filter's coil */
const offCoil = (s: number) => s < FCOIL_FROM - COL2 - 3 || s > FCOIL_TO - COL2 + 3

/**
 * One wire of the twisted pair (`side` −1: pin 2's, above at the ends; 1: pin 3's) in half-turns: those
 * where it passes in front of the other wire — pin 2 on the even ones, pin 3 on the odd —, and those behind it
 */
function twistedWire(side: 1 | -1): { front: string; back: string } {
  const half = (TWIST_TO - TWIST_FROM) / (2 * TWISTS), reach = CY - WIRE_2
  let front = '', back = ''
  for (let i = 0; i < 2 * TWISTS; i++) {
    let d = ''
    for (let x = TWIST_FROM + i * half; x <= TWIST_FROM + (i + 1) * half + 1e-9; x += 2) {
      d += `${d ? ' L' : 'M'}${x.toFixed(1)} ${(CY + side * reach * Math.cos((Math.PI * (x - TWIST_FROM)) / half)).toFixed(1)}`
    }
    if ((i % 2 === 0) === (side === -1)) front += `${d} `
    else back += `${d} `
  }
  return { front, back }
}
const PIN2_TWIST = twistedWire(-1), PIN3_TWIST = twistedWire(1)

const MIC_AIR = scatter(17, 140, { x: AIR1_X, y: AIR1_Y, w: AIR1_W, h: AIR1_H })
const AIR_DOTS = scatter(29, 270, { x: AIR_X, y: AIR_Y, w: AIR_W, h: AIR_H })

const inX = (deg: number) => IN_SCOPE_X + (SCOPE_W * deg) / 360
const inY = (deg: number) => TOP_Y - IN_H * Math.cos(rad(deg))
const pinsX = (deg: number) => PINS_SCOPE_X + (SCOPE_W * deg) / 360
const diffX = (deg: number) => DIFF_SCOPE_X + (SCOPE_W * deg) / 360
const lineX = (deg: number) => LINE_SCOPE_X + (SCOPE_W * deg) / 360
const outX = (deg: number) => OUT_SCOPE_X + (SCOPE_W * deg) / 360

/** A reading's sign and digits (none shows as +0.0, never −0.0) */
function signed(value: number, digits: number): string {
  const shown = value.toFixed(digits)
  return Number(shown) < 0 ? `−${shown.slice(1)}` : `+${Number(shown) === 0 ? (0).toFixed(digits) : shown}`
}

/** A volt's height on one of the graphs (its middle line, G_PX_V a volt) */
type VoltsY = (volts: number) => number
/** A table over one cycle as a graph (`y`: its graph's heights), up to `to` degrees */
const tracePath = (table: Float64Array, to: number, x: (deg: number) => number, y: VoltsY) => curvePath(to, x, (deg) => y(tableAt(table, deg)))
/** A table of millivolts' worth as a small graph around `mid`, PX_MV a millivolt */
const mvPath = (table: Float64Array, to: number, x: (deg: number) => number, mid: number, sign = 1) =>
  curvePath(to, x, (deg) => mid - sign * PX_MV * 1000 * tableAt(table, deg))

/** The parts of a graph where the output stands at its limit (the tops cut off), up to `to` degrees */
function clippedPath(table: Float64Array, limit: number, to: number, x: (deg: number) => number, y: VoltsY): string {
  let path = '', drawing = false
  for (let i = 0; i <= Math.min(SAMPLES, Math.round(to * 2)); i++) {
    if (Math.abs(table[i]) >= limit - 1e-9) {
      path += `${drawing ? ' L' : ' M'}${x(i / 2).toFixed(1)} ${y(table[i]).toFixed(1)}`
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
  const pre = preampCycle(gainAt(step, knob), 'balanced', inputOf(shapes))
  return { pre, amp: ampCycle(classOf(shapes), pre.out, volumeAt(step, volume)) }
}

/** `knobs`: where the gain knob and the Volume are just now (they are turned outside the player) */
function makePainter(find: Finder, knobs: () => { gain: number; volume: number }): Painter {
  const micAir = find.dots('micAir', MIC_AIR).map((el, i) => ({ el, x: MIC_AIR[i].x }))
  const air = find.dots('air', AIR_DOTS).map((el, i) => ({ el, x: AIR_DOTS[i].x }))
  for (const { el } of [...micAir, ...air]) el.setAttribute('fill', INK)
  const diaphragm = find('diaphragm'), micCoil = find.all('coil'), lead2 = find('lead2'), lead3 = find('lead3')
  const inTrace = find('inTrace'), inDot = find('inDot'), inReading = find('inReading')
  const pin2Trace = find('pin2Trace'), pin2Dot = find('pin2Dot'), pin2Reading = find('pin2Reading')
  const pin3Trace = find('pin3Trace'), pin3Dot = find('pin3Dot'), pin3Reading = find('pin3Reading')
  const diff2 = find('diff2'), diff3 = find('diff3'), diffTrace = find('diffTrace'), diffDot = find('diffDot')
  const qA = find('qAFill'), qB = find('qBFill'), qT = find('qTFill')
  const lineTrace = find('lineTrace'), lineDot = find('lineDot'), lineEdge = find('lineEdge'), lineGuide = find('lineGuide'), lineReading = find('lineReading'), lineClip = find('lineClip')
  const q1 = find('q1Fill'), q2 = find('q2Fill')
  const outTrace = find('outTrace'), outDot = find('outDot'), outEdge = find('outEdge'), outGuide = find('outGuide'), outReading = find('outReading'), outClip = find('outClip')
  const cone = find('cone'), cap = find('cap'), coil = find.all('speakerCoil')
  const heat1 = find.all('heat1'), heat2 = find.all('heat2')
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
  function graph(table: Float64Array, limit: number, deg: number, x: (deg: number) => number, gy: VoltsY, parts: { trace: SVGElement; dot: SVGElement; edge: SVGElement; guide: SVGElement; clip: SVGElement }) {
    const y = gy(tableAt(table, deg))
    parts.trace.setAttribute('d', tracePath(table, Math.round(deg), x, gy))
    put(parts.dot, 'cx', x(deg)); put(parts.dot, 'cy', y)
    put(parts.edge, 'cy', y)
    put(parts.guide, 'x2', x(deg)); put(parts.guide, 'y1', y); put(parts.guide, 'y2', y)
    parts.clip.setAttribute('d', clippedPath(table, limit, deg, x, gy))
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

    // 1 · the sound moves the diaphragm and its coil; the coil's voltage between its two leads; on the wires, the hum (the EMI/RFI cloud over the cable stands still)
    for (const p of micAir) put(p.el, 'cx', clamp(p.x + swing(r, p.x - MIC_X), AIR1_X - 2, AIR1_X + AIR1_W + 2))
    const u = 0.5 * SWING * Math.sin(r)
    moveMicrophone(diaphragm, micCoil, u)
    lead2.setAttribute('d', `M${f(MIC_X + LEAD_2 + u)} ${LEAD_TOP} V395 H${PIN_X - 24} V${CY - PIN_GAP} H${PIN_X}`)
    lead3.setAttribute('d', `M${f(MIC_X + LEAD_3 + u)} ${LEAD_TOP} V407 H${PIN_X - 16} V${CY + PIN_GAP} H${PIN_X}`)
    inTrace.setAttribute('d', curvePath(whole, inX, inY))
    put(inDot, 'cx', inX(deg)); put(inDot, 'cy', inY(deg))
    inReading.textContent = signed(IN_PEAK * 1000 * Math.cos(r), 1)
    small(pre.pin2, deg, pinsX, PIN2_Y, pin2Trace, pin2Dot)
    small(pre.pin3, deg, pinsX, PIN3_Y, pin3Trace, pin3Dot)
    pin2Reading.textContent = signed(1000 * tableAt(pre.pin2, deg), 1)
    pin3Reading.textContent = signed(1000 * tableAt(pre.pin3, deg), 1)

    // 2 · the sides' charges, waiting; from 3 on they move (the chip draws a steady current, the transformer's transistor as much as it lets through)
    if (step >= 2) {
      const moved = step >= CHIP_STEP ? RAIL_GAPS * DOT_GAP * (chip ? deg / 360 : tableAt(pre.movedA, deg)) : 0
      place(PLUS, moved)
      // The transformer's one column joins −9 V at COL_T: nothing flows along it left of there
      place(MINUS, moved, (s) => offHop(s, PRE_HOP_S) && (chip || step < CHIP_STEP || s >= COL_T - COL_A))
    }
    if (step < CHIP_STEP) return

    // 3 · the difference: pin 2, pin 3 turned over, and the two added up; the transistors open as far as their currents; the output's height
    diff2.setAttribute("d", mvPath(pre.pin2, whole, diffX, DIFF_Y))
    diff3.setAttribute('d', mvPath(pre.pin3, whole, diffX, DIFF_Y, -1))
    small(pre.diff, deg, diffX, DIFF_Y, diffTrace, diffDot)
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

    // 3 · that height over time: the line out
    if (step >= GAIN_STEP) {
      graph(pre.out, PRE_SWING, deg, lineX, lineGy, { trace: lineTrace, dot: lineDot, edge: lineEdge, guide: lineGuide, clip: lineClip })
      lineReading.textContent = signed(line, 2)
    }
    if (step < POWER_STEP) return

    // 4 · the two transistors open as far as their currents; the charges on their wires; the speaker's voltage; its cone and the air before it
    const mean = meansOf(amp), out = tableAt(amp.out, deg)
    place(UPPER, gapsFor(mean.upper) * DOT_GAP * tableAt(amp.upperMoved, deg))
    place(LOWER, gapsFor(mean.lower) * DOT_GAP * tableAt(amp.lowerMoved, deg), (s) => offHop(s, AMP_HOP_S))
    const pulsed = amp.cls === 'd'
    place(SPEAKER, SPEAKER_TO_AND_FRO * tableAt(amp.speakerMoved, deg), (s) => offHop(s, SPEAKER_HOP_S) && (!pulsed || offCoil(s)))
    if (pulsed) {
      // Class D: a switch, fully on or fully off
      const on = amp.switched[Math.min(SAMPLES, Math.round(deg * 2))]
      q1.setAttribute('fill-opacity', on > 0 ? '0.66' : '0.06')
      q2.setAttribute('fill-opacity', on < 0 ? '0.66' : '0.06')
    } else {
      q1.setAttribute('fill-opacity', (0.06 + (0.6 * tableAt(amp.upper, deg)) / PEAK_CURRENT).toFixed(3))
      q2.setAttribute('fill-opacity', (0.06 + (0.6 * tableAt(amp.lower, deg)) / PEAK_CURRENT).toFixed(3))
    }
    graph(amp.out, SWING_MAX, deg, outX, outGy, { trace: outTrace, dot: outDot, edge: outEdge, guide: outGuide, clip: outClip })
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

    // 5 · the heat each transistor gives, rising off its heat sink
    if (step >= CLASS_STEP) {
      const rise = (((2 * deg) / 360) * HEAT_WAVE) % HEAT_WAVE
      const show = (waves: SVGElement[], y: number, watts: number) => waves.forEach((w, i) => {
        w.setAttribute('opacity', Math.min(1, 0.04 + watts / HEAT_FULL).toFixed(3))
        w.setAttribute('transform', `translate(${SINK_X + HEAT_XS[i]} ${f(y - SINK_H / 2 - 4 - rise)})`)
      })
      show(heat1, Q1_Y, tableAt(amp.upperHeat, deg))
      show(heat2, Q2_Y, tableAt(amp.lowerHeat, deg))
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
  const input = inputOf(shapes), cls = classOf(shapes)
  const { pre, amp } = chainAt(step, shapes, gain, volume)
  const chip = input === 'chip'
  const shownGain = gainAt(step, gain)
  const line = levelsOf(pre.out)
  const mic = healthOfLevels(MIC_LEVELS.rms, MIC_LEVELS.peak), lineHealth = healthOfLevels(line.rms, line.peak)
  const lineGhost = tracePath(pre.out, 360, lineX, lineGy), outGhost = tracePath(amp.out, 360, outX, outGy)
  const atClasses = step >= CLASS_STEP
  /** Class D, from the classes' step: its pulses and its filter */
  const pulsed = atClasses && cls === 'd'
  /** Each pulse a box from 0 V to the side it is switched to, as wide as it lasts */
  let pulsesPath = ''
  if (pulsed) {
    for (let from = 0, i = 1; i <= SAMPLES; i++) {
      if (i < SAMPLES && amp.pulses[i] === amp.pulses[from]) continue
      pulsesPath += `M${outX(from / 2).toFixed(1)} ${OUT_MID} V${outGy(amp.pulses[from])} H${outX(i / 2).toFixed(1)} V${OUT_MID} Z `
      from = i
    }
  }
  const power = atClasses ? powersOf(amp) : null
  const harmonics = atClasses ? harmonicsOf(amp.out) : []
  const watts = (w: number, digits = 1) => fmt(l.watts, { w: w.toFixed(digits) })
  const bars = power ? [
    { name: l.fromMicrophone, w: power.microphone, colour: TRACE, digits: 9 },
    { name: l.fromSupply, w: power.supply, colour: PART, digits: 1 },
    { name: l.intoSpeaker, w: power.speaker, colour: TRACE, digits: 1 },
    { name: l.heat, w: power.heat, colour: FLOW, digits: 1 },
  ] : []
  const bar = (x: number) => x - BASE_GAP
  const gainText = `+${shownGain} ${l.db}`
  const knobText = chip ? `${gainText} · ${fmt(l.rg, { r: ohmsText(gainResistor(shownGain), l, fmt) })}` : gainText
  /** The transformer input's gain wiper: the knob's place along its resistor */
  const gainWiperY = GPOT_BOTTOM - ((GPOT_BOTTOM - GPOT_TOP) * (shownGain - GAIN_MIN)) / (GAIN_MAX - GAIN_MIN)
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

        {/* An XLR at each end: pin 2 and pin 3 the microphone's two sides, pin 1 the shield */}
        <Xlr x={XLR_X} pins={[['2', CY - PIN_GAP], ['1', CY], ['3', CY + PIN_GAP]]} pinX={PIN_X} />
        <Xlr x={XLR2_X} pins={[['2', CY - PIN_GAP], ['1', CY], ['3', CY + PIN_GAP]]} pinX={PIN2_X} />
        <Label at={[XLR_X + XLR_W / 2, CY + 52]} anchor="middle">{l.xlr}</Label>
        <Label at={[XLR2_X + XLR_W / 2, CY + 52]} anchor="middle">{l.xlr}</Label>

        {/* The cable: its shield (pin 1) to 0 V, its two wires */}
        <rect x={CABLE_X} y={CY - CABLE_HALF} width={CABLE_END - CABLE_X} height={2 * CABLE_HALF} rx={12} fill="none" stroke={PART} strokeWidth={2} />
        <path d={`M${PIN_X} ${CY} H${CABLE_X} M${CABLE_END} ${CY} H${PIN2_X}`} {...THIN} />
        {/* The two wires twisted round each other — straight into each XLR; where one passes in front, a gap cut round it */}
        <g>
          <path d={`M${PIN_X} ${WIRE_2} H${TWIST_FROM} M${TWIST_TO} ${WIRE_2} H${PIN2_X} M${PIN_X} ${WIRE_3} H${TWIST_FROM} M${TWIST_TO} ${WIRE_3} H${PIN2_X}`} {...WIRE} />
          <path d={PIN2_TWIST.back + PIN3_TWIST.back} {...WIRE} />
          <path d={PIN2_TWIST.front + PIN3_TWIST.front} fill="none" stroke="var(--lsc-canvas)" strokeWidth={7} />
          <path d={PIN2_TWIST.front + PIN3_TWIST.front} {...WIRE} />
        </g>
        {/* The shield to 0 V at the preamp's end, from pin 1 */}
        <path d={`M${PIN2_X} ${CY} H${SHIELD_X} V${SHIELD_Y}`} {...THIN} />
        <Ground x={SHIELD_X} y={SHIELD_Y} />
        <Label at={[SHIELD_X - 16, SHIELD_Y + 12]} anchor="end">{l.zeroV}</Label>

        {/* The noise getting onto the cable: a still, dim cloud over it — the wires show through —, named above it; the teacher says where it comes from */}
        <g fill={PART} opacity={0.3}>
          {NOISE_PUFFS.map(([dx, dy, rr]) => <circle key={`${dx} ${dy}`} cx={NOISE_X + dx} cy={NOISE_Y + dy} r={rr} />)}
        </g>
        <Label at={[NOISE_X, NOISE_TOP - 10]} anchor="middle">{l.noise}</Label>

        {/* What each wire carries, with the noise on it */}
        <PinGraph y={PIN2_Y} name={l.pin2} reading="pin2Reading" trace="pin2Trace" dot="pin2Dot" mv={l.mv} table={pre.pin2} />
        <PinGraph y={PIN3_Y} name={l.pin3} reading="pin3Reading" trace="pin3Trace" dot="pin3Dot" mv={l.mv} table={pre.pin3} />
        <Leader x1={LEADER_X} y1={PIN2_Y + PINS_HALF} x2={LEADER_X} y2={WIRE_2 - 3} />
        <Leader x1={LEADER_X} y1={PIN3_Y - PINS_HALF} x2={LEADER_X} y2={WIRE_3 + 3} />
      </Step>

      {/* 2 · the preamp's power supply, above it: from the wall, two steady sides dropping straight down —
          +9 V at its left onto a line along the stage's top, −9 V at its right, past the line out, onto one along its bottom */}
      <Step n={2} step={step}>
        <PowerSupply left={PRE_PSU_L} rail={PRE_RAIL} zeroX={(PRE_PLUS_X + PRE_MINUS_X) / 2} />
        {/* −9 V reaches as far left as the first column on it: the chip's first transistor, or the transformer input's one */}
        <path d={`M${PRE_PLUS_X} ${PSU_BOTTOM} V${P9} M${PLUS_X} ${P9} H${LINE_X} M${chip ? COL_A : COL_T} ${M9} H${PRE_MINUS_X} V${PSU_BOTTOM}`} {...WIRE} />
        <circle cx={PRE_PLUS_X} cy={P9} r={4} fill={INK} />
        <Label at={[PRE_PLUS_X - 8, PSU_BOTTOM + 20]} anchor="end">{l.plus9}</Label>
        <Label at={[PRE_MINUS_X + 8, PSU_BOTTOM + 20]}>{l.minus9}</Label>
        <Step n={2} until={2} step={step}>
          {/* Its rows (the locale's line breaks), clear of the − side's wire right of it */}
          <Label at={[PLUS_X, P9 + 24]}>
            {l.waiting.split('\n').map((row, i) => <tspan key={i} x={PLUS_X} dy={i ? 19 : 0}>{row}</tspan>)}
          </Label>
        </Step>
        <Dots name="plusDots" wire={PLUS_WIRE} />
        <Dots name="minusDots" wire={MINUS_WIRE} />
      </Step>

      {/* 3 · the difference, above the chip: pin 2, pin 3 turned over, the two added up */}
      <Step n={CHIP_STEP} step={step}>
        <rect x={DIFF_X} y={DIFF_Y - PINS_HALF} width={DIFF_W} height={2 * PINS_HALF} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
        <line x1={DIFF_SCOPE_X - 4} y1={DIFF_Y} x2={DIFF_SCOPE_X + SCOPE_W + 4} y2={DIFF_Y} stroke={PART} strokeWidth={0.75} />
        <path data-p="diff2" fill="none" stroke={PART_2} strokeWidth={1.5} />
        <path data-p="diff3" fill="none" stroke={PART_2} strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={mvPath(pre.diff, 360, diffX, DIFF_Y)} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
        <path data-p="diffTrace" fill="none" stroke={TRACE} strokeWidth={3} strokeLinecap="round" />
        <circle data-p="diffDot" r={5} fill={MOVER} />
        <Leader x1={chip ? DIFF_LEADER_X : COIL_1 + 20} y1={DIFF_Y + PINS_HALF} x2={chip ? DIFF_LEADER_X : COIL_1 + 20} y2={chip ? BOX_TOP : CY - 60} />

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
          {/* Pin 2 into the first transistor; pin 3 — hopping over the shield's 0 V — under it, hopping over its column, into the second */}
          <path d={`M${PIN2_X} ${WIRE_2} H${CHIP_X + 15} V${Q_Y} H${bar(COL_A)}`} {...WIRE} />
          <path d={`M${PIN2_X} ${WIRE_3} H${SHIELD_X - HOP} a${HOP} ${HOP} 0 0 1 ${2 * HOP} 0 H${CHIP_X + 20} V${PIN3_RUN} H${COL_A - HOP} a${HOP} ${HOP} 0 0 1 ${2 * HOP} 0 H${PIN3_UP} V${Q_Y} H${bar(COL_B)}`} {...WIRE} />
          <path d={`M${BOX_R} ${(BOX_TOP + BOX_BOTTOM) / 2} H${OUT_TURN} V${CY} H${PRE_MINUS_X - HOP} a${HOP} ${HOP} 0 0 1 ${2 * HOP} 0 H${LINE_G_X + LINE_W}`} {...THIN} />
          <Dots name="columnADots" wire={COLUMN_A} />
          <Dots name="columnBDots" wire={COLUMN_B} />
          <Dots name="gainDots" wire={GAIN_WIRE} />
          <Label at={[CHIP_X + 8, CHIP_BOTTOM + 30]}>{l.preampChip}</Label>
        </g>

        {/* The transformer input in its place: its two coils on one core; the gain knob a resistor from the
            second coil to 0 V, its wiper into one transistor's base; a resistor above it, and below it only
            what keeps its resting current — a resistor with a capacitor across it — so nothing straightens its curve */}
        <g style={shown(!chip)}>
          <path d={`M${PIN2_X} ${WIRE_2} H${COIL_1 - 12} V${CY - 42} H${COIL_1} M${PIN2_X} ${WIRE_3} H${SHIELD_X - HOP} a${HOP} ${HOP} 0 0 1 ${2 * HOP} 0 H${COIL_1 - 12} V${CY + 42} H${COIL_1}`} {...WIRE} />
          <path d={coilPath(COIL_1, CY - 42, CY + 42, 1)} {...WIRE} />
          <path d={`M${COIL_1 + 18} ${CY - 56} V${CY + 56} M${COIL_1 + 22} ${CY - 56} V${CY + 56}`} stroke={PART} strokeWidth={2} />
          <path d={coilPath(COIL_2, COIL_2_TOP, COIL_2_BOTTOM, -1)} {...WIRE} />
          <path d={`M${COIL_2} ${COIL_2_TOP} H${GPOT_X} V${GPOT_TOP} M${GPOT_X} ${GPOT_BOTTOM} V${GPOT_BOTTOM + 16} H${COIL_2} M${COIL_2} ${COIL_2_BOTTOM} V${GPOT_BOTTOM + 22}`} {...WIRE} />
          <path d={resistorPath(GPOT_X, GPOT_TOP, GPOT_BOTTOM)} {...WIRE} strokeLinejoin="round" />
          <Ground x={COIL_2} y={GPOT_BOTTOM + 22} />
          <line x1={GWIPER_X} y1={gainWiperY} x2={GPOT_X + 12} y2={gainWiperY} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
          <path d={`M${GWIPER_X} ${gainWiperY} V${QT_Y} H${bar(COL_T)}`} {...WIRE} />
          <path d={`M${COL_T} ${P9} V${RC_TOP} M${COL_T} ${RC_BOTTOM} V${NODE_T}`} {...WIRE} />
          <path d={resistorPath(COL_T, RC_TOP, RC_BOTTOM)} {...WIRE} strokeLinejoin="round" />
          <path d={transistorLeads(COL_T, QT_Y, NODE_T, RE_TOP)} {...WIRE} />
          <Transistor x={COL_T} y={QT_Y} fill="qTFill" pnp={false} />
          <path d={`${resistorPath(COL_T, RE_TOP, RE_BOTTOM)} V${M9}`} {...WIRE} strokeLinejoin="round" />
          <path d={`M${COL_T} ${RE_TOP - 6} H${CAP_X} V${CAP_Y - 4} M${CAP_X - 12} ${CAP_Y - 4} H${CAP_X + 12} M${CAP_X - 12} ${CAP_Y + 4} H${CAP_X + 12} M${CAP_X} ${CAP_Y + 4} V${RE_BOTTOM + 8} H${COL_T}`} {...WIRE} />
          <circle cx={COL_T} cy={NODE_T} r={4} fill={INK} />
          <path d={`M${COL_T} ${NODE_T} H${OUT_TURN} V${CY} H${PRE_MINUS_X - HOP} a${HOP} ${HOP} 0 0 1 ${2 * HOP} 0 H${LINE_G_X + LINE_W}`} {...THIN} />
          <Label at={[COL_T + 18, (RC_TOP + RC_BOTTOM) / 2 + 4]}>{l.resistor}</Label>
          <Label at={[CAP_X + 18, CAP_Y + 4]}>{l.capacitor}</Label>
          <Label at={[COL_T + 30, QT_Y - 28]}>{l.transistor}</Label>
          <Label at={[TR_LABEL_X, CHIP_BOTTOM + 26]}>{l.inputTransformer}</Label>
          <Label at={[TR_LABEL_X, CHIP_BOTTOM + 43]}>{l.noPower}</Label>
          <Dots name="columnTDots" wire={COLUMN_T} />
        </g>

      </Step>

      {/* 3 · that height over time, below the picture — the line out, judged as the desk would — and the gain knob */}
      <Step n={GAIN_STEP} step={step}>
        <OverTime x={LINE_G_X} w={LINE_W} rail={PRE_RAIL} scope={lineX} gy={lineGy} parts="line" clipAt={PRE_SWING} ghost={lineGhost} band={LINE_TOP} />
        {/* Line level, the green band (the canvas's good: up to an average of 0 dBu); the headroom above it, up to the clipping line */}
        <path d={`M${LINE_G_X - 4} ${lineGy(PRE_SWING)} H${ROOM_X} V${lineGy(LINE_TOP)} H${LINE_G_X - 4}`} fill="none" stroke={PART} strokeWidth={1.5} />
        <Label at={[ROOM_X - 8, (lineGy(PRE_SWING) + lineGy(LINE_TOP)) / 2 + 4]} anchor="end">{l.headroom}</Label>
        {/* On two rows, clear of the − side's wire left of it */}
        <Label at={[ROOM_X - 8, LINE_MID - 5]} anchor="end">
          {l.lineLevel.split(' ').map((word, i) => <tspan key={i} x={ROOM_X - 8} dy={i ? 18 : 0}>{word}</tspan>)}
        </Label>
        <Label at={[LINE_G_X + LINE_W + 6, lineGy(PRE_SWING) + 4]}>{`+${CLIP_DBU} dBu`}</Label>
        <LevelMeter x={LINE_G_X + LINE_W - 28} y={lineGy(PRE_RAIL) + 10} w={14} h={2 * PRE_RAIL * G_PX_V - 20} rms={line.rms} peak={line.peak} />
        <Label at={[LINE_G_X, lineGy(PRE_RAIL) - 6]}>{l.lineOutReading}</Label>
        <text className="lsc-dd-reading" x={LINE_G_X} y={lineGy(-PRE_RAIL) + 20}>
          <tspan data-p="lineReading">+1.00</tspan> {l.volts}
        </text>
        <text className="lsc-dd-reading" x={LINE_G_X + LINE_W} y={lineGy(-PRE_RAIL) + 20} textAnchor="end">
          {formatDb(line.rms)} · <tspan style={{ fill: lineHealth.colour, fontWeight: 600 }}>{t.health[lineHealth.health]}</tspan>
        </text>

        {/* The gain knob, under the chip: a leader up to the resistor it turns — between the chip's two transistors, or the transformer input's before its transistor —, its words under it */}
        <Leader x1={chip ? KNOB_X : KNOB_T_X} y1={KNOB_Y - KNOB_R - 3} x2={chip ? KNOB_X : KNOB_T_X} y2={chip ? E_Y + 13 : GPOT_BOTTOM + 4} />
        <SceneKnob
          cx={chip ? KNOB_X : KNOB_T_X} cy={KNOB_Y} r={KNOB_R} color="var(--lsc-accent)"
          value={gain} min={GAIN_MIN} max={GAIN_MAX} round={gainOf} onChange={setGain}
          label={l.gainKnob} valueText={gainText}
        />
        <Label at={[chip ? KNOB_X : KNOB_T_X, KNOB_Y + KNOB_R + 24]} anchor="middle">{l.gainKnob}</Label>
        <Label at={[chip ? KNOB_X : KNOB_T_X, KNOB_Y + KNOB_R + 44]} anchor="middle">{knobText}</Label>
      </Step>

      {/* 4 · its own power supply above it; the Volume, the voltage 10 times bigger; two transistors between the ±12 V sides, one pushing, one pulling; the speaker */}
      <Step n={POWER_STEP} step={step}>
        <PowerSupply left={AMP_PSU_L} rail={RAIL} zeroX={AMP_PLUS_X + 30} />
        <path d={`M${AMP_PLUS_X} ${PSU_BOTTOM} V${P12} H${OUT_X} M${COL2} ${M12} H${AMP_MINUS_X} V${PSU_BOTTOM}`} {...WIRE} />
        <circle cx={AMP_PLUS_X} cy={P12} r={4} fill={INK} />
        <Label at={[AMP_PLUS_X - 8, PSU_BOTTOM + 22]} anchor="end">{l.plus12}</Label>
        <Label at={[AMP_MINUS_X + 8, PSU_BOTTOM + 22]}>{l.minus12}</Label>
        <Dots name="upperDots" wire={UPPER_WIRE} />
        <Dots name="lowerDots" wire={LOWER_WIRE} />

        {/* The Volume: the line on from over its graph, across a resistor to 0 V, the wiper taking what the knob says */}
        <path d={`M${LINE_G_X + LINE_W} ${CY} H${POT_X - 35} V${POT_TOP - 10} H${POT_X} V${POT_TOP} M${POT_X} ${POT_BOTTOM} V${POT_BOTTOM + 14}`} {...THIN} />
        <path d={resistorPath(POT_X, POT_TOP, POT_BOTTOM)} {...THIN} strokeLinejoin="round" />
        <Ground x={POT_X} y={POT_BOTTOM + 14} />
        <line x1={WIPER_X} y1={wiperY} x2={POT_X + 12} y2={wiperY} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
        <path d={`M${WIPER_X} ${wiperY} V${CY} H${TRI_X}`} {...THIN} />
        <Leader x1={VOL_X} y1={VOL_Y - VOL_R - 3} x2={POT_X + 8} y2={POT_BOTTOM - 6} />
        <SceneKnob
          cx={VOL_X} cy={VOL_Y} r={VOL_R} color="var(--lsc-accent)"
          value={volume} min={VOLUME_OFF} max={VOLUME_FULL} round={volumeOf} onChange={setVolume}
          label={l.volume} valueText={volumeText}
        />
        <Label at={[VOL_X + VOL_R + 6, VOL_Y - 6]}>{l.volume}</Label>
        <Label at={[VOL_X + VOL_R + 6, VOL_Y + 15]}>{volumeText}</Label>

        <path d={`M${TRI_TIP} ${CY} H${DRIVE_X} M${DRIVE_X} ${Q1_Y} H${bar(COL2)} M${DRIVE_X} ${Q2_Y} H${bar(COL2)} M${DRIVE_X} ${Q1_Y} V${Q2_Y}`} {...THIN} />
        {/* × 10: a triangle; class D's a box turning the signal into pulses, both switches driven by them */}
        <path d={`M${TRI_X} ${CY - TRI_HALF} L${TRI_TIP} ${CY} L${TRI_X} ${CY + TRI_HALF} Z`} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={2} strokeLinejoin="round" style={shown(!pulsed)} />
        <g style={shown(pulsed)}>
          <rect x={TRI_X} y={CY - TRI_HALF} width={TRI_TIP - TRI_X} height={2 * TRI_HALF} rx={6} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={2} />
          <path d={`M${TRI_X + 8} ${CY + 10} H${TRI_X + 14} V${CY - 10} H${TRI_X + 18} V${CY + 10} H${TRI_X + 26} V${CY - 10} H${TRI_X + 36} V${CY + 10} H${TRI_X + 40} V${CY - 10} H${TRI_X + 46} V${CY + 10} H${TRI_TIP - 8}`} fill="none" stroke={INK} strokeWidth={1.5} />
          <Label at={[(TRI_X + TRI_TIP) / 2, CY + TRI_HALF + 18]} anchor="middle">{l.intoPulses}</Label>
        </g>
        <Label at={[(TRI_X + TRI_TIP) / 2, CY - TRI_HALF - 32]} anchor="middle">{fmt(l.voltageGain, { gain: String(Math.round(GAIN)) })}</Label>
        <Label at={[(TRI_X + TRI_TIP) / 2, CY - TRI_HALF - 12]} anchor="middle">+{Math.round(GAIN_DB)} {l.db}</Label>

        <path d={transistorLeads(COL2, Q1_Y, P12, CY)} {...WIRE} />
        <path d={transistorLeads(COL2, Q2_Y, CY, M12)} {...WIRE} />
        <Transistor x={COL2} y={Q1_Y} fill="q1Fill" pnp={false} />
        <Transistor x={COL2} y={Q2_Y} fill="q2Fill" pnp />
        <Label at={[COL2, P12 - 8]} anchor="middle">{l.pushes}</Label>
        <Label at={[COL2, M12 + 18]} anchor="middle">{l.pulls}</Label>
        <circle cx={COL2} cy={CY} r={4} fill={INK} />
        <Dots name="speakerDots" wire={SPEAKER_WIRE} />

        {/* The speaker's voltage over time, under the speaker cable */}
        <OverTime x={OUT_G_X} w={OUT_W} rail={RAIL} scope={outX} gy={outGy} parts="out" clipAt={SWING_MAX} ghost={outGhost} />
        <Label at={[OUT_G_X + OUT_W / 2, outGy(RAIL) - 8]} anchor="middle">{l.toSpeaker}</Label>
        <text className="lsc-dd-reading" x={OUT_G_X} y={outGy(-RAIL) + 20}>
          <tspan data-p="outReading">+10.0</tspan> {l.volts}
        </text>

        {/* The speaker cable: + the output, − back to 0 V at the amplifier's end; a speakON at each end (drawn as an XLR) */}
        <Xlr x={SPK_PLUG_1} w={SPK_PLUG_W} pins={[['+', CY], ['−', RETURN_Y]]} pinX={SPK_PIN_1} above />
        <Xlr x={SPK_PLUG_2} w={SPK_PLUG_W} pins={[['+', CY], ['−', RETURN_Y]]} pinX={SPK_PIN_2} above />
        <Label at={[SPK_PLUG_1 + SPK_PLUG_W / 2, RETURN_Y + 38]} anchor="middle">{l.speakon}</Label>
        <Label at={[SPK_PLUG_2 + SPK_PLUG_W / 2, RETURN_Y + 38]} anchor="middle">{l.speakon}</Label>
        <rect x={SPK_PLUG_1 + SPK_PLUG_W} y={CY - 12} width={SPK_CABLE_END - SPK_PLUG_1 - SPK_PLUG_W} height={RETURN_Y - CY + 24} rx={10} fill="none" stroke={PART} strokeWidth={2} />
        <path d={`M${COL2} ${CY} ${pulsed ? `H${FCOIL_FROM} ${coilAcross(FCOIL_FROM, FCOIL_TO)}` : ''} H${AMP_MINUS_X - HOP} a${HOP} ${HOP} 0 0 1 ${2 * HOP} 0 H${LEAD_B} V${SPK_Y}`} {...THIN} />
        {/* Class D's filter: the coil on the line, a capacitor from it to 0 V */}
        <g style={shown(pulsed)}>
          <path d={`M${FCAP_X} ${CY} V${FCAP_Y - 3} M${FCAP_X - 10} ${FCAP_Y - 3} H${FCAP_X + 10} M${FCAP_X - 10} ${FCAP_Y + 3} H${FCAP_X + 10} M${FCAP_X} ${FCAP_Y + 3} V${FCAP_Y + 12}`} {...THIN} />
          <circle cx={FCAP_X} cy={CY} r={3} fill={INK} />
          <Ground x={FCAP_X} y={FCAP_Y + 12} />
          <Label at={[(FCOIL_FROM + FCOIL_TO) / 2, CY - 18]} anchor="middle">{l.filter}</Label>
        </g>
        <path d={`M${LEAD_A} ${SPK_Y} V${RETURN_Y} H${SPK_PIN_1} H${AMP_GROUND_X} V${GROUND_Y}`} {...THIN} />
        <Ground x={AMP_GROUND_X} y={GROUND_Y} />
        <Label at={[AMP_GROUND_X + 18, GROUND_Y + 12]}>{l.zeroV}</Label>
        <Speaker />
        <Air id="lsc-dd-air-amp" x={AIR_X} y={AIR_Y} w={AIR_W} h={AIR_H} r={55} />
        <g data-p="air" mask="url(#lsc-dd-air-amp)" />
        <Label at={[AIR_X + 36, AIR_Y + AIR_H + 22]} anchor="middle" flow>{l.soundWave}</Label>
        <line x1={AIR_X + 84} y1={AIR_Y + AIR_H + 18} x2={AIR_X + 114} y2={AIR_Y + AIR_H + 18} stroke={FLOW} strokeWidth={2} markerEnd={ARROW} />
      </Step>

      {/* 5 · the classes: the heat, where the power goes, the sines in the output */}
      <Step n={CLASS_STEP} step={step}>
        <HeatSink y={Q1_Y} waves="heat1" />
        <HeatSink y={Q2_Y} waves="heat2" />
        <Label at={[SINK_X + SINK_W / 2, Q2_Y + SINK_H / 2 + 16]} anchor="middle">{l.heatSink}</Label>

        {/* Class D: the pulses between the two switches behind the speaker's voltage, the filter's smoothing of them */}
        <g style={shown(pulsed)}>
          <path d={pulsesPath} fill={PART_2} fillOpacity={0.22} stroke={PART_2} strokeWidth={1} />
          <Legend x={D_KEY_X} y={D_KEY_Y} line={<rect y={-5} width={18} height={10} fill={PART_2} fillOpacity={0.22} stroke={PART_2} strokeWidth={1} />}>{l.pulses}</Legend>
          <Legend x={D_KEY_X} y={D_KEY_Y + 20} line={<line x2={18} stroke={TRACE} strokeWidth={3} />}>{l.afterFilter}</Legend>
          <Label at={[D_KEY_X, D_KEY_Y + 42]}>{l.pulseRate}</Label>
        </g>

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
            <Label at={[POWER_X, PANEL_Y + 160]}>{fmt(l.reaches, { pct: String(Math.round((100 * power.speaker) / power.supply)) })}</Label>
            <Label at={[POWER_X, PANEL_Y + 180]}>
              {fmt(l.silentHeat, { w: power.silentHeat.toFixed(1) })}{cls === 'd' ? '' : ` · ${fmt(l.restingCurrent, { a: `${RESTING[cls].toFixed(2)} ${l.amps}` })}`}
            </Label>

            <Label at={[HARM_X, HARM_Y]}>{l.harmonics}</Label>
            <text className="lsc-dd-reading" x={HARM_X} y={HARM_Y + 22}>
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

/**
 * An output's height over time, under its wire: its panel between its two sides (`rail`, `gy`: its
 * heights), its graph (`scope`), the clipping lines (`clipAt`), the ghost of the cycle, a green band (`band`: line level's); the painter's parts
 * (Trace, Dot, Edge — the height at its left edge —, Guide, Clip) named after `parts`
 */
function OverTime({ x, w, rail, scope, gy, parts, clipAt, ghost, band }: {
  x: number; w: number; rail: number; scope: (deg: number) => number; gy: VoltsY; parts: string; clipAt: number; ghost: string; band?: number
}) {
  const mid = gy(0)
  return (
    <>
      <rect x={x} y={gy(rail)} width={w} height={2 * rail * G_PX_V} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
      {band !== undefined && <rect x={x + 1} y={gy(band)} width={w - 2} height={2 * band * G_PX_V} fill="var(--signal-good)" opacity={0.2} />}
      <line x1={x} y1={gy(rail)} x2={x} y2={gy(-rail)} stroke={PART} strokeWidth={1.5} />
      <Scope x={scope} top={gy(rail) + 6} bottom={gy(-rail) - 6} mid={mid} />
      <g stroke="var(--signal-clipping)" strokeWidth={0.75} strokeDasharray="6 4" opacity={0.7}>
        <line x1={x} y1={gy(clipAt)} x2={x + w} y2={gy(clipAt)} />
        <line x1={x} y1={gy(-clipAt)} x2={x + w} y2={gy(-clipAt)} />
      </g>
      <line data-p={`${parts}Guide`} x1={x} y1={mid} x2={x} y2={mid} stroke={MOVER} strokeWidth={1} strokeDasharray="3 3" />
      <path d={ghost} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
      <path data-p={`${parts}Trace`} fill="none" stroke={TRACE} strokeWidth={3} strokeLinecap="round" />
      <path data-p={`${parts}Clip`} fill="none" stroke="var(--signal-clipping)" strokeWidth={4} strokeLinecap="round" />
      <circle data-p={`${parts}Dot`} r={6} fill={MOVER} />
      <circle data-p={`${parts}Edge`} cx={x} cy={mid} r={5} fill={MOVER} />
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

/**
 * A stage's power supply above it (PSU_W wide, from PSU_TOP to PSU_BOTTOM): its plug from the wall socket
 * on top, over the wall's voltage — 230 V, swinging both ways 50 times a second (two of its cycles,
 * still: they are not the sound's) —, an arrow, and what it gives: its two steady sides, `rail` volts
 * either side of 0 V. Its 0 V goes down to ground from its bottom at `zeroX`; its sides leave its bottom (the scene's)
 */
function PowerSupply({ left, rail, zeroX }: { left: number; rail: number; zeroX: number }) {
  const l = useTranslation().t.deepDive.labels
  const mid = PSU_TOP + 74, wallX = left + 14, wallW = 140, dcX = left + 190, dcW = 136, swing = 26, side = 22
  const plugX = wallX + wallW / 2, plugY = PSU_TOP - 22
  let wall = ''
  for (let x = 0; x <= wallW + 1e-9; x += 2) wall += `${wall ? ' L' : 'M'}${(wallX + x).toFixed(1)} ${(mid - swing * Math.sin((4 * Math.PI * x) / wallW)).toFixed(1)}`
  const volts = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(v)} ${l.volts}`
  return (
    <>
      <g transform={`rotate(90 ${plugX} ${plugY})`}>
        <path d={`M${plugX} ${plugY} h22`} fill="none" stroke={PART} strokeWidth={4} strokeLinecap="round" />
        <Plug x={plugX} y={plugY} />
      </g>
      <rect x={left} y={PSU_TOP} width={PSU_W} height={PSU_BOTTOM - PSU_TOP} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={2} />
      <Label at={[left + PSU_W / 2, PSU_TOP + 20]} anchor="middle">{l.powerSupply}</Label>
      {/* The wall's voltage over time */}
      <line x1={wallX} y1={mid} x2={wallX + wallW} y2={mid} stroke={FAINT} strokeWidth={1} strokeDasharray="3 4" />
      <path d={wall} {...WIRE} />
      <Label at={[wallX, PSU_TOP + 124]}>{l.mainsIn}</Label>
      <Label at={[wallX, PSU_TOP + 144]}>{l.mainsSwings}</Label>
      <line x1={left + 160} y1={mid} x2={dcX - 12} y2={mid} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
      {/* What it gives: two steady sides */}
      <line x1={dcX + 40} y1={mid} x2={dcX + dcW} y2={mid} stroke={FAINT} strokeWidth={1} strokeDasharray="3 4" />
      <path d={`M${dcX + 40} ${mid - side} H${dcX + dcW} M${dcX + 40} ${mid + side} H${dcX + dcW}`} {...WIRE} />
      <Label at={[dcX, mid - side + 4]}>{volts(rail)}</Label>
      <Label at={[dcX, mid + 4]}>{l.zeroV}</Label>
      <Label at={[dcX, mid + side + 4]}>{volts(-rail)}</Label>
      <Label at={[dcX, PSU_TOP + 124]}>{l.supplyOut}</Label>
      <Label at={[dcX, PSU_TOP + 144]}>{l.supplySteady}</Label>
      <path d={`M${zeroX} ${PSU_BOTTOM} V${PSU_BOTTOM + 6}`} {...THIN} />
      <Ground x={zeroX} y={PSU_BOTTOM + 6} />
      <Label at={[zeroX + 18, PSU_BOTTOM + 16]}>{l.zeroV}</Label>
    </>
  )
}

/**
 * An XLR (or a speakON) at x (`w` wide): its pins (name, height) at pinX — right of its middle, their names on their
 * left (the far end of a cable) —, `above` them where a wire runs through the plug
 */
function Xlr({ x, w = XLR_W, pins, pinX, above = false }: { x: number; w?: number; pins: readonly (readonly [string, number])[]; pinX: number; above?: boolean }) {
  const ys = pins.map(([, y]) => y), top = Math.min(...ys) - 18, bottom = Math.max(...ys) + 18
  const right = pinX > x + w / 2, side = right ? 1 : -1
  return (
    <>
      <rect x={x} y={top} width={w} height={bottom - top} rx={6} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1.5} />
      {pins.map(([n, y]) => (
        <g key={n}>
          <circle cx={pinX} cy={y} r={3} fill={INK} />
          <text className="lsc-dd-label" x={pinX - 7 * side} y={above ? y - 5 : y + 4} textAnchor={right ? 'end' : 'start'} style={{ fontSize: 14 }}>{n}</text>
        </g>
      ))}
    </>
  )
}

/** A coil on the line at CY, from `x0` to `x1`: its turns bulging up (path commands, no move) */
function coilAcross(x0: number, x1: number, turns = 4): string {
  const r = (x1 - x0) / (2 * turns)
  return Array.from({ length: turns }, () => `a${r} ${r} 0 0 1 ${2 * r} 0`).join(' ')
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
