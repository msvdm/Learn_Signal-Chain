import { memo, useRef } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { K, TAU, clamp, curvePath, rad, scatter, swing } from '../wave'
import { AIR, ARROW, ARROW_INK, FAINT, FLOW, INK, MOVER, PART, TRACE } from './look'
import { put, usePainter } from './painter'
import type { Finder, Painter, SceneProps } from './painter'
import { Air, AirHaze, Label, Step } from './sceneParts'
import { EAR_ART } from './earArt'

// Acoustic propagation and perception (Deep dive, D46): a string moves the air around it, the
// wave travels to the ear — canal, eardrum, ossicles, cochlea, nerve, a brain cell —, and under it
// the same movement as a pendulum, a turn of the phase circle and a sine wave. Everything is one
// function of the phase: the picture at 90° is the same whenever it is shown.

// ── Where things are, in the scene's units ──────────────────────────────────
/** The string: its x at rest, its two ends, how far its middle swings */
const STRING_X = 115, STRING_TOP = 70, STRING_END = 300, STRING_SWING = 34
/** The travelling wave (drawn 200 to the right): where it starts and how far its air reaches */
const WAVE_AT = 200, WAVE_FROM = 245, WAVE_TO = 552
/** The pendulum: its pivot, its length, how far it swings */
const PIVOT_X = 150, PIVOT_Y = 40, ROD = 150, MAX_ANGLE = rad(28)
/** The phase circle and the sine wave beside it */
const CIRCLE_X = 140, CIRCLE_Y = 370, RADIUS = 60
const GRAPH_X = 290, GRAPH_W = 340, GRAPH_Y = 370, GRAPH_H = 60
/** The eardrum, in the ear's own drawing; how far along the wave it is */
const EARDRUM_X = 813
const earDistance = (x: number) => 760 + (x - 600) * 0.8 - WAVE_AT - WAVE_FROM

const AIR_DOTS    = scatter(7, 680, { x: -12, y: 78, w: WAVE_TO + 10, h: 214 })
const STRING_DOTS = scatter(11, 240, { x: 24, y: 76, w: 182, h: 218 })
const CANAL_DOTS  = scatter(13, 55, { x: 684, y: 690, w: 112, h: 24 })

/** The string bowed `off` to one side */
const stringPath = (off: number) =>
  `M${STRING_X} ${STRING_TOP} Q${(STRING_X + 2 * off).toFixed(1)} ${(STRING_TOP + STRING_END) / 2} ${STRING_X} ${STRING_END}`

const graphX = (deg: number) => GRAPH_X + (GRAPH_W * deg) / 360
const graphY = (deg: number) => GRAPH_Y - GRAPH_H * Math.sin(rad(deg))

/** The cochlea's spiral, along which the wave runs inward */
function spiralPath(): string {
  let path = ''
  for (let turn = 0; turn <= 5 * Math.PI; turn += 0.05) {
    const r = 44 - (38 * turn) / (5 * Math.PI)
    path += `${path ? ' L' : 'M'}${(920 - r * Math.cos(turn)).toFixed(1)} ${(684 - r * Math.sin(turn)).toFixed(1)}`
  }
  return path
}

