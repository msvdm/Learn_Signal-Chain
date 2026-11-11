import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { formatDb } from '../../signal/levels'
import { GAIN_MAX, GAIN_MIN, IN_PEAK, LINE_GAIN, MIC_LEVELS, RAIL, RESTING, SAMPLES, SWING_MAX, gainOf, levelsOf, preampCycle } from '../preamp'
import type { PreampCycle } from '../preamp'
import { ARROW_INK, FAINT, INK, MOVER, PART, TRACE } from './look'
import { KnobFace } from '../../components/controls/KnobFace'
import { takePress, usePointerDrag } from '../../hooks/usePointerDrag'
import { useLatestRef } from '../../hooks/useLatestRef'
import { curvePath, rad, tableAt } from '../wave'
import { put, usePainter } from './painter'
import type { Finder, Painter, SceneProps } from './painter'
import { Label, Leader, Step } from './sceneParts'
import { Ground, LevelMeter, Plug, Transistor } from './circuitParts'
import { BASE_GAP, healthOfLevels, lengthOf, pointAlong, resistorPath, transistorLeads } from './circuit'
import type { Pt } from './circuit'

// Mic preamp (Deep dive, D46): the microphone's ±2 mV, far too weak for the desk (1); the wall's
// alternating current made into a power supply's steady ±9 V, waiting (2); a transistor, its base fed
// through a capacitor — the microphone's changes in, the base's own steady voltage kept — and a small
// change at its base changes the current through it (3); a resistor on the + side turns the current's
// changes into a voltage, upside down: line level (4); the gain knob, the resistor on the − side,
// sets how much bigger: the teacher drags it, as the canvas's Preamp knob, and the meter says too
// quiet, good, hot or clipping (5). The levels are judged as the
// canvas judges a signal (dBu, its health words and colours), so the picture says what a Preamp's
// meter would. The layout is the user's sketch: the microphone on the left, the power supply at the
// top with its two sides hanging down — −9 V through the gain resistor and the transistor (upside
// down: its collector at the bottom), +9 V through the resistor —, joined at the bottom, where the
// line out leaves to the right. The phase is the microphone's voltage, as in Magnetic induction:
// +2 mV at 0°. The numbers are preamp.ts's.

// ── Where things are, in the scene's units ──────────────────────────────────
/** The power supply at the top: its box; its − terminal (left), 0 V (middle) and + terminal (right), all on its bottom */
const PSU_X = 480, PSU_Y = 40, PSU_W = 260, PSU_H = 120
const PSU_BOTTOM = PSU_Y + PSU_H, MINUS_X = 520, ZERO_X = 610, PLUS_X = 700
/** Where the two sides end while there is nothing on them yet */
const STUB_Y = 220
/** The − side's leg: the gain resistor on it, the transistor (its emitter above, collector below); the bottom, where both legs meet */
const RE_TOP = STUB_Y, RE_BOTTOM = 320, Q_Y = 430, BOTTOM_Y = 560
/** The + side's leg: the resistor on it */
const RC_TOP = 280, RC_BOTTOM = 380
/** The microphone's panel: its frame, its graph's left edge and width, middle line (the base's) and half height (2 mV) */
const IN_X = 10, PANEL_W = 380, SCOPE_W = 290, IN_SCOPE_X = 30, IN_Y = Q_Y, IN_H = 55
/** The capacitor on the base's wire: its two plates */
const CAP_X = 440, CAP_GAP = 8, CAP_H = 26
/** The line out: from the bottom right corner to its terminal; its panel, its graph's left edge, middle line, half height */
const LINE_END = 876, OUT_X = 900, OUT_SCOPE_X = 920, OUT_Y = BOTTOM_Y, OUT_H = 70
/**
 * The gain knob, left of its resistor: the canvas's Preamp knob (its cap, its purple, a drag up or
 * down of DRAG_PX on screen through its whole range)
 */
const KNOB_X = 440, KNOB_Y = (RE_TOP + RE_BOTTOM) / 2, KNOB_R = 22, DRAG_PX = 150
/** The captions saying what a step does, under the picture */
const NOTE_X = IN_X, NOTE_Y = 630

const GAIN_STEP = 5

/** The charges on the transistor's wire, every DOT_GAP, moving DOT_GAPS spacings a cycle (the current's average, 1 mA, the same at every gain) */
const DOT_GAP = 26, DOT_GAPS = 4
/** The current's way: from the + terminal down its leg, along the bottom, up through the transistor and the gain resistor to the − terminal */
const LOOP: readonly Pt[] = [[PLUS_X, PSU_BOTTOM], [PLUS_X, BOTTOM_Y], [MINUS_X, BOTTOM_Y], [MINUS_X, PSU_BOTTOM]]
const LOOP_LEN = lengthOf(LOOP)
/** Before the transistor comes, only the two sides' stubs are drawn */
const STUB = STUB_Y - PSU_BOTTOM

