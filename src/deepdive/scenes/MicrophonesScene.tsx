import { useRef } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { fmt } from '../../i18n/translations'
import { K, SWING, clamp, curvePath, rad, scatter, swing } from '../wave'
import { MIC_KINDS, MODEL, PIEZO_LOAD_MOHM, RIBBON_STEP_UP, SENSITIVITY, SOUND_DB_SPL, partAt, peakMv, ribbonOwnMv, voltageAt } from '../mics'
import type { MicKind } from '../mics'
import { ARROW, FAINT, FLOW, INK, MOVER, PART, PART_2, PART_3, TRACE } from './look'
import { put, usePainter } from './painter'
import type { Finder, Painter, SceneProps } from './painter'
import { Air, Label, Leader, Step } from './sceneParts'
import { MicrophoneParts } from './micParts'
import { MIC_FACE, MIC_MIDDLE, moveMicrophone } from './mic'
import { CELLS, CELL_H, CELL_W } from './micCells'

// Microphone types (Deep dive, D46): the same sound — 94 dB SPL — turned into a voltage four ways,
// one cell of a 2 × 2 grid each, a step adding each: a dynamic microphone (Magnetic induction's: a
// coil moving round a magnet), a condenser (a diaphragm moving near a backplate charged by the 48V,
// an impedance converter after it), a ribbon (a pleated strip of foil hanging between a horseshoe
// magnet's arms, seen from the front, a transformer after it) and a piezo (a crystal bent by its diaphragm, into a Hi-Z input).
// Every voltage follows the air's pressure, so the four graphs rise and fall together; the parts
// move differently (mics.ts says why). Each graph is drawn to its own microphone's peak, which its
// scale names; the air is darker where it is pressed together.

/** In a cell: the air (its cloud), the middle line every part sits on */
const AIR = { x: 22, y: 100, w: 160, h: 216 }, MID = 208
/** Where each moving part rests: the air's wave is measured from it */
const REST: Record<MicKind, number> = { dynamic: 200, condenser: 205, ribbon: 256, piezo: 205 }
/** How far each part moves at most (px): the dynamic's as Magnetic induction moves it */
const MOVE: Record<Exclude<MicKind, 'ribbon'>, number> = { dynamic: 0.5 * SWING, condenser: 9, piezo: 9 }
/** The two output terminals, left of the graph */
const OUT_X = 430, OUT_A = MID - 10, OUT_B = MID + 10
/** The graph: its box; its left edge, width, middle line and half height (the microphone's peak) */
const BOX = { x: 445, y: 112, w: 262, h: 190 }
const SCOPE_X = 462, SCOPE_W = 228, SCOPE_H = 66
/** The strips of air, darker where it is pressed together */
const STRIP = 6
const STRIPS = Array.from({ length: Math.ceil(AIR.w / STRIP) }, (_, i) => AIR.x + i * STRIP)
/** The diaphragm of the condenser and the piezo: clamped at its top and bottom */
const DIA_TOP = 140, DIA_BOTTOM = 276
/**
 * The ribbon, seen from the front: its middle, half its height, its pleats, half its width. Only
 * moving towards the viewer and away does it cut the field between the magnet's arms, so that is
 * how it moves: clamped at its top and bottom, it bends, its middle furthest. Towards the viewer is
 * drawn down and to the left (depth on paper, DEPTH_X / DEPTH_Y at the middle), a pleat there up to
 * NEARER wider as it comes closer
 */
const RIB_X = REST.ribbon, RIB_Y = 186, RIB_HALF = 60, PLEATS = 8, RIB_W = 17
const DEPTH_X = -7, DEPTH_Y = 4, NEARER = 0.12
/** The horseshoe magnet: its arms' inner and outer edges either side of the ribbon, their top, where they turn */
const ARM_IN = 30, ARM_OUT = 52, ARM_TOP = 110, ARM_TURN = 262
/** The ribbon's transformer: where its first coil stands */
const TF = 336
/** The piezo's crystal: its two layers, their clamped bottom and free top; the drive pin's height */
const CRYSTAL_X = 258, LAYER = 6, CRYSTAL_BASE = 282, CRYSTAL_TOP = 200, PIN_Y = MID