function makePainter(find: Finder): Painter {
  const string = find('string'), stringSpeed = find('stringSpeed')
  // How much of the string's swing each particle beside it feels: none at its ends, all at its middle
  const stringAir = find.dots('stringAir', STRING_DOTS).map((el, i) => ({
    el, x: STRING_DOTS[i].x,
    share: Math.sin((Math.PI * (STRING_DOTS[i].y - STRING_TOP)) / (STRING_END - STRING_TOP)),
  }))
  const air      = find.dots('air', AIR_DOTS).map((el, i) => ({ el, x: AIR_DOTS[i].x }))
  const canalAir = find.dots('canalp', CANAL_DOTS, 1.6).map((el, i) => ({ el, x: CANAL_DOTS[i].x }))
  for (const { el } of [...stringAir, ...air, ...canalAir]) el.setAttribute('fill', INK)
  const eardrum = find('drumL'), ossicles = find('ossL'), soma = find('soma')
  const pulses: [SVGElement, number][] = [[find('cwave'), 25], [find('fpulse'), 17], [find('npulse'), 17], [find('apulse'), 25]]
  find('cwave').setAttribute('d', spiralPath())
  const rod = find('rod'), bob = find('bob'), speed = find('speed')
  const radius = find('radius'), tip = find('tip'), sector = find('sector')
  const reach = find('reach'), trace = find('trace'), dot = find('dot')

  return (deg, step) => {
    const r = rad(deg), sin = Math.sin(r), cos = Math.cos(r)

    // 1 · the string, and how fast it moves (fastest through its middle)
    const bow = STRING_SWING * sin
    string.setAttribute('d', stringPath(bow))
    const v = cos * 40, from = STRING_X + bow + Math.sign(v) * 6
    put(stringSpeed, 'x1', from)
    put(stringSpeed, 'x2', from + v)
    stringSpeed.style.opacity = Math.abs(cos) < 0.08 ? '0' : '1'

    // 2 · the air around it: pushed away on the side the string moves to, never through the string
    if (step >= 2) {
      for (const p of stringAir) {
        const edge = STRING_X + bow * p.share
        const x = p.x + swing(r, Math.abs(p.x - STRING_X)) * p.share
        put(p.el, 'cx', clamp(p.x > STRING_X ? Math.max(x, edge + 4) : Math.min(x, edge - 4), 22, 208))
      }
    }

    // 3 · the wave on its way, then the ear: canal, eardrum, ossicles, cochlea, nerve, brain cell
    if (step >= 3) {
      for (const p of air) put(p.el, 'cx', clamp(p.x + swing(r, p.x - WAVE_FROM), -14, WAVE_TO))
      for (const p of canalAir) put(p.el, 'cx', clamp(p.x + 0.6 * swing(r, earDistance(p.x)), 680, 800))
      const push = 0.3 * swing(r, earDistance(EARDRUM_X))
      eardrum.setAttribute('transform', `translate(${push.toFixed(1)},0)`)
      ossicles.setAttribute('transform', `translate(${(0.7 * push).toFixed(1)},0)`)
      // The pulses leave as the eardrum moves in: one for every cycle
      const turn = (r - K * earDistance(EARDRUM_X) - Math.PI / 2) / TAU
      for (const [el, period] of pulses) el.style.strokeDashoffset = (-turn * period).toFixed(1)
      soma.setAttribute('fill-opacity', (0.35 * Math.max(0, Math.cos(turn * TAU))).toFixed(2))
    }

    // 4 · the pendulum: the same movement
    if (step >= 4) {
      const angle = MAX_ANGLE * sin
      const bx = PIVOT_X + ROD * Math.sin(angle), by = PIVOT_Y + ROD * Math.cos(angle)
      put(rod, 'x2', bx); put(rod, 'y2', by)
      put(bob, 'cx', bx); put(bob, 'cy', by)
      const pv = cos * 44, tx = Math.cos(angle), ty = -Math.sin(angle)
      const ax = bx + Math.sign(pv) * 18 * tx, ay = by + Math.sign(pv) * 18 * ty
      put(speed, 'x1', ax); put(speed, 'y1', ay)
      put(speed, 'x2', ax + pv * tx); put(speed, 'y2', ay + pv * ty)
      speed.style.opacity = Math.abs(cos) < 0.08 ? '0' : '1'
    }

    // 5 · the phase circle: one turn is one cycle
    const px = CIRCLE_X + RADIUS * cos, py = CIRCLE_Y - RADIUS * sin
    if (step >= 5) {
      put(radius, 'x2', px); put(radius, 'y2', py)
      put(tip, 'cx', px); put(tip, 'cy', py)
      const right = CIRCLE_X + RADIUS, left = CIRCLE_X - RADIUS
      sector.setAttribute('d',
        deg < 0.5 ? ''
        : deg >= 359.5 ? `M${right} ${CIRCLE_Y} A${RADIUS} ${RADIUS} 0 1 0 ${left} ${CIRCLE_Y} A${RADIUS} ${RADIUS} 0 1 0 ${right} ${CIRCLE_Y}Z`
        : `M${CIRCLE_X} ${CIRCLE_Y} L${right} ${CIRCLE_Y} A${RADIUS} ${RADIUS} 0 ${deg > 180 ? 1 : 0} 0 ${px.toFixed(1)} ${py.toFixed(1)} Z`)
    }

    // 6 · the sine wave: the circle's height, drawn out over the cycle
    if (step >= 6) {
      const x = graphX(deg), y = graphY(deg)
      put(reach, 'x1', px); put(reach, 'y1', py); put(reach, 'x2', x); put(reach, 'y2', y)
      trace.setAttribute('d', curvePath(Math.round(deg), graphX, graphY))
      put(dot, 'cx', x); put(dot, 'cy', y)
    }
  }
}