const inX = (deg: number) => IN_SCOPE_X + (SCOPE_W * deg) / 360
const inY = (deg: number) => IN_Y - IN_H * Math.cos(rad(deg))
const outX = (deg: number) => OUT_SCOPE_X + (SCOPE_W * deg) / 360
/** The output's graph spans ±1.5 V at line level (step 4), ±9 V — both sides — once the knob turns (5) */
const spanAt = (step: number) => (step >= GAIN_STEP ? RAIL : 1.5)
const outYAt = (step: number) => (volts: number) => OUT_Y - (OUT_H * volts) / spanAt(step)

/** The gain a step shows: line level, the knob's from the knob's step on */
const gainAt = (step: number, knob: number) => (step >= GAIN_STEP ? knob : LINE_GAIN)

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

/** `knob`: the gain the knob is at just now (it is dragged outside the player) */
function makePainter(find: Finder, knob: () => number): Painter {
  const inTrace = find('inTrace'), inDot = find('inDot'), inReading = find('inReading')
  const dots = find.all<SVGCircleElement>('dots'), q = find('qFill'), current = find('current')
  const outTrace = find('outTrace'), outDot = find('outDot'), outReading = find('outReading'), clipTrace = find('clipTrace')

  return (deg, step) => {
    const c = preampCycle(gainAt(step, knob()))

    // 1 · the microphone's voltage
    inTrace.setAttribute('d', curvePath(Math.round(deg), inX, inY))
    put(inDot, 'cx', inX(deg)); put(inDot, 'cy', inY(deg))
    inReading.textContent = signed(IN_PEAK * 1000 * Math.cos(rad(deg)), 2)

    // 2 · the sides' charges, waiting on their stubs; from 3 on they move as the transistor's current says
    if (step >= 2) {
      const moved = step >= 3 ? DOT_GAPS * DOT_GAP * tableAt(c.moved, deg) : 0
      dots.forEach((dot, j) => {
        const s = (j * DOT_GAP + moved) % LOOP_LEN
        const [x, y] = pointAlong(LOOP, s)
        put(dot, 'cx', x); put(dot, 'cy', y)
        dot.style.display = step >= 3 || s <= STUB || s >= LOOP_LEN - STUB ? '' : 'none'
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

const WIRE = { fill: 'none', stroke: INK, strokeWidth: 2 } as const

export function PreampScene({ step, onPainter }: SceneProps) {
  const root = useRef<SVGGElement>(null)
  const [knob, setKnob] = useState(LINE_GAIN)
  const knobNow = useLatestRef(knob)
  // The painter reads the knob; a turn while the phase stands still paints the picture again where it was
  const painter = useRef<Painter | null>(null)
  const last = useRef<[number, number]>([0, 1])
  const make = useCallback((find: Finder): Painter => {
    const paint = makePainter(find, () => knobNow.current)
    painter.current = paint
    return (deg, step) => {
      last.current = [deg, step]
      paint(deg, step)
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
  const gain = gainAt(step, knob)
  const c = preampCycle(gain)
  const y = outYAt(step), span = spanAt(step)
  const out = useMemo(() => levelsOf(c.out), [c])
  const ghost = useMemo(() => tracePath(c.out, 360, outYAt(step)), [c, step])
  const wanted = useMemo(() => (step >= GAIN_STEP ? tracePath(c.wanted, 360, outYAt(step)) : ''), [c, step])
  const mic = healthOfLevels(MIC_LEVELS.rms, MIC_LEVELS.peak), outHealth = healthOfLevels(out.rms, out.peak)
  const line = preampCycle(LINE_GAIN)
  const change = Math.max(...line.current) - RESTING
  const volts = (v: number) => `${v.toFixed(1)} ${l.volts}`
  const bar = MINUS_X - BASE_GAP

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
        <Label at={[IN_SCOPE_X + SCOPE_W - 4, IN_Y - IN_H - 4]} anchor="end">+2 {l.mv}</Label>
        <Label at={[IN_SCOPE_X + SCOPE_W - 4, IN_Y + IN_H + 14]} anchor="end">−2 {l.mv}</Label>
        <text className="lsc-dd-reading" x={IN_X} y={IN_Y + 100}>
          {l.fromMicrophone}: <tspan data-p="inReading">+2.00</tspan> {l.mv}
        </text>
        <text className="lsc-dd-reading" x={IN_X} y={IN_Y + 122}>
          {formatDb(MIC_LEVELS.rms)} · <tspan style={{ fill: mic.colour, fontWeight: 600 }}>{t.health[mic.health]}</tspan>
        </text>
        <Label at={[IN_X, IN_Y + 144]}>{l.tooWeakForDesk}</Label>
      </Step>

      {/* 2 · the power supply at the top: the wall's alternating current in, two steady sides out, hanging down */}
      <Step n={2} step={step}>
        <path d={`M${PSU_X - 140} ${PSU_Y + 60} H${PSU_X}`} fill="none" stroke={PART} strokeWidth={4} strokeLinecap="round" />
        <Plug x={PSU_X - 140} y={PSU_Y + 60} />
        <Label at={[PSU_X - 180, PSU_Y + 28]} anchor="middle">{l.wallAc}</Label>
        <rect x={PSU_X} y={PSU_Y} width={PSU_W} height={PSU_H} rx={10} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={2} />
        <text className="lsc-dd-reading" x={PSU_X + PSU_W / 2} y={PSU_Y + 52} textAnchor="middle">{l.powerSupply}</text>
        <Label at={[PSU_X + PSU_W / 2, PSU_Y + 76]} anchor="middle">{l.steadyDc}</Label>
        <path d={`M${MINUS_X} ${PSU_BOTTOM} V${STUB_Y} M${PLUS_X} ${PSU_BOTTOM} V${STUB_Y}`} {...WIRE} />
        <path d={`M${ZERO_X} ${PSU_BOTTOM} V${PSU_BOTTOM + 16}`} {...WIRE} strokeWidth={1.5} />
        <Ground x={ZERO_X} y={PSU_BOTTOM + 16} />
        <Label at={[ZERO_X + 18, PSU_BOTTOM + 28]}>{l.zeroV}</Label>
        <Label at={[MINUS_X - 10, PSU_BOTTOM + 30]} anchor="end">{l.minus9}</Label>
        <Label at={[PLUS_X + 10, PSU_BOTTOM + 30]}>{l.plus9}</Label>
        <Step n={2} until={2} step={step}>
          <Label at={[ZERO_X, STUB_Y + 40]} anchor="middle">{l.waiting}</Label>
        </Step>
        <g data-p="dots" fill={MOVER}>
          {Array.from({ length: Math.floor(LOOP_LEN / DOT_GAP) }, (_, i) => <circle key={i} r={3} />)}
        </g>
      </Step>

      {/* 3 · the transistor on the − side's leg, fed through a capacitor: a small change at its base changes the current through it */}
      <Step n={3} step={step}>
        <path d={`M${IN_X + PANEL_W} ${IN_Y} H${CAP_X} M${CAP_X + CAP_GAP} ${IN_Y} H${bar}`} {...WIRE} strokeWidth={1.5} />
        <g stroke={INK} strokeWidth={3}>
          <line x1={CAP_X} y1={IN_Y - CAP_H / 2} x2={CAP_X} y2={IN_Y + CAP_H / 2} />
          <line x1={CAP_X + CAP_GAP} y1={IN_Y - CAP_H / 2} x2={CAP_X + CAP_GAP} y2={IN_Y + CAP_H / 2} />
        </g>
        <Label at={[CAP_X + CAP_GAP / 2, IN_Y + CAP_H / 2 + 22]} anchor="middle">{l.capacitor}</Label>
        <path d={resistorPath(MINUS_X, RE_TOP, RE_BOTTOM)} {...WIRE} strokeLinejoin="round" />
        <path d={transistorLeads(MINUS_X, Q_Y, RE_BOTTOM, BOTTOM_Y)} {...WIRE} />
        <path d={`M${MINUS_X} ${BOTTOM_Y} H${PLUS_X} V${RC_BOTTOM} M${PLUS_X} ${RC_TOP} V${STUB_Y}`} {...WIRE} />
        <Step n={3} until={3} step={step}>
          <path d={`M${PLUS_X} ${RC_TOP} V${RC_BOTTOM}`} {...WIRE} />
        </Step>
        <Transistor x={MINUS_X} y={Q_Y} fill="qFill" pnp={false} upsideDown />
        <Label at={[MINUS_X + 28, Q_Y - 6]}>{l.transistor}</Label>
        <text className="lsc-dd-reading" x={MINUS_X + 28} y={Q_Y + 18}>
          {l.throughIt}: <tspan data-p="current">1.00</tspan> {l.milliamps}
        </text>
        <Step n={3} until={3} step={step}>
          <Label at={[NOTE_X, NOTE_Y]}>
            {fmt(l.smallChange, { v: `${IN_PEAK * 1000} ${l.mv}`, i: `${(change * 1000).toFixed(2)} ${l.milliamps}` })}
          </Label>
          <Label at={[NOTE_X, NOTE_Y + 20]}>{l.capacitorNote}</Label>
        </Step>
      </Step>

      {/* 4 · a resistor on the + side's leg: the current's changes become a voltage, upside down — the line out */}
      <Step n={4} step={step}>
        <path d={resistorPath(PLUS_X, RC_TOP, RC_BOTTOM)} {...WIRE} strokeLinejoin="round" />
        <Label at={[PLUS_X + 18, (RC_TOP + RC_BOTTOM) / 2 + 4]}>{l.resistor}</Label>
        <path d={`M${PLUS_X} ${BOTTOM_Y} H${LINE_END}`} fill="none" stroke={INK} strokeWidth={1.5} />
        <circle cx={PLUS_X} cy={BOTTOM_Y} r={4} fill={INK} />
        <circle cx={LINE_END} cy={BOTTOM_Y} r={5} fill="var(--lsc-sunken)" stroke={INK} strokeWidth={1.5} />
        <Label at={[(PLUS_X + LINE_END) / 2, BOTTOM_Y - 12]} anchor="middle">{l.lineOut}</Label>

        <rect x={OUT_X} y={OUT_Y - 96} width={PANEL_W} height={192} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
        <clipPath id="lsc-dd-preamp-out"><rect x={OUT_X} y={OUT_Y - 96} width={PANEL_W} height={192} rx={8} /></clipPath>
        <g stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4">
          {[90, 180, 270].map((deg) => <line key={deg} x1={outX(deg)} y1={OUT_Y - 88} x2={outX(deg)} y2={OUT_Y + 88} />)}
        </g>
        <line x1={OUT_SCOPE_X - 10} y1={OUT_Y} x2={OUT_SCOPE_X + SCOPE_W + 10} y2={OUT_Y} stroke={PART} strokeWidth={0.75} />
        <Label at={[OUT_X + 12, OUT_Y - 78]}>{l.lineOutReading}</Label>
        <Label at={[OUT_SCOPE_X + SCOPE_W - 4, y(span) - 4]} anchor="end">+{volts(span)}</Label>
        <Label at={[OUT_SCOPE_X + SCOPE_W - 4, y(-span) + 14]} anchor="end">−{volts(span)}</Label>
        {step >= GAIN_STEP && (
          <>
            <g stroke="var(--signal-clipping)" strokeWidth={0.75} strokeDasharray="6 4" opacity={0.7}>
              <line x1={OUT_SCOPE_X - 10} y1={y(SWING_MAX)} x2={OUT_SCOPE_X + SCOPE_W + 10} y2={y(SWING_MAX)} />
              <line x1={OUT_SCOPE_X - 10} y1={y(-SWING_MAX)} x2={OUT_SCOPE_X + SCOPE_W + 10} y2={y(-SWING_MAX)} />
            </g>
            {/* Above the panel: inside it the trace would run through it */}
            <line x1={OUT_X + PANEL_W - 24} y1={OUT_Y - 110} x2={OUT_X + PANEL_W} y2={OUT_Y - 110} stroke="var(--signal-clipping)" strokeWidth={0.75} strokeDasharray="6 4" opacity={0.7} />
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

      {/* 5 · the gain knob: the resistor on the − side's leg, turned */}
      <Step n={GAIN_STEP} step={step}>
        <line x1={MINUS_X - 22} y1={RE_BOTTOM - 10} x2={MINUS_X + 24} y2={RE_TOP + 10} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
        <Leader x1={KNOB_X + KNOB_R + 2} y1={KNOB_Y} x2={MINUS_X - 14} y2={KNOB_Y} />
        <g
          role="slider" tabIndex={0} aria-label={l.gainKnob}
          aria-valuemin={GAIN_MIN} aria-valuemax={GAIN_MAX} aria-valuenow={knob} aria-valuetext={`+${knob} ${l.db}`}
          onPointerDown={onKnobDown} onKeyDown={onKnobKey}
          style={{ cursor: 'ns-resize', touchAction: 'none', outline: 'none' }}
        >
          <KnobFace cx={KNOB_X} cy={KNOB_Y} r={KNOB_R} value={(knob - GAIN_MIN) / (GAIN_MAX - GAIN_MIN)} color="var(--lsc-accent)" />
        </g>
        <Label at={[KNOB_X - KNOB_R - 8, KNOB_Y - 2]} anchor="end">{l.gainKnob}</Label>
        <Label at={[KNOB_X - KNOB_R - 8, KNOB_Y + 16]} anchor="end">+{gain} {l.db}</Label>
        <Label at={[NOTE_X, NOTE_Y]}>{l.gainKnobNote}</Label>
      </Step>
    </g>
  )
}
