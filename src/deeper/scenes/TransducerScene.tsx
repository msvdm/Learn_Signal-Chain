import { useRef } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { K, SWING, clamp, curvePath, rad, scatter, swing } from '../wave'
import { ARROW, FAINT, FLOW, INK, MOVER, PART, PART_2, PART_3, TRACE } from './look'
import { put, usePainter } from './painter'
import type { Finder, Painter, SceneProps } from './painter'
import { Air, Label, Leader, Step } from './sceneParts'

// Transducer and speaker (Dive deeper, D46): a sound wave moves a dynamic microphone's diaphragm,
// its coil moves around a magnet and gives a voltage, and the same voltage moves a speaker's coil
// and cone, which move the air again. The phase is the diaphragm's: at 0° it passes its middle,
// moving fastest — and the voltage, which follows its speed, is at its highest.

/** Where the microphone's diaphragm rests, along its sound wave */
const DIAPHRAGM_X = 262
/** The voltage's graph: its left edge, width, middle line and half height (2 mV) */
const SCOPE_X = 750, SCOPE_W = 290, SCOPE_Y = 374, SCOPE_H = 55
/** Where the speaker's sound wave starts; how much further its air swings than the microphone's */
const SPEAKER_AIR_X = 1140, LOUDER = 1.8
/** The strips of air before the speaker, darker where the air is pressed together */
const STRIP = 6
const STRIPS = Array.from({ length: 26 }, (_, i) => SPEAKER_AIR_X + i * STRIP)

const MIC_DOTS     = scatter(17, 260, { x: 44, y: 601, w: 206, h: 138 })
const SPEAKER_DOTS = scatter(19, 430, { x: 1144, y: 521, w: 148, h: 318 })

const scopeX = (deg: number) => SCOPE_X + (SCOPE_W * deg) / 360
const scopeY = (deg: number) => SCOPE_Y - SCOPE_H * Math.cos(rad(deg))

