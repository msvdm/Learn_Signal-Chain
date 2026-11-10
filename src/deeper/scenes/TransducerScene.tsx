import { useRef } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { HEADS_APART, K, REEL_R, SWING, TAPE_WAVELENGTH, clamp, curvePath, playbackVoltage, rad, reelTurn, scatter, swing, tapeMagnet } from '../wave'
import { ARROW, FAINT, FLOW, INK, MOVER, PART, PART_2, PART_3, TRACE } from './look'
import { put, usePainter } from './painter'
import type { Finder, Painter, SceneProps } from './painter'
import { Air, Label, Leader, Step } from './sceneParts'

// Transducer and speaker (Dive deeper, D46): a sound wave moves a dynamic microphone's diaphragm,
// its coil moves around a magnet and gives a voltage (the graph beside it shows it, wired to
// nothing); the voltage's current in a recording head magnetises the tape running past its gap; the
// tape's magnets running past a playback head give the voltage again, which moves a speaker's coil
// and cone, and they move the air. The phase is the
// diaphragm's: at 0° it passes its middle, moving fastest — and the voltage, which follows its
// speed, is at its highest. No amplifiers are drawn: the microphone's own voltage is the head's
// current, and the playback head's moves the speaker.

/** Where the microphone's diaphragm rests, along its sound wave */
const DIAPHRAGM_X = 262
/** The voltage's graph: its left edge, width, middle line and half height (2 mV) */
const SCOPE_X = 750, SCOPE_W = 290, SCOPE_Y = 374, SCOPE_H = 55
/** Where the speaker's sound wave starts; how much further its air swings than the microphone's */
const SPEAKER_AIR_X = 1140, LOUDER = 1.8
/** The strips of air before the speaker, darker where the air is pressed together */
const STRIP = 6
const STRIPS = Array.from({ length: 26 }, (_, i) => SPEAKER_AIR_X + i * STRIP)

/** The tape: its top (where the heads touch it), how thick it is drawn; the recording head's gap (under the microphone's coil), the playback head's (under the speaker's leads) */
const TAPE_Y = 990, TAPE_H = 26
const REC_X = 317, PLAY_X = REC_X + HEADS_APART
/** A head's two terminals, either side of its middle; where the playback head's end (the speaker's leads start there) */
const PIN = 8, PIN_TOP = 855
/** The reels' middles, at the picture's two sides: the tape leaves the supply reel's bottom and winds onto the take-up reel's */
const SUPPLY_X = 130, TAKEUP_X = 1220, REEL_Y = TAPE_Y + TAPE_H / 2 - REEL_R
/** The tape's little magnets, every MAGNET_GAP along it (18 to a cycle), at most MAGNET_LONG long */
const MAGNET_GAP = TAPE_WAVELENGTH / 18, MAGNET_LONG = 13
const MAGNETS = Math.ceil((TAKEUP_X - SUPPLY_X) / MAGNET_GAP) + 1
/** The magnetic field at a head's gap: its rings */
const FIELD = [5, 10, 15]

const MIC_DOTS     = scatter(17, 260, { x: 44, y: 601, w: 206, h: 138 })
const SPEAKER_DOTS = scatter(19, 430, { x: 1144, y: 521, w: 148, h: 318 })

const scopeX = (deg: number) => SCOPE_X + (SCOPE_W * deg) / 360
const scopeY = (deg: number) => SCOPE_Y - SCOPE_H * Math.cos(rad(deg))

