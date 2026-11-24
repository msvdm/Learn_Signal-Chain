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
// an impedance converter after it), a ribbon (a strip of foil between a magnet's poles, seen from
// its end, a transformer after it) and a piezo (a crystal bent by its diaphragm, into a Hi-Z input).
// Every voltage follows the air's pressure, so the four graphs rise and fall together; the parts
// move differently (mics.ts says why). Each graph is drawn to its own microphone's peak, which its
// scale names; the air is darker where it is pressed together.

/** In a cell: the air (its cloud), the middle line every part sits on */
const AIR = { x: 22, y: 100, w: 160, h: 216 }, MID = 208
/** Where each moving part rests: the air's wave is measured from it */
const REST: Record<MicKind, number> = { dynamic: 200, condenser: 205, ribbon: 250, piezo: 205 }
/** How far each part moves at most (px): the dynamic's as Magnetic induction moves it */
const MOVE: Record<MicKind, number> = { dynamic: 0.5 * SWING, condenser: 9, ribbon: 10, piezo: 9 }
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
/** The ribbon's transformer: where its first coil stands */
const TF = 346
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
  const ribbon = find('ribbon'), ribbonLeadA = find('ribbonLeadA'), ribbonLeadB = find('ribbonLeadB'), ribbonEnd = find('ribbonEnd')
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

    // Ribbon: the foil moves with the air between the poles; the leads leave its two ends (one behind)
    if (step >= 3) {
      const x = REST.ribbon + MOVE.ribbon * partAt('ribbon', r)
      put(ribbon, 'x1', x); put(ribbon, 'x2', x)
      put(ribbonEnd, 'cx', x)
      ribbonLeadA.setAttribute('d', `M${f(x)} ${MID} L${TF - 6} ${MID - 14} H${TF}`)
      ribbonLeadB.setAttribute('d', `M${f(x)} ${MID} L${TF - 6} ${MID + 14} H${TF}`)
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

/** The ribbon, seen from its end: between a magnet's two poles, its leads into the transformer */
function Ribbon() {
  const l = useTranslation().t.deepDive.labels
  const x = REST.ribbon
  const bumps = (n: number, x0: number, y0: number, h: number, way: 1 | -1) =>
    `M${x0} ${y0}` + Array.from({ length: n }, () => ` a${h / n / 2} ${h / n / 2} 0 0 ${way === 1 ? 1 : 0} 0 ${h / n}`).join('')
  return (
    <>
      <rect x={x - 26} y={128} width={52} height={56} rx={3} fill={PART_2} />
      <rect x={x - 26} y={232} width={52} height={56} rx={3} fill={PART_2} />
      <text x={x} y={164} textAnchor="middle" className="lsc-dd-reading">N</text>
      <text x={x} y={268} textAnchor="middle" className="lsc-dd-reading">S</text>
      <g stroke={PART} strokeWidth={0.75} strokeDasharray="3 3">
        {[-18, 18].map((dx) => <line key={dx} x1={x + dx} y1={186} x2={x + dx} y2={230} />)}
      </g>
      <line data-p="ribbon" x1={x} y1={188} x2={x} y2={228} stroke={INK} strokeWidth={3} strokeLinecap="round" />

      <path data-p="ribbonLeadA" fill="none" stroke={INK} strokeWidth={1.5} />
      <path data-p="ribbonLeadB" fill="none" stroke={INK} strokeWidth={1.5} strokeDasharray="4 3" />
      <circle data-p="ribbonEnd" cx={x} cy={MID} r={3} fill={INK} />

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
      <Label at={[x, 120]} anchor="middle">{l.magnet}</Label>
      <Label at={[x - 28, 316]}>{l.ribbonEnd}</Label>
      <Label at={[TF + 14, 160]} anchor="middle">{fmt(l.transformerRatio, { n: String(RIBBON_STEP_UP) })}</Label>
      <text className="lsc-dd-label" x={TF + 14} y={268} textAnchor="middle">{l.ribbonAlone}</text>
      <text className="lsc-dd-reading" x={TF + 14} y={290} textAnchor="middle">
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
