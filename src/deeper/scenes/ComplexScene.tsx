import { useRef } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { addsUp, circlesOnCircles, clamp, complexSwing, curvePath, rad, sawtooth, scatter } from '../wave'
import { ARROW, ARROW_INK, FAINT, FLOW, INK, MOVER, PART, PART_3, TRACE } from './look'
import { put, usePainter } from './painter'
import type { Finder, Painter, SceneProps } from './painter'
import { Air, Label, Step } from './sceneParts'

// Complex waves (Dive deeper, D46): a complex wave built from sines. The fundamental, a second
// sine twice as fast and half as big, the two added up (where both go the same way they add up,
// where they go opposite ways they partly cancel), the same sum as circles on circles, ten sines
// coming close to a sawtooth with their recipe, and that shape travelling through the air. The
// phase is the fundamental's: everything is one function of it.

// ── Where things are, in the scene's units ──────────────────────────────────
/** The first sine's radius: every other sine is a share of it */
const UNIT = 60
/** The circles on the left, and the three graphs beside them: the first sine, the second, their sum */
const CIRCLE_X = 110, Y1 = 130, Y2 = 290, Y3 = 480
const GRAPH_X = 220, GRAPH_W = 360
/** Ten sines: their circles' first centre, their graph, their recipe's bars */
const SINES = 10
const CHAIN_X = 740, CHAIN_Y = 300, RIGHT_X = 960, Y5 = 300
const BAR_X = 966, BAR_STEP = 36, BAR_W = 22, BAR_BOTTOM = 560, BAR_H = 80
/** The air: where the speaker cone's front rests, how far the air reaches, the wave's shape above it */
const CONE_X = 104, AIR_FROM = 116, AIR_TO = 1360, SHAPE_Y = 618, SHAPE_SCALE = 1.5

const AIR_DOTS = scatter(23, 900, { x: AIR_FROM, y: 662, w: AIR_TO - AIR_FROM, h: 116 })

const graphX = (deg: number) => GRAPH_X + (GRAPH_W * deg) / 360
const rightX = (deg: number) => RIGHT_X + (GRAPH_W * deg) / 360
const first  = (deg: number) => Y1 - UNIT * Math.sin(rad(deg))
const second = (deg: number) => Y2 - (UNIT / 2) * Math.sin(2 * rad(deg))
const both   = (deg: number) => Y3 - UNIT * sawtooth(rad(deg), 2)
const ten    = (deg: number) => Y5 - UNIT * sawtooth(rad(deg), SINES)

/** An arrow from `from` to `to` straight up or down at `x` — hidden while too short to show */
function arrow(el: SVGElement, x: number, from: number, to: number) {
  put(el, 'x1', x); put(el, 'x2', x); put(el, 'y1', from); put(el, 'y2', to)
  el.style.opacity = Math.abs(to - from) < 6 ? '0' : '1'
}

/** A circle's radius from its centre to its tip */
function arm(el: SVGElement, x1: number, y1: number, x2: number, y2: number) {
  put(el, 'x1', x1); put(el, 'y1', y1); put(el, 'x2', x2); put(el, 'y2', y2)
}

/** The ten sines' shape laid along the air, from the cone outward */
function shapePath(r: number): string {
  let path = ''
  for (let d = 0; d <= AIR_TO - AIR_FROM; d += 4) {
    const y = SHAPE_Y - SHAPE_SCALE * complexSwing(r, d, SINES)
    path += `${path ? ' L' : 'M'}${(AIR_FROM + d).toFixed(1)} ${y.toFixed(1)}`
  }
  return path
}