function makePainter(find: Finder): Painter {
  const micAir = find.dots('micAir', MIC_DOTS).map((el, i) => ({ el, x: MIC_DOTS[i].x }))
  const speakerAir = find.dots('speakerAir', SPEAKER_DOTS).map((el, i) => ({ el, x: SPEAKER_DOTS[i].x }))
  for (const { el } of [...micAir, ...speakerAir]) el.setAttribute('fill', INK)
  const diaphragm = find('diaphragm'), coil = find.all('coil')
  const wireA = find('wireA'), wireB = find('wireB')
  const trace = find('trace'), dot = find('dot'), reading = find('reading')
  const cone = find('cone'), cap = find('cap'), speakerCoil = find.all('speakerCoil')
  const wireC = find('wireC'), wireD = find('wireD')
  const strips = find.all('strips')
  const f = (n: number) => n.toFixed(1)

  return (deg, step) => {
    const r = rad(deg)

    // 1 · the sound wave moves the diaphragm, and the coil on it
    for (const p of micAir) put(p.el, 'cx', clamp(p.x + swing(r, p.x - DIAPHRAGM_X), 42, 250))
    const u = 0.5 * SWING * Math.sin(r)
    diaphragm.setAttribute('d',
      `M746 112 Q${f(734 + u / 2)} 128 ${f(744 + u)} 146 Q${f(704 + u)} 175 ${f(744 + u)} 204 Q${f(734 + u / 2)} 222 746 238`)
    coil.forEach((turn, i) => put(turn, 'cx', 748 + u + i * 5))

    // 2 · the voltage: highest while the coil moves fastest, none while it turns back
    if (step >= 2) {
      wireA.setAttribute('d', `M${f(776 + u)} 194 V282 Q${f(776 + u)} 288 782 288 H1020 Q1026 288 1026 282 V263 Q1026 257 1032 257 H1042`)
      wireB.setAttribute('d', `M${f(781 + u)} 194 V274 Q${f(781 + u)} 280 787 280 H1012 Q1018 280 1018 274 V256 Q1018 250 1024 250 H1042`)
      trace.setAttribute('d', curvePath(Math.round(deg), scopeX, scopeY))
      put(dot, 'cx', scopeX(deg)); put(dot, 'cy', scopeY(deg))
      const mv = 2 * Math.cos(r)
      reading.textContent = `${mv >= 0 ? '+' : '−'}${Math.abs(mv).toFixed(2)}`
    }

    // 3 · the voltage moves the speaker's coil and cone, and the cone the air
    if (step >= 3) {
      const push = 9 * Math.cos(r)
      cone.setAttribute('d',
        `M202 550 Q${f(196 + push / 2)} 548 ${f(194 + push)} 558 C${f(184 + push)} 590 ${f(150 + push)} 624 ${f(118 + push)} 644 ` +
        `Q${f(142 + push)} 660 ${f(118 + push)} 676 C${f(150 + push)} 696 ${f(184 + push)} 730 ${f(194 + push)} 762 Q${f(196 + push / 2)} 772 202 770`)
      cap.setAttribute('d', `M${f(118 + push)} 644 Q${f(142 + push)} 660 ${f(118 + push)} 676 Z`)
      speakerCoil.forEach((turn, i) => put(turn, 'cx', 96 + i * 4 + push))
      // The speaker is drawn a little larger than life: its leads follow the coil at that size
      const lead = 1.1 * push
      wireC.setAttribute('d', `M910 614 H1008 Q${f(1023.8 + lead)} 616 ${f(1023.8 + lead)} 660`)
      wireD.setAttribute('d', `M910 606 H1018 Q${f(1032.6 + lead)} 608 ${f(1032.6 + lead)} 660`)
      strips.forEach((strip, i) => {
        const pressed = -Math.sin(r - K * (STRIPS[i] + STRIP / 2 - SPEAKER_AIR_X))
        strip.setAttribute('opacity', (0.04 + 0.22 * Math.max(0, pressed)).toFixed(3))
      })
      for (const p of speakerAir) {
        const x = p.x + LOUDER * SWING * Math.cos(r - K * (p.x - SPEAKER_AIR_X))
        put(p.el, 'cx', clamp(x, 1142, 1293))
      }
    }
  }
}

