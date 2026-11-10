import { useRef } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { PIANO_C5, SAWTOOTH, circlesOnCircles, clamp, complexSwing, complexWave, curvePath, harmonicSwing, rad, scatter, stringSwing } from '../wave'
import type { Recipe } from '../wave'
import { ARROW, ARROW_INK, FAINT, FLOW, INK, MOVER, PART, PART_3, TRACE } from './look'
import { put, usePainter } from './painter'
import type { Finder, Painter, SceneProps } from './painter'
import { Air, Label, Step } from './sceneParts'

// Complex waves (Dive deeper, D46): a string is the result, the harmonics what is added to it. On
// the left the string, and beside it each harmonic alone, one below the other — a circle turning
// and its sine: the fundamental (step 1), the 2nd (2), the 3rd (4), the 4th to the 10th (5). On the
// right what they make together (from step 3): the circles riding on each other, their sum, and the
// recipe — how big each sine is. Then that shape in the air from a speaker cone (6), and last a
// real piano's C5, measured (7): every part takes its recipe. The string vibrates in as many
// harmonics as are added up, and grows down beside the rows reached. The phase is the
// fundamental's: everything is one function of it.

// ── Where things are, in the scene's units ──────────────────────────────────
/** The first sine's radius: every other sine is a share of it (its size in the recipe) */
const UNIT = 60
const SINES = SAWTOOTH.length
/** The harmonics on the left: their circles' x, their graphs' left edge and width, each row's middle line */
const CIRCLE_X = 110, GRAPH_X = 220, GRAPH_W = 360
const ROW_Y = [130, 290, 395, 470, 526, 582, 638, 694, 750, 806]
/** The step each harmonic's row comes in */
const ROW_STEP = [1, 2, 4, 5, 5, 5, 5, 5, 5, 5]
/** How many harmonics are added up at each step: the string's, the circles', the recipe's */
const COUNT = [1, 2, 2, 3, SINES, SINES, SINES]
/** The piano's step: from it on, every part takes the piano's recipe instead of the sawtooth's */
const PIANO_STEP = 7
/** What they make together: the circles' first centre, the sum's graph, the recipe's bars */
const CHAIN_X = 740, CHAIN_Y = 300, SUM_X = 960, SUM_Y = 300
const BAR_X = 966, BAR_STEP = 36, BAR_W = 22, BAR_BOTTOM = 560, BAR_H = 80
/** The air, lower right: where the cone's front rests, how far the air reaches, its shape above it */
const CONE_X = 700, AIR_FROM = 712, AIR_TO = 1360, AIR_Y = 690, AIR_H = 110, SHAPE_Y = 650, SHAPE_SCALE = 3
/**
 * The string: its x at rest, its top end, its bottom end at each step (beside the rows reached),
 * how far its first harmonic swings
 */
const STRING_X = -50, STRING_TOP = 60, STRING_SWING = 38
const STRING_BOTTOM = [205, 335, 335, 425, 826, 826, 826]
/** The string is drawn 100 units long, stretched to its length (`lsc-dd-grow` glides it) */
const STRING_UNITS = 100, STRING_POINTS = 100

const AIR_DOTS = scatter(23, 520, { x: AIR_FROM, y: AIR_Y, w: AIR_TO - AIR_FROM, h: AIR_H })

const atStep = <T,>(list: readonly T[], step: number) => list[Math.min(step, list.length) - 1]
const countAt = (step: number) => atStep(COUNT, step)
const recipeAt = (step: number): Recipe => (step >= PIANO_STEP ? PIANO_C5 : SAWTOOTH)

const graphX = (deg: number) => GRAPH_X + (GRAPH_W * deg) / 360
const sumX   = (deg: number) => SUM_X + (GRAPH_W * deg) / 360
/** The n-th harmonic's radius, and its graph's height at a phase */
const radiusOf = (n: number, recipe: Recipe) => UNIT * recipe[n - 1].size
const rowGraph = (n: number, recipe: Recipe) => (deg: number) =>
  ROW_Y[n - 1] - radiusOf(n, recipe) * Math.sin(n * rad(deg) + recipe[n - 1].phase)
const sumOf = (recipe: Recipe, count: number) => (deg: number) => SUM_Y - UNIT * complexWave(rad(deg), recipe, count)

/** A line from one point to another */
function line(el: SVGElement, x1: number, y1: number, x2: number, y2: number) {
  put(el, 'x1', x1); put(el, 'y1', y1); put(el, 'x2', x2); put(el, 'y2', y2)
}