function makePainter(find: Finder): Painter {
  const tip1 = find('tip1'), arm1 = find('arm1'), reach1 = find('reach1'), trace1 = find('trace1'), dot1 = find('dot1')
  const tip2 = find('tip2'), arm2 = find('arm2'), reach2 = find('reach2'), trace2 = find('trace2'), dot2 = find('dot2')
  const trace3 = find('trace3'), dot3 = find('dot3')
  const up1 = find('up1'), up2 = find('up2'), sum1 = find('sum1'), sum2 = find('sum2')
  const adds = find('adds'), cancels = find('cancels')
  const bigArm = find('bigArm'), small = find('small'), smallArm = find('smallArm'), tip4 = find('tip4'), reach4 = find('reach4')
  const rings = find.all('rings'), arms = find.all('arms')
  const tip5 = find('tip5'), reach5 = find('reach5'), trace5 = find('trace5'), dot5 = find('dot5')
  const cone = find('cone'), shape = find('shape')
  const air = find.dots('air', AIR_DOTS, 1.8).map((el, i) => ({ el, x: AIR_DOTS[i].x }))
  for (const { el } of air) el.setAttribute('fill', INK)

  return (deg, step) => {
    const r = rad(deg), whole = Math.round(deg)
    const x = graphX(deg)

    // 1 · the first sine: a circle's height, drawn out over the cycle
    const p1x = CIRCLE_X + UNIT * Math.cos(r), p1y = first(deg)
    arm(arm1, CIRCLE_X, Y1, p1x, p1y)
    put(tip1, 'cx', p1x); put(tip1, 'cy', p1y)
    arm(reach1, p1x, p1y, x, p1y)
    trace1.setAttribute('d', curvePath(whole, graphX, first))
    put(dot1, 'cx', x); put(dot1, 'cy', p1y)

    // 2 · the second: twice as fast, half as big
    if (step >= 2) {
      const p2x = CIRCLE_X + (UNIT / 2) * Math.cos(2 * r), p2y = second(deg)
      arm(arm2, CIRCLE_X, Y2, p2x, p2y)
      put(tip2, 'cx', p2x); put(tip2, 'cy', p2y)
      arm(reach2, p2x, p2y, x, p2y)
      trace2.setAttribute('d', curvePath(whole, graphX, second))
      put(dot2, 'cx', x); put(dot2, 'cy', p2y)
    }

    // 3 · their sum: the second's height stacked on the first's
    if (step >= 3) {
      const h1 = UNIT * Math.sin(r), h2 = (UNIT / 2) * Math.sin(2 * r)
      arrow(up1, x, Y1, Y1 - h1)
      arrow(up2, x, Y2, Y2 - h2)
      arrow(sum1, x, Y3, Y3 - h1)
      arrow(sum2, x + 7, Y3 - h1, Y3 - h1 - h2)
      trace3.setAttribute('d', curvePath(whole, graphX, both))
      put(dot3, 'cx', x); put(dot3, 'cy', both(deg))
      const together = addsUp(r)
      adds.style.opacity = together ? '1' : '0'
      cancels.style.opacity = together ? '0' : '1'
    }

    // 4 · the same sum as circles on circles: the small one rides on the big one's tip
    if (step >= 4) {
      const [, a, b] = circlesOnCircles(r, 2, UNIT)
      const ax = CIRCLE_X + a.x, ay = Y3 - a.y, bx = CIRCLE_X + b.x, by = Y3 - b.y
      arm(bigArm, CIRCLE_X, Y3, ax, ay)
      put(small, 'cx', ax); put(small, 'cy', ay)
      arm(smallArm, ax, ay, bx, by)
      put(tip4, 'cx', bx); put(tip4, 'cy', by)
      arm(reach4, bx, by, x, by)
    }

    // 5 · ten sines: ten circles on circles, and their sum close to a sawtooth
    if (step >= 5) {
      const points = circlesOnCircles(r, SINES, UNIT)
      for (let n = 0; n < SINES; n++) {
        const c = points[n], t = points[n + 1]
        put(rings[n], 'cx', CHAIN_X + c.x); put(rings[n], 'cy', CHAIN_Y - c.y)
        arm(arms[n], CHAIN_X + c.x, CHAIN_Y - c.y, CHAIN_X + t.x, CHAIN_Y - t.y)
      }
      const end = points[SINES], tx = CHAIN_X + end.x, ty = CHAIN_Y - end.y, gx = rightX(deg)
      put(tip5, 'cx', tx); put(tip5, 'cy', ty)
      arm(reach5, tx, ty, gx, ty)
      trace5.setAttribute('d', curvePath(whole, rightX, ten))
      put(dot5, 'cx', gx); put(dot5, 'cy', ty)
    }

    // 6 · the cone moves in that shape, and the air carries it away
    if (step >= 6) {
      const push = complexSwing(r, 0, SINES)
      cone.setAttribute('d', `M55 700 L${(CONE_X + push).toFixed(1)} 664 L${(CONE_X + push).toFixed(1)} 776 L55 740 Z`)
      for (const p of air) put(p.el, 'cx', clamp(p.x + complexSwing(r, p.x - CONE_X, SINES), AIR_FROM - 4, AIR_TO + 2))
      shape.setAttribute('d', shapePath(r))
    }
  }
}

const DASHED = { fill: 'none', stroke: PART, strokeWidth: 1, strokeDasharray: '6 5' } as const

/** A graph's two axes: up at its left edge, time to the right */
function Axes({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <>
      <line x1={x} y1={y - h} x2={x} y2={y + h} stroke={INK} strokeWidth={1.5} />
      <line x1={x} y1={y} x2={x + GRAPH_W + 24} y2={y} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
    </>
  )
}