const DOTS: Record<MicKind, ReturnType<typeof scatter>> = {
  dynamic:   scatter(23, 150, AIR),
  condenser: scatter(29, 150, AIR),
  ribbon:    scatter(31, 150, AIR),
  piezo:     scatter(37, 150, AIR),
}

const scopeX = (deg: number) => SCOPE_X + (SCOPE_W * deg) / 360
const scopeY = (deg: number) => MID - SCOPE_H * Math.cos(rad(deg))
const f = (n: number) => n.toFixed(1)

/** A voltage as its reading says it: a sign, two decimals (none shows as +0.00, never −0.00) */
function signed(n: number, digits = 2): string {
  const shown = n.toFixed(digits)
  return Number(shown) < 0 ? `−${shown.slice(1)}` : `+${Number(shown) === 0 ? (0).toFixed(digits) : shown}`
}

/** How far a bent crystal's layer leans at height `y`, its free top `b` over (a cantilever's curve), reaching `b` at the drive pin */
const lean = (b: number, y: number) => b * ((CRYSTAL_BASE - y) / (CRYSTAL_BASE - PIN_Y)) ** 2

/** One of the crystal's layers, `dx` from its left edge, its top `b` over */
function layerPath(b: number, dx: number): string {
  const ys = [CRYSTAL_BASE, 262, 242, 222, CRYSTAL_TOP]
  const left = ys.map((y) => `${f(CRYSTAL_X + dx + lean(b, y))} ${y}`)
  const right = [...ys].reverse().map((y) => `${f(CRYSTAL_X + dx + LAYER + lean(b, y))} ${y}`)
  return `M${left.join(' L')} L${right.join(' L')} Z`
}

/** A clamped diaphragm, its middle `d` pushed in */
const diaphragmPath = (d: number) => `M${REST.condenser} ${DIA_TOP} Q${f(REST.condenser + 2 * d)} ${MID} ${REST.condenser} ${DIA_BOTTOM}`

function makePainter(find: Finder): Painter {
  const cells = MIC_KINDS.map((kind, i) => {
    const [ox] = CELLS[kind]
    const air = find.dots(`air-${kind}`, DOTS[kind]).map((el, j) => ({ el, x: DOTS[kind][j].x }))
    for (const { el } of air) el.setAttribute('fill', INK)
    return {
      kind, step: i + 1, ox, air,
      strips: find.all(`strips-${kind}`),
      trace: find(`trace-${kind}`), dot: find(`dot-${kind}`), reading: find(`reading-${kind}`),
    }
  })
  const diaphragm = find('diaphragm'), coil = find.all('coil')
  const dynLeadA = find('dynLeadA'), dynLeadB = find('dynLeadB')
  const condDiaphragm = find('condDiaphragm')
  const pleats = find.all('ribbon')
  const ribbonOwn = find('ribbonOwn')
  const piezoDiaphragm = find('piezoDiaphragm'), pin = find('pin'), layers = find.all('layers')
  const chargeA = find('chargeA'), chargeB = find('chargeB')

  return (deg, step) => {
    const r = rad(deg)
    for (const cell of cells) {
      if (step < cell.step) continue
      const { kind } = cell
      // The air: each particle swings in place, the wave its delay with distance; darker where pressed
      for (const p of cell.air) put(p.el, 'cx', clamp(p.x + swing(r, p.x - REST[kind]), AIR.x - 2, AIR.x + AIR.w + 2))
      cell.strips.forEach((strip, j) => {
        const pressed = Math.cos(r - K * (STRIPS[j] + STRIP / 2 - REST[kind]))
        strip.setAttribute('opacity', (0.04 + 0.22 * Math.max(0, pressed)).toFixed(3))
      })
      // Its voltage, drawn over one cycle up to now
      cell.trace.setAttribute('d', curvePath(Math.round(deg), scopeX, scopeY))
      put(cell.dot, 'cx', scopeX(deg)); put(cell.dot, 'cy', scopeY(deg))
      cell.reading.textContent = signed(voltageAt(kind, r))
    }

    // Dynamic: the diaphragm and its coil move with the air; the leads hang from the coil
    const u = MOVE.dynamic * partAt('dynamic', r)
    moveMicrophone(diaphragm, coil, u)
    dynLeadA.setAttribute('d', `M${f(228 + u)} 228 V318 H412 V${OUT_A} H${OUT_X}`)
    dynLeadB.setAttribute('d', `M${f(222 + u)} 228 V326 H420 V${OUT_B} H${OUT_X}`)

    // Condenser: the pressure pushes the diaphragm towards the backplate
    if (step >= 2) condDiaphragm.setAttribute('d', diaphragmPath(MOVE.condenser * partAt('condenser', r)))

    // Ribbon: the foil moves with the air, bending towards the viewer and away between its clamped ends
    if (step >= 3) {
      const bands = ribbonPleats(partAt('ribbon', r))
      pleats.forEach((pleat, k) => pleat.setAttribute('d', bands[k].d))
      ribbonOwn.textContent = signed(ribbonOwnMv(r) * 1000, 0)
    }

    // Piezo: the pressure pushes the diaphragm, its pin bends the crystal; its faces charged by the bend
    if (step >= 4) {
      const d = MOVE.piezo * partAt('piezo', r)
      piezoDiaphragm.setAttribute('d', diaphragmPath(d))
      pin.setAttribute('d', `M${f(REST.piezo + d)} ${PIN_Y} H${f(CRYSTAL_X + d)}`)
      layers.forEach((layer, j) => layer.setAttribute('d', layerPath(d, j * LAYER)))
      const v = voltageAt('piezo', r) / peakMv('piezo')
      chargeA.textContent = v >= 0 ? '+' : '−'
      chargeB.textContent = v >= 0 ? '−' : '+'
      const strength = Math.abs(v).toFixed(3)
      chargeA.setAttribute('opacity', strength); chargeB.setAttribute('opacity', strength)
    }
  }
}