/** The string's shape, when the point `along` its length (0 … 1) is `swing` of its first harmonic's from rest */
function stringPath(swing: (along: number) => number): string {
  let path = ''
  for (let i = 0; i <= STRING_POINTS; i++) {
    const along = i / STRING_POINTS
    path += `${i ? ' L' : 'M'}${(STRING_X + STRING_SWING * swing(along)).toFixed(1)} ${(STRING_UNITS * along).toFixed(1)}`
  }
  return path
}
const stretch  = (step: number) => `translate(0px, ${STRING_TOP}px) scale(1, ${(atStep(STRING_BOTTOM, step) - STRING_TOP) / STRING_UNITS})`
const bottomAt = (step: number) => `translate(0px, ${atStep(STRING_BOTTOM, step)}px)`

/** The ten sines' shape laid along the air, from the cone outward */
function shapePath(r: number, recipe: Recipe): string {
  let path = ''
  for (let d = 0; d <= AIR_TO - AIR_FROM; d += 4) {
    const y = SHAPE_Y - SHAPE_SCALE * complexSwing(r, d, recipe)
    path += `${path ? ' L' : 'M'}${(AIR_FROM + d).toFixed(1)} ${y.toFixed(1)}`
  }
  return path
}

function makePainter(find: Finder): Painter {
  const string = find('string'), mode1 = find('mode1'), mode2 = find('mode2')
  const rows = ROW_Y.map((y, i) => {
    const n = i + 1
    return { n, y, arm: find(`arm${n}`), tip: find(`tip${n}`), reach: find(`reach${n}`), trace: find(`trace${n}`), dot: find(`dot${n}`) }
  })
  const rings = find.all('rings'), arms = find.all('arms')
  const tip = find('sumTip'), reach = find('sumReach'), trace = find('sumTrace'), dot = find('sumDot')
  const cone = find('cone'), shape = find('shape')
  const air = find.dots('air', AIR_DOTS, 1.8).map((el, i) => ({ el, x: AIR_DOTS[i].x }))
  for (const { el } of air) el.setAttribute('fill', INK)

  return (deg, step) => {
    const r = rad(deg), whole = Math.round(deg), x = graphX(deg)
    const count = countAt(step), recipe = recipeAt(step)

    // The string: in as many harmonics as are added up — and, while two, each one alone
    string.setAttribute('d', stringPath((along) => stringSwing(r, along, recipe, count)))
    if (step === 2 || step === 3) {
      mode1.setAttribute('d', stringPath((along) => harmonicSwing(r, along, 1, SAWTOOTH[0])))
      mode2.setAttribute('d', stringPath((along) => harmonicSwing(r, along, 2, SAWTOOTH[1])))
    }

    // Each harmonic alone: its circle's height, drawn out over the cycle
    for (const row of rows) {
      if (step < ROW_STEP[row.n - 1]) continue
      const radius = radiusOf(row.n, recipe), graph = rowGraph(row.n, recipe)
      const px = CIRCLE_X + radius * Math.cos(row.n * r + recipe[row.n - 1].phase), py = graph(deg)
      line(row.arm, CIRCLE_X, row.y, px, py)
      put(row.tip, 'cx', px); put(row.tip, 'cy', py)
      line(row.reach, px, py, x, py)
      row.trace.setAttribute('d', curvePath(whole, graphX, graph))
      put(row.dot, 'cx', x); put(row.dot, 'cy', py)
    }

    // What they make together: each circle riding on the one before, the last one's tip their sum
    if (step >= 3) {
      const points = circlesOnCircles(r, recipe, count, UNIT)
      for (let n = 0; n < count; n++) {
        const c = points[n], t = points[n + 1]
        put(rings[n], 'cx', CHAIN_X + c.x); put(rings[n], 'cy', CHAIN_Y - c.y)
        line(arms[n], CHAIN_X + c.x, CHAIN_Y - c.y, CHAIN_X + t.x, CHAIN_Y - t.y)
      }
      const end = points[count], tx = CHAIN_X + end.x, ty = CHAIN_Y - end.y, gx = sumX(deg)
      put(tip, 'cx', tx); put(tip, 'cy', ty)
      line(reach, tx, ty, gx, ty)
      trace.setAttribute('d', curvePath(whole, sumX, sumOf(recipe, count)))
      put(dot, 'cx', gx); put(dot, 'cy', ty)
    }

    // The cone moves in that shape, and the air carries it away
    if (step >= 6) {
      const push = complexSwing(r, 0, recipe)
      cone.setAttribute('d', `M651 725 L${(CONE_X + push).toFixed(1)} 689 L${(CONE_X + push).toFixed(1)} 801 L651 765 Z`)
      for (const p of air) put(p.el, 'cx', clamp(p.x + complexSwing(r, p.x - CONE_X, recipe), AIR_FROM - 4, AIR_TO + 2))
      shape.setAttribute('d', shapePath(r, recipe))
    }
  }
}