/** A voltage as its reading says it: a sign, two decimals (none shows as +0.00, never −0.00) */
function millivolts(mv: number): string {
  const shown = mv.toFixed(2)
  return Number(shown) < 0 ? `−${shown.slice(1)}` : `+${Number(shown) === 0 ? '0.00' : shown}`
}

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
  const recField = find('recField'), playField = find('playField'), playReading = find('playReading')
  const magnets = find.all('magnets'), reels = [find('supplyReel'), find('takeupReel')]
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
      // The leads hang from the coil (moving with it) down to the microphone's two terminals
      wireA.setAttribute('d', `M${f(314 + u)} 689 V760 L${REC_X - PIN} 780 V800`)
      wireB.setAttribute('d', `M${f(319 + u)} 689 V760 L${REC_X + PIN} 780 V800`)
      trace.setAttribute('d', curvePath(Math.round(deg), scopeX, scopeY))
      put(dot, 'cx', scopeX(deg)); put(dot, 'cy', scopeY(deg))
      reading.textContent = millivolts(2 * Math.cos(r))
    }

    // 3 · its current through the recording head's coil: a magnetic field at the gap; the tape runs
    // past it and keeps the field it met there — little magnets, the voltage laid out along it
    if (step >= 3) {
      recField.setAttribute('opacity', (0.15 + 0.85 * Math.abs(Math.cos(r))).toFixed(3))
      const moved = (deg / 360) * TAPE_WAVELENGTH
      magnets.forEach((magnet, i) => {
        const x = SUPPLY_X + i * MAGNET_GAP + (moved % MAGNET_GAP)
        const m = tapeMagnet(r, x - REC_X)
        const long = MAGNET_LONG * Math.abs(m)
        if (long < 0.6) { magnet.setAttribute('d', ''); return }
        const way = Math.sign(m), tip = x + (way * long) / 2, head = Math.min(5, long * 0.5), y = TAPE_Y + TAPE_H / 2
        const back = tip - way * head
        magnet.setAttribute('d',
          `M${f(x - (way * long) / 2)} ${y} H${f(back)} M${f(tip)} ${y} L${f(back)} ${f(y - head * 0.75)} L${f(back)} ${f(y + head * 0.75)} Z`)
      })
      const turn = -(reelTurn(r) * 180) / Math.PI
      reels[0].setAttribute('transform', `rotate(${f(turn)} ${SUPPLY_X} ${f(REEL_Y)})`)
      reels[1].setAttribute('transform', `rotate(${f(turn)} ${TAKEUP_X} ${f(REEL_Y)})`)
    }

    // 4 · the tape's magnets at the playback head's gap: a voltage while they change
    if (step >= 4) {
      playField.setAttribute('opacity', (0.15 + 0.85 * Math.abs(tapeMagnet(r, HEADS_APART))).toFixed(3))
      playReading.textContent = millivolts(2 * playbackVoltage(r))
    }

    // 5 · the voltage moves the speaker's coil and cone, and the cone the air
    if (step >= 5) {
      const push = 9 * Math.cos(r)
      cone.setAttribute('d',
        `M202 550 Q${f(196 + push / 2)} 548 ${f(194 + push)} 558 C${f(184 + push)} 590 ${f(150 + push)} 624 ${f(118 + push)} 644 ` +
        `Q${f(142 + push)} 660 ${f(118 + push)} 676 C${f(150 + push)} 696 ${f(184 + push)} 730 ${f(194 + push)} 762 Q${f(196 + push / 2)} 772 202 770`)
      cap.setAttribute('d', `M${f(118 + push)} 644 Q${f(142 + push)} 660 ${f(118 + push)} 676 Z`)
      speakerCoil.forEach((turn, i) => put(turn, 'cx', 96 + i * 4 + push))
      // The speaker is drawn a little larger than life: its leads follow the coil at that size
      const lead = 1.1 * push
      const a = PLAY_X - PIN, b = PLAY_X + PIN
      wireD.setAttribute('d', `M${a} ${PIN_TOP} V612 Q${a} 606 ${a + 6} 606 H1018 Q${f(1032.6 + lead)} 608 ${f(1032.6 + lead)} 660`)
      wireC.setAttribute('d', `M${b} ${PIN_TOP} V620 Q${b} 614 ${b + 6} 614 H1008 Q${f(1023.8 + lead)} 616 ${f(1023.8 + lead)} 660`)
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
        <path data-p="wireA" fill="none" stroke={INK} strokeWidth={1.5} />
        <path data-p="wireB" fill="none" stroke={INK} strokeWidth={1.5} />
        <circle cx={REC_X - PIN} cy={800} r={3} fill={INK} />
        <circle cx={REC_X + PIN} cy={800} r={3} fill={INK} />
        <Label at={[REC_X + 18, 804]}>{l.outputVoltage}</Label>
        <g transform="translate(-150,304)">
          <rect x={730} y={296} width={330} height={156} rx={8} fill="var(--lsc-sunken)" stroke={PART} strokeWidth={1} />
          <g stroke={FAINT} strokeWidth={0.5} strokeDasharray="3 4">
            {[822.5, 895, 967.5].map((x) => <line key={x} x1={x} y1={304} x2={x} y2={444} />)}
            <line x1={740} y1={319} x2={1050} y2={319} />
            <line x1={740} y1={429} x2={1050} y2={429} />
          </g>
          <line x1={740} y1={SCOPE_Y} x2={1050} y2={SCOPE_Y} stroke={PART} strokeWidth={0.75} />
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

      {/* 3 · the recording head and the tape, from one side of the picture to the other */}
      <Step n={3} step={step}>
        <rect x={SUPPLY_X} y={TAPE_Y} width={TAKEUP_X - SUPPLY_X} height={TAPE_H} fill={PART_3} />
        <g data-p="magnets" fill={INK} stroke={INK} strokeWidth={1.8} strokeLinejoin="round">
          {Array.from({ length: MAGNETS }, (_, i) => <path key={i} />)}
        </g>
        <Reel x={SUPPLY_X} name="supplyReel" />
        <Reel x={TAKEUP_X} name="takeupReel" />
        <Label at={[600, 1044]} anchor="middle" flow>{l.magneticTape}</Label>
        <line x1={650} y1={1040} x2={688} y2={1040} stroke={FLOW} strokeWidth={2} markerEnd={ARROW} />
        <Head x={REC_X} field="recField" top={800} />
        <Leader x1={REC_X + 17} y1={890} x2={REC_X + 62} y2={905} />
        <Label at={[REC_X + 66, 909]}>{l.coil}</Label>
        <Label at={[REC_X, 1044]} anchor="middle">{l.recordingHead}</Label>
      </Step>

      {/* 4 · the playback head, and the voltage it gives */}
      <Step n={4} step={step}>
        <Head x={PLAY_X} field="playField" top={PIN_TOP} />
        <circle cx={PLAY_X - PIN} cy={PIN_TOP} r={3} fill={INK} />
        <circle cx={PLAY_X + PIN} cy={PIN_TOP} r={3} fill={INK} />
        <Label at={[PLAY_X, 1044]} anchor="middle">{l.playbackHead}</Label>
        <text className="lsc-dd-reading" x={PLAY_X} y={1070} textAnchor="middle">
          {l.playbackVoltage}: <tspan data-p="playReading">+0.00</tspan> {l.mv}
        </text>
      </Step>

      {/* 5 · the speaker */}
      <Step n={5} step={step}>
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
        <path data-p="wireC" fill="none" stroke={INK} strokeWidth={1.5} />
        <path data-p="wireD" fill="none" stroke={INK} strokeWidth={1.5} />
        <Label at={[986, 758]} anchor="middle">{l.magnet}</Label>
        <Label at={[1036, 782]} anchor="middle">{l.voiceCoil}</Label>
        <Label at={[1112, 834]} anchor="middle">{l.speakerCone}</Label>
      </Step>
    </g>
  )
}