export function MicrophonesScene({ step, onPainter }: SceneProps) {
  const root = useRef<SVGGElement>(null)
  usePainter(root, onPainter, makePainter)
  const l = useTranslation().t.deepDive.labels
  const name: Record<MicKind, string> = { dynamic: l.micDynamic, condenser: l.micCondenser, ribbon: l.micRibbon, piezo: l.micPiezo }

  return (
    <g ref={root}>
      {MIC_KINDS.map((kind, i) => (
        <Step key={kind} n={i + 1} step={step}>
          <g transform={`translate(${CELLS[kind][0]},${CELLS[kind][1]})`}>
            <Cell kind={kind} name={name[kind]} />
            {kind === 'dynamic' && <Dynamic />}
            {kind === 'condenser' && <Condenser />}
            {kind === 'ribbon' && <Ribbon />}
            {kind === 'piezo' && <Piezo />}
          </g>
        </Step>
      ))}
    </g>
  )
}

/** What every cell has: its frame and name, the sound wave reaching it, its terminals, its voltage's graph */
function Cell({ kind, name }: { kind: MicKind; name: string }) {
  const l = useTranslation().t.deepDive.labels
  const peak = peakMv(kind).toFixed(peakMv(kind) < 10 ? 2 : 1)
  const id = `lsc-dd-air-${kind}`
  return (
    <>
      <rect x={0} y={0} width={CELL_W} height={CELL_H} rx={12} fill="none" stroke={FAINT} strokeWidth={1} />
      <text className="lsc-dd-name" x={18} y={38}>{name}</text>

      <Air id={id} x={AIR.x} y={AIR.y} w={AIR.w} h={AIR.h} r={60} />
      <g data-p={`strips-${kind}`} mask={`url(#${id})`}>
        {STRIPS.map((x) => <rect key={x} x={x} y={AIR.y - 6} width={STRIP} height={AIR.h + 12} shapeRendering="crispEdges" fill={MOVER} opacity={0.04} />)}
      </g>
      <g data-p={`air-${kind}`} mask={`url(#${id})`} />
      <Label at={[AIR.x + 2, 70]} flow>{fmt(l.soundAt, { db: String(SOUND_DB_SPL) })}</Label>
      <line x1={AIR.x + 4} y1={84} x2={AIR.x + 150} y2={84} stroke={FLOW} strokeWidth={2} markerEnd={ARROW} />

      <circle cx={OUT_X} cy={OUT_A} r={3} fill={INK} />
      <circle cx={OUT_X} cy={OUT_B} r={3} fill={INK} />

      <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
      <g stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4">
        {[90, 180, 270].map((deg) => <line key={deg} x1={scopeX(deg)} y1={MID - SCOPE_H - 8} x2={scopeX(deg)} y2={MID + SCOPE_H + 8} />)}
        <line x1={SCOPE_X} y1={MID - SCOPE_H} x2={SCOPE_X + SCOPE_W} y2={MID - SCOPE_H} />
        <line x1={SCOPE_X} y1={MID + SCOPE_H} x2={SCOPE_X + SCOPE_W} y2={MID + SCOPE_H} />
      </g>
      <line x1={SCOPE_X} y1={MID} x2={SCOPE_X + SCOPE_W} y2={MID} stroke={PART} strokeWidth={0.75} />
      <Label at={[BOX.x + BOX.w - 8, MID - SCOPE_H - 8]} anchor="end">+{peak} {l.mv}</Label>
      <Label at={[BOX.x + BOX.w - 8, MID + SCOPE_H + 20]} anchor="end">−{peak} {l.mv}</Label>
      <path d={curvePath(360, scopeX, scopeY)} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
      <path data-p={`trace-${kind}`} fill="none" stroke={TRACE} strokeWidth={3} strokeLinecap="round" />
      <circle data-p={`dot-${kind}`} cx={SCOPE_X} cy={MID} r={6} fill={MOVER} />
      <text className="lsc-dd-reading" x={BOX.x} y={BOX.y + BOX.h + 28}>
        {l.outputVoltage}: <tspan data-p={`reading-${kind}`}>+0.00</tspan> {l.mv}
      </text>
      <Label at={[BOX.x, BOX.y + BOX.h + 52]}>{fmt(l.onAverage, { mv: String(SENSITIVITY[kind]) })}</Label>
      <Label at={[CELL_W - 18, 38]} anchor="end">{fmt(l.figuresFrom, { model: MODEL[kind] })}</Label>
    </>
  )
}