export function TransducerScene({ step, onPainter }: SceneProps) {
  const root = useRef<SVGGElement>(null)
  usePainter(root, onPainter, makePainter)
  const l = useTranslation().t.deeper.labels

  return (
    <g ref={root}>
      {/* 1 · the microphone */}
      <Step n={1} step={step}>
        <Air id="lsc-dd-air-mic" x={46} y={601} w={203} h={138} r={75} />
        <g data-p="micAir" mask="url(#lsc-dd-air-mic)" />
        <Label at={[110, 582]} anchor="middle" flow>{l.soundWave}</Label>
        <line x1={170} y1={578} x2={216} y2={578} stroke={FLOW} strokeWidth={2} markerEnd={ARROW} />
        <g transform="translate(-462,495)">
          <rect x={746} y={100} width={8} height={46} fill={PART} />
          <rect x={746} y={204} width={8} height={46} fill={PART} />
          <path d="M754 100 H815 Q855 100 855 140 V210 Q855 250 815 250 H754" fill="none" stroke={PART} strokeWidth={8} />
          <rect x={770} y={162} width={81} height={26} fill={PART_2} />
          <g data-p="coil" fill="none" stroke={INK} strokeWidth={1.5}>
            {Array.from({ length: 7 }, (_, i) => <ellipse key={i} cy={175} rx={3} ry={20} />)}
          </g>
          <path data-p="diaphragm" fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <Label at={[723, 76]} anchor="middle">{l.diaphragm}</Label>
          <Leader x1={765} y1={198} x2={716} y2={262} />
          <Label at={[712, 276]} anchor="end">{l.voiceCoil}</Label>
          <Leader x1={874} y1={175} x2={836} y2={175} />
          <Label at={[880, 179]}>{l.magnet}</Label>
          <Leader x1={874} y1={234} x2={852} y2={234} />
          <Label at={[880, 238]}>{l.magneticStructure}</Label>
        </g>
      </Step>

      {/* 2 · the voltage it gives */}
      <Step n={2} step={step}>
        <g transform="translate(-462,495)">
          <path data-p="wireA" fill="none" stroke={INK} strokeWidth={1.5} />
          <path data-p="wireB" fill="none" stroke={INK} strokeWidth={1.5} />
          <Label at={[900, 304]} anchor="middle">{l.outputVoltage}</Label>
        </g>
        <g transform="translate(-150,304)">
          <rect x={730} y={296} width={330} height={156} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
          <g stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4">
            {[822.5, 895, 967.5].map((x) => <line key={x} x1={x} y1={304} x2={x} y2={444} />)}
            <line x1={740} y1={319} x2={1050} y2={319} />
            <line x1={740} y1={429} x2={1050} y2={429} />
          </g>
          <line x1={740} y1={SCOPE_Y} x2={1050} y2={SCOPE_Y} stroke={PART} strokeWidth={0.75} />
          <circle cx={730} cy={441} r={3} fill={INK} />
          <circle cx={730} cy={448} r={3} fill={INK} />
          <Label at={[742, 313]}>{l.voltage}</Label>
          <path d={curvePath(360, scopeX, scopeY)} fill="none" stroke={TRACE} strokeWidth={3} opacity={0.3} />
          <path data-p="trace" fill="none" stroke={TRACE} strokeWidth={3} strokeLinecap="round" />
          <circle data-p="dot" cx={SCOPE_X} cy={SCOPE_Y} r={6} fill={MOVER} />
          <Label at={[724, 323]} anchor="end">+2 {l.mv}</Label>
          <Label at={[724, 378]} anchor="end">0</Label>
          <Label at={[724, 433]} anchor="end">−2 {l.mv}</Label>
          <text className="lsc-dd-reading" x={730} y={474}>
            {l.outputVoltage}: <tspan data-p="reading">+0.00</tspan> {l.mv}
          </text>
          <Label at={[1030, 474]} anchor="end">{l.time}</Label>
        </g>
      </Step>

      {/* 3 · the speaker */}
      <Step n={3} step={step}>
        <Air id="lsc-dd-air-speaker" x={1146} y={521} w={143} h={318} r={70} />
        <g data-p="strips" mask="url(#lsc-dd-air-speaker)">
          {STRIPS.map((x) => <rect key={x} x={x} y={515} width={STRIP} height={330} shapeRendering="crispEdges" fill={MOVER} opacity={0.04} />)}
        </g>
        <g data-p="speakerAir" mask="url(#lsc-dd-air-speaker)" />
        <Label at={[1192, 506]} anchor="middle" flow>{l.soundWave}</Label>
        <line x1={1248} y1={502} x2={1290} y2={502} stroke={FLOW} strokeWidth={2} markerEnd={ARROW} />
        <g transform="translate(960,680) scale(1.1) translate(-44,-660)">
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
          <Leader x1={108} y1={738} x2={108} y2={676} />
        </g>
        <circle cx={910} cy={606} r={3} fill={INK} />
        <circle cx={910} cy={614} r={3} fill={INK} />
        <path data-p="wireC" fill="none" stroke={INK} strokeWidth={1.5} />
        <path data-p="wireD" fill="none" stroke={INK} strokeWidth={1.5} />
        <Label at={[986, 758]} anchor="middle">{l.magnet}</Label>
        <Label at={[1036, 782]} anchor="middle">{l.voiceCoil}</Label>
        <Label at={[1112, 834]} anchor="middle">{l.speakerCone}</Label>
      </Step>
    </g>
  )
}
