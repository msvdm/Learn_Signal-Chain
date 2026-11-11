import { useMemo, useRef } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { formatDb } from '../../signal/levels'
import { GAIN_STEPS, IN_PEAK, LINE_GAIN, MIC_LEVELS, RAIL, RESTING, SAMPLES, SWING_MAX, levelsOf, preampCycle } from '../preamp'
import type { GainId, PreampCycle } from '../preamp'
import { ARROW_INK, FAINT, INK, MOVER, PART, TRACE } from './look'
import { curvePath, rad, tableAt } from '../wave'
import type { ShapeId } from '../subjects'
import { put, usePainter } from './painter'
import type { Finder, Painter, SceneProps } from './painter'
import { Label, Leader, Step } from './sceneParts'
import { Ground, LevelMeter, Plug, Transistor } from './circuitParts'
import { BASE_GAP, healthOfLevels, lengthOf, pointAlong, resistorPath, transistorLeads } from './circuit'
import type { Pt } from './circuit'

// Mic preamp (Deep dive, D46): the microphone's ±2 mV, far too weak for the desk (1); a power
// supply's ±9 V, steady, waiting (2); a transistor between the two sides — a small change at its
// base changes the current through it (3); a resistor above it turns the current's changes into a
// voltage, upside down: line level (4); the gain knob, the resistor under it, sets how much bigger —
// too little, line level, hot, clipping (5). The levels are judged as the canvas judges a signal
// (dBu, its health words and colours), so the picture says what a Preamp's meter would. The power
// supply stands on the left, its + side along the top and its − side along the bottom, both
// straight. The phase is the microphone's voltage, as in Magnetic induction: +2 mV at 0°. The
// numbers are preamp.ts's.

// ── Where things are, in the scene's units ──────────────────────────────────
/** The power supply: a tall box on the left, its + terminal at its top, 0 V in its middle, − at its bottom */
const PSU_X = -150, PSU_Y = 60, PSU_W = 120, PSU_H = 700
const PSU_RIGHT = PSU_X + PSU_W, PLUS_Y = 80, ZERO_Y = 410, MINUS_Y = 740
/** The microphone's panel: its frame, its graph's left edge and width, middle line and half height (2 mV); its meter */
const IN_X = 90, PANEL_W = 380, SCOPE_W = 290, IN_SCOPE_X = 110, IN_Y = 420, IN_H = 55
/** The transistor's column, its middle; the resistor above it, the output between them; the gain's resistor under it */
const COL_X = 652, Q_Y = 420, RC_TOP = 190, RC_BOTTOM = 290, NODE_Y = 350, RE_TOP = 530, RE_BOTTOM = 630
/** The output's panel: its frame, its graph's left edge, middle line, half height; where the line out ends */
const OUT_X = 760, OUT_SCOPE_X = 780, OUT_Y = 200, OUT_H = 70, LINE_END = 1180
/** The gain knob, left of its resistor */
const KNOB_X = 560, KNOB_Y = 580, KNOB_R = 16
/** The captions saying what a step does, right of the column */
const NOTE_X = 690, NOTE_Y = 500

const GAIN_STEP = 5

/** The charges on the transistor's wire, every DOT_GAP, moving DOT_GAPS spacings a cycle (the current's average, 1 mA, the same at every gain) */
const DOT_GAP = 26, DOT_GAPS = 4
/** The transistor's current, from the + side's terminal along the top, down the column, back along the bottom */
const LOOP: readonly Pt[] = [[PSU_RIGHT, PLUS_Y], [COL_X, PLUS_Y], [COL_X, MINUS_Y], [PSU_RIGHT, MINUS_Y]]
const LOOP_LEN = lengthOf(LOOP)
/** Before the transistor comes, only the sides' part of it is drawn */
const SIDE = COL_X - PSU_RIGHT, COLUMN = MINUS_Y - PLUS_Y

const inX = (deg: number) => IN_SCOPE_X + (SCOPE_W * deg) / 360
const inY = (deg: number) => IN_Y - IN_H * Math.cos(rad(deg))
const outX = (deg: number) => OUT_SCOPE_X + (SCOPE_W * deg) / 360
/** The output's graph spans ±1.5 V at line level (step 4), ±9 V — both sides — once the knob turns (5) */
const spanAt = (step: number) => (step >= GAIN_STEP ? RAIL : 1.5)
const outYAt = (step: number) => (volts: number) => OUT_Y - (OUT_H * volts) / spanAt(step)