/** The dynamic microphone, as Magnetic induction draws it: the diaphragm and its coil round the magnet */
function Dynamic() {
  const l = useTranslation().t.deepDive.labels
  const dx = REST.dynamic - MIC_FACE, dy = MID - MIC_MIDDLE
  return (
    <>
      <path data-p="dynLeadA" fill="none" stroke={INK} strokeWidth={1.5} />
      <path data-p="dynLeadB" fill="none" stroke={INK} strokeWidth={1.5} />
      <g transform={`translate(${dx},${dy})`}><MicrophoneParts /></g>
      <Label at={[REST.dynamic, 126]} anchor="middle">{l.diaphragm}</Label>
      <Leader x1={228} y1={MID - 16} x2={298} y2={132} />
      <Label at={[300, 126]}>{l.voiceCoil}</Label>
      <Label at={[322, MID + 5]}>{l.magnet}</Label>
    </>
  )
}

/** The condenser: its diaphragm before a charged backplate, the 48V through a resistor, the impedance converter */
function Condenser() {
  const l = useTranslation().t.deepDive.labels
  const plate = { x: 222, w: 14 }
  return (
    <>
      {/* The ring holding the diaphragm and the backplate */}
      <rect x={198} y={DIA_TOP - 10} width={46} height={10} fill={PART_2} />
      <rect x={198} y={DIA_BOTTOM} width={46} height={10} fill={PART_2} />
      <rect x={plate.x} y={DIA_TOP + 6} width={plate.w} height={DIA_BOTTOM - DIA_TOP - 12} fill={PART} />
      {[160, 184, 208, 232, 256].map((y) => <rect key={y} x={plate.x + 4} y={y - 4} width={plate.w - 8} height={8} fill="var(--lsc-bg)" />)}
      <path data-p="condDiaphragm" d={diaphragmPath(0)} fill="none" stroke={INK} strokeWidth={2.5} />

      {/* The backplate to the impedance converter; the 48V into it through a resistor */}
      <g fill="none" stroke={INK} strokeWidth={1.5}>
        <path d={`M${plate.x + plate.w} ${MID} H300`} />
        <path d={`M274 ${MID} V186 l-7 -3 l14 -6 l-14 -6 l14 -6 l-14 -6 l7 -3 V128`} strokeLinejoin="round" />
        <path d={`M345 ${MID} H392 V${OUT_A} H${OUT_X}`} />
        <path d={`M${REST.condenser} ${DIA_BOTTOM + 10} V326 H420 V${OUT_B} H${OUT_X}`} />
      </g>
      <path d={`M300 ${MID - 24} V${MID + 24} L345 ${MID} Z`} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={2} strokeLinejoin="round" />
      <circle cx={274} cy={128} r={3} fill={INK} />
      <Label at={[284, 133]}>{l.phantom48}</Label>
      <Label at={[REST.condenser - 10, 120]}>{l.diaphragm}</Label>
      <Leader x1={plate.x + plate.w / 2} y1={DIA_BOTTOM + 14} x2={250} y2={300} />
      <Label at={[250, 316]} anchor="middle">{l.backplate}</Label>
      <text className="lsc-dd-label" x={322} y={MID + 46} textAnchor="middle">
        {l.impedanceConverter.split('\n').map((row, i) => <tspan key={i} x={322} dy={i ? 19 : 0}>{row}</tspan>)}
      </text>
    </>
  )
}