/** A ferrite core, its gap at (0, 0): a bar on top for the coil, its legs narrowing to two tips with the gap between them */
const CORE: readonly [number, number][] = [
  [-1.5, 0], [-10, 0], [-10, -12], [-36, -48], [-36, -106], [36, -106], [36, -48], [10, -12], [10, 0], [1.5, 0],
  [1.5, -24], [4, -24], [24, -50], [24, -92], [-24, -92], [-24, -50], [-4, -24], [-1.5, -24],
]
/** The core's top bar, which the coil is wound round; the top of the shield case */
const BAR_Y = -99, SHIELD_TOP = -122

/**
 * A tape head, for recording or playback: a ferrite core in its shield case, a coil round the core's
 * top, two terminals out of the case (from `top` down), and a narrow gap at the bottom touching the
 * tape; `field`: its magnetic field at the gap (rings reaching into the tape).
 */
function Head({ x, field, top }: { x: number; field: string; top: number }) {
  const y = (dy: number) => TAPE_Y + dy
  return (
    <>
      <path
        d={`M${x - 48} ${y(SHIELD_TOP)} V${y(-34)} Q${x - 48} ${y(-8)} ${x - 18} ${y(-4)} ` +
          `M${x + 48} ${y(SHIELD_TOP)} V${y(-34)} Q${x + 48} ${y(-8)} ${x + 18} ${y(-4)}`}
        fill="none" stroke={PART_3} strokeWidth={4} strokeLinecap="round" />
      <line x1={x - 48} y1={y(SHIELD_TOP)} x2={x + 48} y2={y(SHIELD_TOP)} stroke={PART_3} strokeWidth={1.5} />
      <path d={'M' + CORE.map(([dx, dy]) => `${x + dx} ${y(dy)}`).join(' L') + ' Z'} fill={PART} />
      <g fill="none" stroke={INK} strokeWidth={1.5}>
        {Array.from({ length: 7 }, (_, i) => <ellipse key={i} cx={x - 15 + i * 5} cy={y(BAR_Y)} rx={2.5} ry={10} />)}
        {[-1, 1].map((side) => (
          <path key={side} d={`M${x + side * 15} ${y(BAR_Y - 9)} L${x + side * PIN} ${y(SHIELD_TOP + 6)} V${top}`} />
        ))}
      </g>
      {[-1, 1].map((side) => (
        <rect key={side} x={x + side * PIN - 3} y={y(SHIELD_TOP - 5)} width={6} height={10} fill={PART_2} />
      ))}
      <g data-p={field} fill="none" stroke={MOVER} strokeWidth={1.5} opacity={0.15}>
        {FIELD.map((r) => <path key={r} d={`M${x - r} ${TAPE_Y} A${r} ${r} 0 0 0 ${x + r} ${TAPE_Y}`} />)}
      </g>
    </>
  )
}