/** The gain a step shows: line level, the knob's at the last step */
function gainAt(step: number, shape: ShapeId | undefined): number {
  const id = (step >= GAIN_STEP && shape && shape in GAIN_STEPS ? shape : LINE_GAIN) as GainId
  return GAIN_STEPS[id]
}

/** A reading's sign and digits (none shows as +0.00, never −0.00) */
function signed(value: number, digits: number): string {
  const shown = value.toFixed(digits)
  return Number(shown) < 0 ? `−${shown.slice(1)}` : `+${Number(shown) === 0 ? (0).toFixed(digits) : shown}`
}

/** The output's graph up to `to` degrees */
const tracePath = (table: Float64Array, to: number, y: (v: number) => number) => curvePath(to, outX, (deg) => y(tableAt(table, deg)))

/** The parts of the output's graph where the tops are cut off, up to `to` degrees */
function clippedPath(c: PreampCycle, to: number, y: (v: number) => number): string {
  let path = '', drawing = false
  for (let i = 0; i <= Math.min(SAMPLES, Math.round(to * 2)); i++) {
    if (Math.abs(c.wanted[i]) > SWING_MAX + 1e-9) {
      path += `${drawing ? ' L' : ' M'}${outX(i / 2).toFixed(1)} ${y(c.out[i]).toFixed(1)}`
      drawing = true
    } else drawing = false
  }
  return path
}

function makePainter(find: Finder): Painter {
  const inTrace = find('inTrace'), inDot = find('inDot'), inReading = find('inReading')
  const dots = find.all<SVGCircleElement>('dots'), q = find('qFill'), current = find('current')
  const outTrace = find('outTrace'), outDot = find('outDot'), outReading = find('outReading'), clipTrace = find('clipTrace')

  return (deg, step, shape) => {
    const c = preampCycle(gainAt(step, shape))

    // 1 · the microphone's voltage
    inTrace.setAttribute('d', curvePath(Math.round(deg), inX, inY))
    put(inDot, 'cx', inX(deg)); put(inDot, 'cy', inY(deg))
    inReading.textContent = signed(IN_PEAK * 1000 * Math.cos(rad(deg)), 2)

    // 2 · the sides' charges, waiting; from 3 on they move as the transistor's current says
    if (step >= 2) {
      const moved = step >= 3 ? DOT_GAPS * DOT_GAP * tableAt(c.moved, deg) : 0
      dots.forEach((dot, j) => {
        const s = (j * DOT_GAP + moved) % LOOP_LEN
        const [x, y] = pointAlong(LOOP, s)
        put(dot, 'cx', x); put(dot, 'cy', y)
        dot.style.display = step >= 3 || s <= SIDE || s >= SIDE + COLUMN ? '' : 'none'
      })
    }

    // 3 · the transistor opens as far as its current
    if (step >= 3) {
      const amps = tableAt(c.current, deg)
      q.setAttribute('fill-opacity', (0.06 + (0.6 * amps) / (2 * RESTING)).toFixed(3))
      current.textContent = (amps * 1000).toFixed(2)
    }

    // 4 · the output's voltage, upside down
    if (step >= 4) {
      const y = outYAt(step), out = tableAt(c.out, deg)
      outTrace.setAttribute('d', tracePath(c.out, Math.round(deg), y))
      put(outDot, 'cx', outX(deg)); put(outDot, 'cy', y(out))
      outReading.textContent = signed(out, 2)
      clipTrace.setAttribute('d', clippedPath(c, deg, y))
    }
  }
}