/**
 * A pleated strip, folded like a paper fan: its bands alternately lit and shaded, every other fold
 * further right. `push` (−1 … 1): how far it is bent towards the viewer — its clamped ends never
 * move, its middle furthest (half a sine along it), drawn down-left and wider as it comes closer
 */
function ribbonPleats(push: number): { d: string; lit: boolean }[] {
  const h = (2 * RIB_HALF) / PLEATS
  const at = (k: number) => {
    const z = push * Math.sin((Math.PI * k) / PLEATS)
    return { x: RIB_X + (k % 2 ? 5 : 0) + DEPTH_X * z, y: RIB_Y - RIB_HALF + k * h + DEPTH_Y * z, w: RIB_W * (1 + NEARER * z) }
  }
  return Array.from({ length: PLEATS }, (_, k) => {
    const top = at(k), bottom = at(k + 1)
    return {
      d: `M${f(top.x - top.w)} ${f(top.y)} H${f(top.x + top.w)} L${f(bottom.x + bottom.w)} ${f(bottom.y)} H${f(bottom.x - bottom.w)} Z`,
      lit: k % 2 === 0,
    }
  })
}
const PLEAT_BANDS = ribbonPleats(0)

/** Two rows of words, split where the text has a line break */
function Rows({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text className="lsc-dd-label" x={x} y={y}>
      {text.split('\n').map((row, i) => <tspan key={i} x={x} dy={i ? 19 : 0}>{row}</tspan>)}
    </text>
  )
}