/** A sine's graph: all of its cycle faint, the part drawn so far, its dot */
function Graph({ name, from, to, dot }: { name: string; from: (deg: number) => number; to: (deg: number) => number; dot: string }) {
  return (
    <>
      <path d={curvePath(360, from, to)} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
      <path data-p={name} fill="none" stroke={TRACE} strokeWidth={3.5} strokeLinecap="round" />
      <circle data-p={dot} r={6} fill={MOVER} />
    </>
  )
}

/** A circle turning with its sine: its round, its radius, its tip, the line over to the graph */
function Turning({ y, radius, n }: { y: number; radius: number; n: 1 | 2 }) {
  return (
    <>
      <circle cx={CIRCLE_X} cy={y} r={radius} {...DASHED} fill={MOVER} fillOpacity={0.08} />
      <line data-p={`arm${n}`} stroke={INK} strokeWidth={2.5} />
      <circle cx={CIRCLE_X} cy={y} r={3.5} fill={INK} />
      <line data-p={`reach${n}`} stroke={FLOW} strokeWidth={1} strokeDasharray="4 3" />
      <circle data-p={`tip${n}`} r={7} fill={MOVER} />
    </>
  )
}

const ARROW_LINE = { stroke: INK, strokeWidth: 2.5, markerEnd: ARROW_INK } as const