/**
 * The ear's drawing, put in the page once: the painter adds the air in its canal and the cochlea's
 * spiral to it and keeps hold of its moving parts, so React must never write it again.
 */
const EAR_HTML = { __html: EAR_ART }
const EarArt = memo(function EarArt() {
  return <g dangerouslySetInnerHTML={EAR_HTML} />
})

const DASHED = { fill: 'none', stroke: PART, strokeWidth: 1.5, strokeDasharray: '6 5' } as const

export function AcousticScene({ step, onPainter }: SceneProps) {
  const root = useRef<SVGGElement>(null)
  usePainter(root, onPainter, makePainter)
  const l = useTranslation().t.deepDive.labels

  return (
    <g ref={root}>
      {/* 2 · the air around the string (its haze only until the wave's own covers it) */}
      <Step n={2} step={step}>
        <Air id="lsc-dd-air-string" x={26} y={76} w={178} h={218} r={95} haze={false} />
        <Step n={2} until={2} step={step}>
          <AirHaze x={26} y={76} w={178} h={218} r={95} />
        </Step>
        <g data-p="stringAir" mask="url(#lsc-dd-air-string)" />
      </Step>

      {/* 1 · the string */}
      <Step n={1} step={step}>
        <path d={stringPath(STRING_SWING)} {...DASHED} />
        <path d={stringPath(-STRING_SWING)} {...DASHED} />
        <path data-p="string" fill="none" stroke={INK} strokeWidth={3} />
        <line data-p="stringSpeed" y1={185} y2={185} stroke={FLOW} strokeWidth={3} markerEnd={ARROW} />
        <circle cx={STRING_X} cy={STRING_TOP} r={9} fill={MOVER} />
        <circle cx={STRING_X} cy={STRING_END} r={9} fill={MOVER} />
        <Label at={[STRING_X, 52]} anchor="middle">{l.string}</Label>
      </Step>

      {/* 4 · the pendulum */}
      <Step n={4} step={step}>
        <g transform="translate(-35,322)">
          <line x1={90} y1={40} x2={210} y2={40} stroke={PART} strokeWidth={3} strokeLinecap="round" />
          <path d="M80 172 A150 150 0 0 0 220 172" {...DASHED} />
          <line x1={150} y1={40} x2={80} y2={172} stroke={PART} strokeWidth={1} strokeDasharray="5 4" />
          <line x1={150} y1={40} x2={220} y2={172} stroke={PART} strokeWidth={1} strokeDasharray="5 4" />
          <circle cx={80} cy={172} r={13} fill="none" stroke={PART} strokeDasharray="4 3" />
          <circle cx={220} cy={172} r={13} fill="none" stroke={PART} strokeDasharray="4 3" />
          <line data-p="rod" x1={PIVOT_X} y1={PIVOT_Y} x2={150} y2={190} stroke={INK} strokeWidth={3} />
          <line data-p="speed" stroke={FLOW} strokeWidth={3} markerEnd={ARROW} />
          <circle cx={PIVOT_X} cy={PIVOT_Y} r={9} fill={MOVER} />
          <circle data-p="bob" cx={150} cy={190} r={14} fill={MOVER} />
          <Label at={[80, 204]} anchor="middle">270°</Label>
          <Label at={[214, 204]} anchor="middle">90°</Label>
          <Label at={[150, 224]} anchor="middle">0° / 180°</Label>
        </g>
      </Step>

      {/* 3 · the wave on its way … */}
      <Step n={3} step={step}>
        <g transform={`translate(${WAVE_AT},0)`}>
          <Air id="lsc-dd-air-wave" x={-174} y={76} w={726} h={218} r={95} />
          <g data-p="air" mask="url(#lsc-dd-air-wave)" />
          <Label at={[338, 56]} anchor="end" flow>{l.longitudinal} · {l.speedOfSound}</Label>
          <line x1={346} y1={52} x2={404} y2={52} stroke={FLOW} strokeWidth={2} markerEnd={ARROW} />
        </g>
      </Step>

      {/* … to the ear and the brain (the drawing: earArt.ts) */}
      <Step n={3} step={step}>
        <EarArt />
        <Label at={[752, 60]} anchor="end">{l.auricle}</Label>
        <Label at={[864, 213]} anchor="middle">{l.earCanal}</Label>
        <Label at={[920, 233]} anchor="middle">{l.eardrum}</Label>
        <Label at={[901, 101]} anchor="middle">{l.ossicles}</Label>
        <Label at={[1024, 223]} anchor="middle">{l.cochlea}</Label>
        <Label at={[1106, 117]} anchor="middle">{l.auditoryNerve}</Label>
        <Label at={[1270, 279]} anchor="middle">{l.brainCell}</Label>
      </Step>

      {/* 5 · the phase circle */}
      <Step n={5} step={step}>
        <g transform="translate(200,40)">
          <circle cx={CIRCLE_X} cy={CIRCLE_Y} r={RADIUS} fill={AIR} fillOpacity={0.08} stroke={PART} strokeWidth={1} strokeDasharray="6 5" />
          <line x1={72} y1={CIRCLE_Y} x2={208} y2={CIRCLE_Y} stroke={FAINT} strokeWidth={0.5} />
          <line x1={CIRCLE_X} y1={302} x2={CIRCLE_X} y2={438} stroke={FAINT} strokeWidth={0.5} />
          <path data-p="sector" fill={AIR} fillOpacity={0.25} />
          <line data-p="radius" x1={CIRCLE_X} y1={CIRCLE_Y} x2={200} y2={CIRCLE_Y} stroke={INK} strokeWidth={2.5} />
          <circle cx={CIRCLE_X} cy={CIRCLE_Y} r={4} fill={INK} />
          <Label at={[214, 374]}>0°</Label>
          <Label at={[140, 296]} anchor="middle">90°</Label>
          <Label at={[66, 374]} anchor="end">180°</Label>
          <Label at={[140, 456]} anchor="middle">270°</Label>
          <circle data-p="tip" cx={200} cy={CIRCLE_Y} r={8} fill={MOVER} />
        </g>
      </Step>

      {/* 6 · the sine wave */}
      <Step n={6} step={step}>
        <g transform="translate(200,40)">
          <line x1={GRAPH_X} y1={300} x2={GRAPH_X} y2={440} stroke={INK} strokeWidth={1.5} />
          <line x1={GRAPH_X} y1={GRAPH_Y} x2={650} y2={GRAPH_Y} stroke={INK} strokeWidth={1.5} markerEnd={ARROW_INK} />
          <Label at={[298, 296]}>{l.sinusoidalWave}</Label>
          <g stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4">
            {[375, 460, 545, 630].map((x) => <line key={x} x1={x} y1={305} x2={x} y2={435} />)}
          </g>
          <path d={curvePath(360, graphX, graphY)} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
          <path data-p="trace" fill="none" stroke={TRACE} strokeWidth={3.5} strokeLinecap="round" />
          <line data-p="reach" stroke={FLOW} strokeWidth={1} strokeDasharray="4 3" />
          <circle data-p="dot" cx={GRAPH_X} cy={GRAPH_Y} r={7} fill={MOVER} />
          {([[290, '0°', l.centreRight], [375, '90°', l.rightPeak], [460, '180°', l.centreLeft], [545, '270°', l.leftPeak], [630, '360°', l.backHome]] as const)
            .map(([x, deg, where]) => (
              <g key={x}>
                <Label at={[x, 470]} anchor="middle">{deg}</Label>
                <Label at={[x, 488]} anchor="middle">{where}</Label>
              </g>
            ))}
          {/* Amplitude: from the centre line to the peak */}
          <line x1={375} y1={GRAPH_Y - GRAPH_H} x2={672} y2={GRAPH_Y - GRAPH_H} stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4" />
          <line x1={666} y1={GRAPH_Y - 4} x2={666} y2={GRAPH_Y - GRAPH_H + 4} stroke={INK} strokeWidth={1.5}
            markerStart={ARROW_INK} markerEnd={ARROW_INK} />
          <Label at={[676, GRAPH_Y - GRAPH_H / 2 + 4]}>{l.amplitude}</Label>
          {/* One cycle: its length in the air, its time; the frequency from it */}
          <line x1={GRAPH_X + 4} y1={506} x2={GRAPH_X + GRAPH_W - 4} y2={506} stroke={INK} strokeWidth={1.5}
            markerStart={ARROW_INK} markerEnd={ARROW_INK} />
          <Label at={[GRAPH_X + GRAPH_W / 2, 526]} anchor="middle">{l.wavelength}</Label>
          <Label at={[GRAPH_X + GRAPH_W / 2, 544]} anchor="middle">{l.period}</Label>
          <Label at={[GRAPH_X + GRAPH_W / 2, 562]} anchor="middle">{l.frequency}</Label>
        </g>
      </Step>
    </g>
  )
}