const DASHED = { fill: 'none', stroke: PART, strokeWidth: 1, strokeDasharray: '6 5' } as const
const REACH  = { stroke: FLOW, strokeWidth: 1, strokeDasharray: '4 3' } as const

/** A graph's two axes: up at its left edge, time to the right */
function Axes({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <>
      <line x1={x} y1={y - h} x2={x} y2={y + h} stroke={INK} strokeWidth={1.5} />
      <line x1={x} y1={y} x2={x + GRAPH_W + 24} y2={y} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
    </>
  )
}

/** One harmonic alone: its circle, turning n times as fast, and its sine beside it */
function Harmonic({ n, name, recipe }: { n: number; name: string; recipe: Recipe }) {
  // Its label and axes keep the sawtooth's place: the row stays put when the piano's sizes come in
  const y = ROW_Y[n - 1], room = radiusOf(n, SAWTOOTH), radius = radiusOf(n, recipe), big = n === 1
  return (
    <>
      <Label at={[GRAPH_X + 8, y - room - (big ? 18 : 8)]}>{name}</Label>
      <Axes x={GRAPH_X} y={y} h={room + (big ? 10 : 6)} />
      <circle cx={CIRCLE_X} cy={y} r={radius} {...DASHED} fill={MOVER} fillOpacity={0.08} />
      <line data-p={`arm${n}`} stroke={INK} strokeWidth={big ? 2.5 : 2} />
      <circle cx={CIRCLE_X} cy={y} r={big ? 3.5 : 2.5} fill={INK} />
      <line data-p={`reach${n}`} {...REACH} />
      <circle data-p={`tip${n}`} r={big ? 7 : 5} fill={MOVER} />
      <path d={curvePath(360, graphX, rowGraph(n, recipe))} fill="none" stroke={TRACE} strokeWidth={big ? 3 : 2} opacity={0.3} />
      <path data-p={`trace${n}`} fill="none" stroke={TRACE} strokeWidth={big ? 3.5 : 2.5} strokeLinecap="round" />
      <circle data-p={`dot${n}`} r={big ? 6 : 4.5} fill={MOVER} />
    </>
  )
}