/** The cut-outs in a reel's front: three windows onto the tape wound on it */
function reelFront(cx: number, cy: number): string {
  const R = REEL_R + 7, at = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
  let d = `M${cx - R} ${cy.toFixed(1)} A${R} ${R} 0 1 0 ${cx + R} ${cy.toFixed(1)} A${R} ${R} 0 1 0 ${cx - R} ${cy.toFixed(1)} Z`
  for (let k = 0; k < 3; k++) {
    const a0 = rad(k * 120 - 40), a1 = rad(k * 120 + 40), inner = 20, outer = REEL_R - 3
    d += ` M${at(outer, a0)} A${outer} ${outer} 0 0 1 ${at(outer, a1)} L${at(inner, a1)} A${inner} ${inner} 0 0 0 ${at(inner, a0)} Z`
  }
  return d
}

/** A reel: the tape wound on it, and its front with three windows, turning (`name`) */
function Reel({ x, name }: { x: number; name: string }) {
  return (
    <>
      <circle cx={x} cy={REEL_Y} r={REEL_R} fill={PART_3} />
      <g data-p={name}>
        <path d={reelFront(x, REEL_Y)} fill="var(--lsc-sunken)" fillRule="evenodd" stroke={PART} strokeWidth={1.5} />
        <circle cx={x} cy={REEL_Y} r={7} fill={PART} />
      </g>
    </>
  )
}