export function PreampScene({ step, shape, onPainter }: SceneProps) {
  const root = useRef<SVGGElement>(null)
  usePainter(root, onPainter, makePainter)
  const { t, fmt } = useTranslation()
  const l = t.deepDive.labels
  const gain = gainAt(step, shape)
  const c = preampCycle(gain)
  const y = outYAt(step), span = spanAt(step)
  const out = useMemo(() => levelsOf(c.out), [c])
  const ghost = useMemo(() => tracePath(c.out, 360, outYAt(step)), [c, step])
  const wanted = useMemo(() => (step >= GAIN_STEP ? tracePath(c.wanted, 360, outYAt(step)) : ''), [c, step])
  const mic = healthOfLevels(MIC_LEVELS.rms, MIC_LEVELS.peak), outHealth = healthOfLevels(out.rms, out.peak)
  const line = preampCycle(GAIN_STEPS[LINE_GAIN])
  const change = Math.max(...line.current) - RESTING
  const volts = (v: number) => `${v.toFixed(1)} ${l.volts}`
  // The knob's notch: from 7 o'clock (+10 dB) to 5 o'clock (+80 dB)
  const turn = rad(-225 + (270 * (gain - GAIN_STEPS.gain10)) / (GAIN_STEPS.gain80 - GAIN_STEPS.gain10))

  return (
    <g ref={root}>
      {/* 1 · the microphone's voltage, and its level as the desk would read it */}
      <Step n={1} step={step}>
        <rect x={IN_X} y={IN_Y - 78} width={PANEL_W} height={156} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
        <g stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4">
          {[90, 180, 270].map((deg) => <line key={deg} x1={inX(deg)} y1={IN_Y - 70} x2={inX(deg)} y2={IN_Y + 70} />)}
          <line x1={IN_SCOPE_X - 10} y1={IN_Y - IN_H} x2={IN_SCOPE_X + SCOPE_W + 10} y2={IN_Y - IN_H} />
          <line x1={IN_SCOPE_X - 10} y1={IN_Y + IN_H} x2={IN_SCOPE_X + SCOPE_W + 10} y2={IN_Y + IN_H} />
        </g>
        <line x1={IN_SCOPE_X - 10} y1={IN_Y} x2={IN_SCOPE_X + SCOPE_W + 10} y2={IN_Y} stroke={PART} strokeWidth={0.75} />
        <Label at={[IN_X + 12, IN_Y - 61]}>{l.fromMicrophone}</Label>
        <path d={curvePath(360, inX, inY)} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
        <path data-p="inTrace" fill="none" stroke={TRACE} strokeWidth={3} strokeLinecap="round" />
        <circle data-p="inDot" r={6} fill={MOVER} />
        <LevelMeter x={IN_X + PANEL_W - 38} y={IN_Y - 68} w={14} h={136} rms={MIC_LEVELS.rms} peak={MIC_LEVELS.peak} />
        <Label at={[IN_X - 6, IN_Y - IN_H + 4]} anchor="end">+2 {l.mv}</Label>
        <Label at={[IN_X - 6, IN_Y + 4]} anchor="end">0</Label>
        <Label at={[IN_X - 6, IN_Y + IN_H + 4]} anchor="end">−2 {l.mv}</Label>
        <text className="lsc-dd-reading" x={IN_X} y={IN_Y + 100}>
          {l.fromMicrophone}: <tspan data-p="inReading">+2.00</tspan> {l.mv}
        </text>
        <text className="lsc-dd-reading" x={IN_X} y={IN_Y + 122}>
          {formatDb(MIC_LEVELS.rms)} · <tspan style={{ fill: mic.colour, fontWeight: 600 }}>{t.health[mic.health]}</tspan>
        </text>
        <Label at={[IN_X, IN_Y + 144]}>{l.tooWeakForDesk}</Label>
      </Step>

      {/* 2 · the power supply: from the wall, its two sides straight along the top and the bottom */}
      <Step n={2} step={step}>
        <path d={`M${PSU_X - 60} ${ZERO_Y} H${PSU_X}`} fill="none" stroke={PART} strokeWidth={4} strokeLinecap="round" />
        <Plug x={PSU_X - 60} y={ZERO_Y} />
        <Label at={[PSU_X - 140, ZERO_Y - 30]}>{l.wallSocket}</Label>
        <rect x={PSU_X} y={PSU_Y} width={PSU_W} height={PSU_H} rx={10} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={2} />
        <text className="lsc-dd-reading" x={PSU_X + PSU_W / 2} y={ZERO_Y - 40} textAnchor="middle">{l.powerSupply}</text>
        <path d={`M${PSU_RIGHT} ${PLUS_Y} H${COL_X}`} fill="none" stroke={INK} strokeWidth={2} />
        <path d={`M${PSU_RIGHT} ${MINUS_Y} H${COL_X}`} fill="none" stroke={INK} strokeWidth={2} />
        <path d={`M${PSU_RIGHT} ${ZERO_Y} H${PSU_RIGHT + 20} V${ZERO_Y + 10}`} fill="none" stroke={INK} strokeWidth={1.5} />
        <Ground x={PSU_RIGHT + 20} y={ZERO_Y + 10} />
        <Label at={[PSU_RIGHT + 38, ZERO_Y + 24]}>{l.zeroV}</Label>
        <Label at={[PSU_RIGHT + 10, PLUS_Y - 10]}>{l.plus9}</Label>
        <Label at={[PSU_RIGHT + 10, MINUS_Y + 22]}>{l.minus9}</Label>
        <Label at={[(PSU_RIGHT + COL_X) / 2 + 40, PLUS_Y - 10]} anchor="middle">{l.waiting}</Label>
        <g data-p="dots" fill={MOVER}>
          {Array.from({ length: Math.floor(LOOP_LEN / DOT_GAP) }, (_, i) => <circle key={i} r={3} />)}
        </g>
      </Step>

      {/* 3 · a transistor between the two sides: a small change at its base changes the current through it */}
      <Step n={3} step={step}>
        <path d={`M${IN_X + PANEL_W} ${IN_Y} H${COL_X - BASE_GAP}`} fill="none" stroke={INK} strokeWidth={1.5} />
        <path d={`M${COL_X} ${PLUS_Y} V${RC_TOP} M${COL_X} ${RE_BOTTOM} V${MINUS_Y}`} fill="none" stroke={INK} strokeWidth={2} />
        <path d={transistorLeads(COL_X, Q_Y, RC_BOTTOM, RE_TOP)} fill="none" stroke={INK} strokeWidth={2} />
        <path d={resistorPath(COL_X, RE_TOP, RE_BOTTOM)} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <Step n={3} until={3} step={step}>
          <path d={`M${COL_X} ${RC_TOP} V${RC_BOTTOM}`} fill="none" stroke={INK} strokeWidth={2} />
        </Step>
        <Transistor x={COL_X} y={Q_Y} fill="qFill" pnp={false} />
        <Label at={[COL_X - 50, Q_Y - 46]} anchor="end">{l.transistor}</Label>
        <text className="lsc-dd-reading" x={NOTE_X} y={Q_Y + 26}>
          {l.throughIt}: <tspan data-p="current">1.00</tspan> {l.milliamps}
        </text>
        <Step n={3} until={3} step={step}>
          <Label at={[NOTE_X, NOTE_Y]}>
            {fmt(l.smallChange, { v: `${IN_PEAK * 1000} ${l.mv}`, i: `${(change * 1000).toFixed(2)} ${l.milliamps}` })}
          </Label>
        </Step>
      </Step>

      {/* 4 · a resistor above it: the current's changes become a voltage, upside down — the output */}
      <Step n={4} step={step}>
        <path d={resistorPath(COL_X, RC_TOP, RC_BOTTOM)} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <Label at={[COL_X - 20, (RC_TOP + RC_BOTTOM) / 2 + 4]} anchor="end">{l.resistor}</Label>
        <path d={`M${COL_X} ${NODE_Y} H${LINE_END}`} fill="none" stroke={INK} strokeWidth={1.5} />
        <circle cx={COL_X} cy={NODE_Y} r={4} fill={INK} />
        <circle cx={LINE_END} cy={NODE_Y} r={5} fill="var(--lsc-sunken)" stroke={INK} strokeWidth={1.5} />
        <Label at={[LINE_END + 12, NODE_Y + 4]}>{l.lineOut}</Label>

        <rect x={OUT_X} y={OUT_Y - 96} width={PANEL_W} height={192} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
        <clipPath id="lsc-dd-preamp-out"><rect x={OUT_X} y={OUT_Y - 96} width={PANEL_W} height={192} rx={8} /></clipPath>
        <g stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4">
          {[90, 180, 270].map((deg) => <line key={deg} x1={outX(deg)} y1={OUT_Y - 88} x2={outX(deg)} y2={OUT_Y + 88} />)}
        </g>
        <line x1={OUT_SCOPE_X - 10} y1={OUT_Y} x2={OUT_SCOPE_X + SCOPE_W + 10} y2={OUT_Y} stroke={PART} strokeWidth={0.75} />
        <Label at={[OUT_X + 12, OUT_Y - 78]}>{l.lineOutReading}</Label>
        <Label at={[OUT_X - 6, y(span) + 4]} anchor="end">+{volts(span)}</Label>
        <Label at={[OUT_X - 6, OUT_Y + 4]} anchor="end">0</Label>
        <Label at={[OUT_X - 6, y(-span) + 4]} anchor="end">−{volts(span)}</Label>
        {step >= GAIN_STEP && (
          <>
            <g stroke="var(--signal-clipping)" strokeWidth={0.75} strokeDasharray="6 4" opacity={0.7}>
              <line x1={OUT_SCOPE_X - 10} y1={y(SWING_MAX)} x2={OUT_SCOPE_X + SCOPE_W + 10} y2={y(SWING_MAX)} />
              <line x1={OUT_SCOPE_X - 10} y1={y(-SWING_MAX)} x2={OUT_SCOPE_X + SCOPE_W + 10} y2={y(-SWING_MAX)} />
            </g>
            {/* Above the panel: inside it the trace would run through it */}
            <line x1={OUT_X + PANEL_W - 24} y1={OUT_Y - 110} x2={OUT_X + PANEL_W}  y2={OUT_Y - 110} stroke="var(--signal-clipping)" strokeWidth={0.75} strokeDasharray="6 4" opacity={0.7} />
            <Label at={[OUT_X + PANEL_W - 30, OUT_Y - 106]} anchor="end">{l.clipAt}</Label>
            {wanted && <path d={wanted} clipPath="url(#lsc-dd-preamp-out)" fill="none" stroke={INK} strokeWidth={1.25} strokeDasharray="5 4" opacity={0.6} />}
          </>
        )}
        <path d={ghost} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
        <path data-p="outTrace" fill="none" stroke={TRACE} strokeWidth={3} strokeLinecap="round" />
        <path data-p="clipTrace" fill="none" stroke="var(--signal-clipping)" strokeWidth={4} strokeLinecap="round" />
        <circle data-p="outDot" r={6} fill={MOVER} />
        <LevelMeter x={OUT_X + PANEL_W - 38} y={OUT_Y - 86} w={14} h={172} rms={out.rms} peak={out.peak} />
        <text className="lsc-dd-reading" x={OUT_X} y={OUT_Y + 118}>
          {l.lineOutReading}: <tspan data-p="outReading">−1.00</tspan> {l.volts}
        </text>
        <text className="lsc-dd-reading" x={OUT_X + PANEL_W} y={OUT_Y + 118} textAnchor="end">
          {formatDb(out.rms)} · <tspan style={{ fill: outHealth.colour, fontWeight: 600 }}>{t.health[outHealth.health]}</tspan>
        </text>
        <Step n={4} until={4} step={step}>
          <Label at={[NOTE_X, NOTE_Y]}>{fmt(l.intoVoltage, { v: volts(Math.abs(line.out[0])) })}</Label>
          <Label at={[NOTE_X, NOTE_Y + 20]}>{l.upsideDown}</Label>
        </Step>
      </Step>

      {/* 5 · the gain knob: the resistor under the transistor, turned */}
      <Step n={GAIN_STEP} step={step}>
        <line x1={COL_X - 22} y1={RE_BOTTOM - 10} x2={COL_X + 24} y2={RE_TOP + 10} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
        <Leader x1={KNOB_X + KNOB_R + 2} y1={KNOB_Y} x2={COL_X - 14} y2={KNOB_Y} />
        <circle cx={KNOB_X} cy={KNOB_Y} r={KNOB_R} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={2} />
        <line x1={KNOB_X} y1={KNOB_Y} x2={(KNOB_X + (KNOB_R - 3) * Math.cos(turn)).toFixed(1)} y2={(KNOB_Y + (KNOB_R - 3) * Math.sin(turn)).toFixed(1)}
          stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
        <Label at={[KNOB_X, KNOB_Y + KNOB_R + 18]} anchor="middle">{l.gainKnob}</Label>
        <Label at={[KNOB_X, KNOB_Y + KNOB_R + 36]} anchor="middle">+{gain} {l.db}</Label>
        <Label at={[NOTE_X, NOTE_Y]}>{l.gainKnobNote}</Label>
      </Step>
    </g>
  )
}