export function ComplexScene({ step, onPainter }: SceneProps) {
  const root = useRef<SVGGElement>(null)
  usePainter(root, onPainter, makePainter)
  const { t, fmt } = useTranslation()
  const l = t.deeper.labels
  const count = countAt(step), recipe = recipeAt(step), piano = step >= PIANO_STEP
  // The piano's harmonics are not "half as big", "a third as big": only their numbers then
  const nameOf = (n: number) =>
    n === 1 ? l.fundamental
    : n === 2 && !piano ? l.secondHarmonic
    : n === 3 && !piano ? l.thirdHarmonic
    : fmt(l.nthHarmonic, { n: String(n) })

  return (
    <g ref={root}>
      {/* The string, held at both ends: in the harmonics added up, growing down beside the rows reached */}
      <Step n={1} step={step}>
        <g className="lsc-dd-grow" style={{ transform: stretch(step) }}>
          <Step n={1} until={1} step={step}>
            <path d={stringPath((along) => Math.sin(Math.PI * along))} {...DASHED} vectorEffect="non-scaling-stroke" />
            <path d={stringPath((along) => -Math.sin(Math.PI * along))} {...DASHED} vectorEffect="non-scaling-stroke" />
          </Step>
          <Step n={2} until={3} step={step}>
            <path data-p="mode1" fill="none" stroke={PART} strokeWidth={1.25} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
            <path data-p="mode2" fill="none" stroke={PART} strokeWidth={1.25} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          </Step>
          <path data-p="string" fill="none" stroke={INK} strokeWidth={3} vectorEffect="non-scaling-stroke" />
        </g>
        <circle cx={STRING_X} cy={STRING_TOP} r={9} fill={MOVER} />
        <circle className="lsc-dd-grow" cx={STRING_X} cy={0} r={9} fill={MOVER} style={{ transform: bottomAt(step) }} />
        <Label at={[STRING_X, 42]} anchor="middle">{l.string}</Label>
      </Step>

      {/* Each harmonic alone, one below the other */}
      {ROW_Y.map((_, i) => (
        <Step key={i} n={ROW_STEP[i]} step={step}>
          <Harmonic n={i + 1} name={nameOf(i + 1)} recipe={recipe} />
          {i === 0 && ([0, 90, 180, 270, 360] as const).map((deg) => (
            <Label key={deg} at={[graphX(deg), ROW_Y[0] + 88]} anchor="middle">{deg}°</Label>
          ))}
        </Step>
      ))}

      {/* What they make together: circles on circles, their sum, the recipe */}
      <Step n={3} step={step}>
        <Label at={[SUM_X + 8, 172]}>{piano ? l.pianoC5 : fmt(l.sinesAddedUp, { n: String(count) })}</Label>
        <g data-p="rings">
          {recipe.map(({ size }, i) => (
            <circle key={i} r={UNIT * size}fill="none" stroke={i ? FAINT : PART} strokeWidth={1}
              strokeDasharray={i ? undefined : '6 5'} style={i < count ? undefined : { display: 'none' }} />
          ))}
        </g>
        <g data-p="arms">
          {SAWTOOTH.map((_, i) => (
            <line key={i} stroke={INK} strokeWidth={Math.max(1, 2.5 - i * 0.2)} style={i < count ? undefined : { display: 'none' }} />
          ))}
        </g>
        <circle cx={CHAIN_X} cy={CHAIN_Y} r={3.5} fill={INK} />
        <line data-p="sumReach" {...REACH} />
        <circle data-p="sumTip" r={7} fill={MOVER} />
        <line x1={SUM_X} y1={SUM_Y - 125} x2={SUM_X} y2={SUM_Y + 125} stroke={INK} strokeWidth={1.5} />
        <line x1={SUM_X} y1={SUM_Y} x2={SUM_X + GRAPH_W + 24} y2={SUM_Y} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
        <path d={curvePath(360, sumX, sumOf(recipe, count))} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
        <path data-p="sumTrace" fill="none" stroke={TRACE} strokeWidth={3.5} strokeLinecap="round" />
        <circle data-p="sumDot" r={6} fill={MOVER} />
        {/* The recipe: how big each sine is */}
        <Label at={[SUM_X + 8, 466]}>{l.recipe}</Label>
        {recipe.slice(0, count).map(({ size }, i) => {
          const h = BAR_H * size, x = BAR_X + i * BAR_STEP
          return (
            <g key={i}>
              <rect x={x} y={BAR_BOTTOM - h} width={BAR_W} height={h} rx={2} fill={TRACE} />
              <Label at={[x + BAR_W / 2, BAR_BOTTOM + 16]} anchor="middle">{i + 1}</Label>
            </g>
          )
        })}
      </Step>

      {/* With ten: the sawtooth the sum comes close to (not the piano's) */}
      <Step n={5} until={PIANO_STEP - 1} step={step}>
        <path d={`M${SUM_X} ${SUM_Y} V${SUM_Y - (UNIT * Math.PI) / 2} L${SUM_X + GRAPH_W} ${SUM_Y + (UNIT * Math.PI) / 2} V${SUM_Y}`}
          fill="none" stroke={INK} strokeWidth={1.25} strokeDasharray="5 4" />
        <Label at={[SUM_X + GRAPH_W, 432]} anchor="end">{l.sawtooth}</Label>
      </Step>

      {/* The complex wave in the air, lower right */}
      <Step n={6} step={step}>
        <Air id="lsc-dd-air-complex" x={AIR_FROM} y={AIR_Y} w={AIR_TO - AIR_FROM} h={AIR_H} r={55} />
        <g data-p="air" mask="url(#lsc-dd-air-complex)" />
        <rect x={624} y={719} width={27} height={52} rx={3} fill={PART_3} />
        <path data-p="cone" d={`M651 725 L${CONE_X} 689 L${CONE_X} 801 L651 765 Z`} fill={PART} fillOpacity={0.35} stroke={PART} strokeWidth={1.5} />
        <Label at={[662, 828]} anchor="middle">{l.speakerCone}</Label>
        <line x1={AIR_FROM} y1={SHAPE_Y} x2={AIR_TO} y2={SHAPE_Y} stroke={FAINT} strokeWidth={0.75} />
        <path data-p="shape" fill="none" stroke={TRACE} strokeWidth={2.5} strokeLinejoin="round" />
        <Label at={[AIR_TO - 70, 832]} anchor="end" flow>{l.inTheAir} · {l.speedOfSound}</Label>
        <line x1={AIR_TO - 62} y1={828} x2={AIR_TO - 4} y2={828} stroke={FLOW} strokeWidth={2} markerEnd={ARROW} />
      </Step>
    </g>
  )
}