/** The ribbon, seen from the front: a pleated strip between a horseshoe magnet's arms, its leads round to the transformer */
function Ribbon() {
  const l = useTranslation().t.deepDive.labels
  const x = RIB_X
  const bumps = (n: number, x0: number, y0: number, h: number, way: 1 | -1) =>
    `M${x0} ${y0}` + Array.from({ length: n }, () => ` a${h / n / 2} ${h / n / 2} 0 0 ${way === 1 ? 1 : 0} 0 ${h / n}`).join('')
  const magnet = `M${x - ARM_OUT} ${ARM_TOP} H${x - ARM_IN} V${ARM_TURN} A${ARM_IN} ${ARM_IN} 0 0 0 ${x + ARM_IN} ${ARM_TURN} ` +
    `V${ARM_TOP} H${x + ARM_OUT} V${ARM_TURN} A${ARM_OUT} ${ARM_OUT} 0 0 1 ${x - ARM_OUT} ${ARM_TURN} Z`
  return (
    <>
      <path d={magnet} fill={PART_2} stroke={PART} strokeWidth={1.5} strokeLinejoin="round" />
      <text x={x - (ARM_IN + ARM_OUT) / 2} y={ARM_TOP + 20} textAnchor="middle" className="lsc-dd-reading">N</text>
      <text x={x + (ARM_IN + ARM_OUT) / 2} y={ARM_TOP + 20} textAnchor="middle" className="lsc-dd-reading">S</text>

      <g data-p="ribbon" stroke={PART} strokeWidth={0.75} strokeLinejoin="round">
        {PLEAT_BANDS.map((band, k) => <path key={k} d={band.d} fill={band.lit ? FAINT : PART_3} />)}
      </g>
      {/* Its leads, from its clamped top and bottom */}
      <g fill="none" stroke={INK} strokeWidth={1.5}>
        <path d={`M${x} ${RIB_Y - RIB_HALF} V100 H${TF} V${MID - 14}`} />
        <path d={`M${x} ${RIB_Y + RIB_HALF} V280 H${TF} V${MID + 14}`} />
      </g>

      {/* The transformer: a few turns in, thirty times as many out, round one core */}
      <g fill="none" stroke={INK} strokeWidth={1.5}>
        <path d={bumps(3, TF, MID - 14, 28, 1)} />
        <path d={bumps(9, TF + 28, MID - 30, 60, -1)} />
        <path d={`M${TF + 28} ${MID - 30} H${TF + 40} V${OUT_A} H${OUT_X} M${TF + 28} ${MID + 30} H${TF + 40} V${OUT_B} H${OUT_X}`} />
      </g>
      <g stroke={PART} strokeWidth={2}>
        <line x1={TF + 12} y1={MID - 36} x2={TF + 12} y2={MID + 36} />
        <line x1={TF + 17} y1={MID - 36} x2={TF + 17} y2={MID + 36} />
      </g>
      <Label at={[x, 92]} anchor="middle">{l.ribbonStrip}</Label>
      <Label at={[x, ARM_TURN + ARM_OUT + 22]} anchor="middle">{l.magnet}</Label>
      <Rows x={x + ARM_OUT + 6} y={140} text={fmt(l.transformerRatio, { n: String(RIBBON_STEP_UP) })} />
      <text className="lsc-dd-label" x={x + ARM_OUT + 6} y={304}>{l.ribbonAlone}</text>
      <text className="lsc-dd-reading" x={x + ARM_OUT + 6} y={326}>
        <tspan data-p="ribbonOwn">+0</tspan> {l.uv}
      </text>
    </>
  )
}

/** The piezo: a diaphragm, its drive pin bending a crystal of two layers clamped at its bottom */
function Piezo() {
  const l = useTranslation().t.deepDive.labels
  return (
    <>
      <rect x={198} y={DIA_TOP - 10} width={20} height={10} fill={PART_2} />
      <rect x={198} y={DIA_BOTTOM} width={20} height={10} fill={PART_2} />
      <path data-p="piezoDiaphragm" d={diaphragmPath(0)} fill="none" stroke={INK} strokeWidth={2.5} />
      <path data-p="pin" fill="none" stroke={PART} strokeWidth={3} strokeLinecap="round" />
      <g data-p="layers" stroke={PART} strokeWidth={1}>
        <path d={layerPath(0, 0)} fill={PART_3} />
        <path d={layerPath(0, LAYER)} fill={PART_2} />
      </g>
      <rect x={CRYSTAL_X - 16} y={CRYSTAL_BASE} width={2 * LAYER + 32} height={14} fill={PART} />
      <text data-p="chargeA" className="lsc-dd-reading" x={CRYSTAL_X - 10} y={250} textAnchor="middle" style={{ fill: MOVER }}>+</text>
      <text data-p="chargeB" className="lsc-dd-reading" x={CRYSTAL_X + 2 * LAYER + 10} y={250} textAnchor="middle" style={{ fill: MOVER }}>−</text>

      <g fill="none" stroke={INK} strokeWidth={1.5}>
        <path d={`M${CRYSTAL_X + 3} ${CRYSTAL_BASE + 14} V318 H412 V${OUT_A} H${OUT_X}`} />
        <path d={`M${CRYSTAL_X + LAYER + 9} ${CRYSTAL_BASE + 14} V326 H420 V${OUT_B} H${OUT_X}`} />
      </g>
      <Label at={[REST.piezo - 10, 120]}>{l.diaphragm}</Label>
      <Leader x1={236} y1={PIN_Y - 3} x2={290} y2={192} />
      <Label at={[292, 196]}>{l.drivePin}</Label>
      <Leader x1={CRYSTAL_X + LAYER} y1={232} x2={318} y2={252} />
      <Label at={[322, 257]}>{l.crystal}</Label>
      <Label at={[350, 150]} anchor="middle">{fmt(l.hiZ, { r: String(PIEZO_LOAD_MOHM) })}</Label>
    </>
  )
}