export function ComplexScene({ step, onPainter }: SceneProps) {
  const root = useRef<SVGGElement>(null)
  usePainter(root, onPainter, makePainter)
  const l = useTranslation().t.deeper.labels
  const third = (n: number) => graphX(n * 90)

  return (
    <g ref={root}>
      {/* 3 · where the two add up and where they partly cancel, behind the graphs */}
      <Step n={3} step={step}>
        <rect x={third(0)} y={60} width={GRAPH_W / 4} height={525} fill={MOVER} opacity={0.1} />
        <rect x={third(3)} y={60} width={GRAPH_W / 4} height={525} fill={MOVER} opacity={0.1} />
        <rect x={third(1)} y={60} width={GRAPH_W / 2} height={525} fill={PART_3} opacity={0.08} />
        <Label at={[(third(0) + third(1)) / 2, 578]} anchor="middle">{l.addUp}</Label>
        <Label at={[(third(1) + third(3)) / 2, 578]} anchor="middle">{l.cancel}</Label>
        <Label at={[(third(3) + third(4)) / 2, 578]} anchor="middle">{l.addUp}</Label>
      </Step>

      {/* 1 · the first sine */}
      <Step n={1} step={step}>
        <Label at={[GRAPH_X + 8, 52]}>{l.fundamental}</Label>
        <Axes x={GRAPH_X} y={Y1} h={70} />
        <Turning y={Y1} radius={UNIT} n={1} />
        <Graph name="trace1" from={graphX} to={first} dot="dot1" />
        {([0, 90, 180, 270, 360] as const).map((deg) => (
          <Label key={deg} at={[graphX(deg), Y1 + 88]} anchor="middle">{deg}°</Label>
        ))}
      </Step>

      {/* 2 · the second sine */}
      <Step n={2} step={step}>
        <Label at={[GRAPH_X + 8, Y2 - 46]}>{l.secondHarmonic}</Label>
        <Axes x={GRAPH_X} y={Y2} h={40} />
        <Turning y={Y2} radius={UNIT / 2} n={2} />
        <Graph name="trace2" from={graphX} to={second} dot="dot2" />
      </Step>

      {/* 3 · their sum, and the two heights stacked */}
      <Step n={3} step={step}>
        <Label at={[GRAPH_X + 8, Y3 - 96]}>{l.sum}</Label>
        <text data-p="adds" className="lsc-dd-label" x={GRAPH_X + GRAPH_W} y={Y3 - 70} textAnchor="end" style={{ fill: INK }}>{l.constructive}</text>
        <text data-p="cancels" className="lsc-dd-label" x={GRAPH_X + GRAPH_W} y={Y3 - 70} textAnchor="end" style={{ fill: INK, opacity: 0 }}>{l.destructive}</text>
        <Axes x={GRAPH_X} y={Y3} h={88} />
        <Graph name="trace3" from={graphX} to={both} dot="dot3" />
        <line data-p="up1" {...ARROW_LINE} />
        <line data-p="up2" {...ARROW_LINE} />
        <line data-p="sum1" {...ARROW_LINE} />
        <line data-p="sum2" {...ARROW_LINE} />
      </Step>

      {/* 4 · the sum as circles on circles */}
      <Step n={4} step={step}>
        <circle cx={CIRCLE_X} cy={Y3} r={UNIT} {...DASHED} fill={MOVER} fillOpacity={0.08} />
        <circle data-p="small" r={UNIT / 2} fill="none" stroke={PART} strokeWidth={1} strokeDasharray="4 4" />
        <line data-p="bigArm" stroke={INK} strokeWidth={2.5} />
        <line data-p="smallArm" stroke={INK} strokeWidth={2} />
        <circle cx={CIRCLE_X} cy={Y3} r={3.5} fill={INK} />
        <line data-p="reach4" stroke={FLOW} strokeWidth={1} strokeDasharray="4 3" />
        <circle data-p="tip4" r={7} fill={MOVER} />
      </Step>

      {/* 5 · ten sines, close to a sawtooth, and their recipe */}
      <Step n={5} step={step}>
        <Label at={[RIGHT_X + 8, 172]}>{l.tenSines}</Label>
        <g data-p="rings">
          {Array.from({ length: SINES }, (_, i) => (
            <circle key={i} r={UNIT / (i + 1)} fill="none" stroke={i ? FAINT : PART} strokeWidth={1} strokeDasharray={i ? undefined : '6 5'} />
          ))}
        </g>
        <g data-p="arms">
          {Array.from({ length: SINES }, (_, i) => <line key={i} stroke={INK} strokeWidth={Math.max(1, 2.5 - i * 0.2)} />)}
        </g>
        <circle cx={CHAIN_X} cy={CHAIN_Y} r={3.5} fill={INK} />
        <line data-p="reach5" stroke={FLOW} strokeWidth={1} strokeDasharray="4 3" />
        <circle data-p="tip5" r={7} fill={MOVER} />
        <line x1={RIGHT_X} y1={Y5 - 125} x2={RIGHT_X} y2={Y5 + 125} stroke={INK} strokeWidth={1.5} />
        <line x1={RIGHT_X} y1={Y5} x2={RIGHT_X + GRAPH_W + 24} y2={Y5} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
        {/* The sawtooth the sum comes close to */}
        <path d={`M${RIGHT_X} ${Y5} V${Y5 - (UNIT * Math.PI) / 2} L${RIGHT_X + GRAPH_W} ${Y5 + (UNIT * Math.PI) / 2} V${Y5}`}
          fill="none" stroke={INK} strokeWidth={1.25} strokeDasharray="5 4" />
        <Label at={[RIGHT_X + GRAPH_W, 432]} anchor="end">{l.sawtooth}</Label>
        <Graph name="trace5" from={rightX} to={ten} dot="dot5" />
        {/* The recipe: how big each sine is */}
        <Label at={[RIGHT_X + 8, 466]}>{l.recipe}</Label>
        {Array.from({ length: SINES }, (_, i) => {
          const h = BAR_H / (i + 1), x = BAR_X + i * BAR_STEP
          return (
            <g key={i}>
              <rect x={x} y={BAR_BOTTOM - h} width={BAR_W} height={h} rx={2} fill={TRACE} opacity={i < 2 ? 1 : 0.6} />
              <Label at={[x + BAR_W / 2, BAR_BOTTOM + 16]} anchor="middle">{i + 1}</Label>
            </g>
          )
        })}
      </Step>

      {/* 6 · the complex wave in the air */}
      <Step n={6} step={step}>
        <Air id="lsc-dd-air-complex" x={AIR_FROM} y={662} w={AIR_TO - AIR_FROM} h={116} r={58} />
        <g data-p="air" mask="url(#lsc-dd-air-complex)" />
        <rect x={28} y={694} width={27} height={52} rx={3} fill={PART_3} />
        <path data-p="cone" d={`M55 700 L${CONE_X} 664 L${CONE_X} 776 L55 740 Z`} fill={PART} fillOpacity={0.35} stroke={PART} strokeWidth={1.5} />
        <Label at={[66, 800]} anchor="middle">{l.speakerCone}</Label>
        <line x1={AIR_FROM} y1={SHAPE_Y} x2={AIR_TO} y2={SHAPE_Y} stroke={FAINT} strokeWidth={0.75} />
        <path data-p="shape" fill="none" stroke={TRACE} strokeWidth={2.5} strokeLinejoin="round" />
        <Label at={[AIR_TO - 70, 804]} anchor="end" flow>{l.inTheAir} · {l.speedOfSound}</Label>
        <line x1={AIR_TO - 62} y1={800} x2={AIR_TO - 4} y2={800} stroke={FLOW} strokeWidth={2} markerEnd={ARROW} />
      </Step>
    </g>
  )
}
