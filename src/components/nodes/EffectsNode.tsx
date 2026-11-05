import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { ConditionLabel } from './conditions'
import { MeterBar, MeterScaleRow } from '../SignalMeter'
import { useStage } from '../../hooks/useGraphSignal'
import { useParams } from '../../hooks/useParams'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { takePress, usePointerDrag } from '../../hooks/usePointerDrag'
import { SILENT_WIRE } from '../../signal/engine'
import type { WireSignal } from '../../signal/chain'
import { getHealth } from '../../signal/levels'
import type { SideLevels, SignalDomain } from '../../signal/levels'
import { BAND_COLORS } from '../../signal/eqMath'
import { EFFECT_PROGRAMS } from '../../data/nodeRegistry'
import type { ParamKey } from '../../data/nodeRegistry'
import { cssVar, textWidth } from '../../utils/fitText'
import { PORT_TOP } from '../../utils/layoutHelpers'
import { SelectedEdge } from './ampParts'
import { KnobFace } from '../controls/KnobFace'
import { dialPoint } from './ampDial'

/** Drawn at this many times the size of its drawing, as the Amplifier (D27) */
const S = 2
/** The rack panel in drawing units: 1U, its ears at both ends; its port line halfway down */
const W = 460
const H = 80
const EAR = 22
const ROW = PORT_TOP / S
/** The power rocker and its light, across */
const POWER_X = 40
/** The display: its left edge, width, top, height */
const LCD_X = 60
const LCD_W = 82
const LCD_Y = 22
const LCD_H = 36
/** The knobs: the first's centre across, the step between them, their radius; the words under them */
const KNOB_X = 164
const KNOB_STEP = 41
const KNOB_R = 11
const KNOB_TEXT = 6.5
/** The meters: their words' right edge, the windows (across, width, height), In's and Out's top */
const METER_WORD_X = 335
const WIN_X = 342
const WIN_W = W - EAR - 8 - WIN_X
const WIN_H = 18
const IN_Y = 9
const OUT_Y = 33
/** A bar inside its window, two to a window */
const BAR_H = 6
const BAR_GAP = 2
/** The scale under the Out window (drawing units) */
const SCALE = 6.5
/** The name printed on the panel: its size, the room it has */
const NAME_FONT = 8
const NAME_ROOM = KNOB_X + 3 * KNOB_STEP + KNOB_R - LCD_X
/** A drag up or down this far (screen px) turns a knob through its whole range */
const DRAG_PX = 150

/** Its knobs, left to right, after the Program: their setting, their cap's colour (the app's colours, for colour) */
const KNOBS = [
  { param: 'fxTime',  word: 'time',  color: BAND_COLORS[1] },
  { param: 'fxTone',  word: 'tone',  color: BAND_COLORS[2] },
  { param: 'fxDepth', word: 'depth', color: BAND_COLORS[0] },
] as const satisfies readonly { param: ParamKey; word: string; color: string }[]

/** The display's colours: a lit blue-green screen, the same in both themes */
const LCD_BG   = '#0f2e2b'
const LCD_TEXT = '#5eead4'

/** Its panel a dark grey in both themes, as the Amplifier's (AmpNode RACK_COLOURS) */
const RACK_COLOURS = {
  '--lsc-node-bg':   'var(--lsc-rack-panel)',
  '--lsc-node-bg-2': 'var(--lsc-rack-window)',
  '--lsc-fg':        'var(--lsc-rack-ink)',
  '--lsc-fg-muted':  'var(--lsc-rack-muted)',
  '--lsc-fg-dim':    'var(--lsc-rack-muted)',
  '--lsc-fg-fainter': 'var(--lsc-rack-muted)',
} as CSSProperties

type Drag = { y: number; value: number; max: number; step: number; set: (v: number) => void }

/**
 * Effects processor (Advanced): no card — an effects unit in a rack, 1U, drawn as the Amplifier is
 * (D27: twice the size of its drawing, the same at every zoom). A display with its program, a
 * Program knob and three more, In and Out meters (each side a bar), a power rocker. It makes no
 * effect: its signal goes through as it is, its knobs part of the picture (they turn, they change
 * nothing) — somewhere for an Aux Bus to send. Switched off it sends nothing and goes dark.
 */
export function EffectsNode({ id }: CardProps) {
  const { t }            = useTranslation()
  const name             = useNodeName(id, 'effects')
  const p                = useParams(id, 'effects')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const stage            = useStage(id)

  const on        = p('on')
  const program   = Math.max(0, Math.min(EFFECT_PROGRAMS.length - 1, Math.round(p('fxProgram'))))
  const condition = stage?.condition
  const inSig     = stage?.in ?? SILENT_WIRE
  const outSig    = stage?.out ?? SILENT_WIRE

  const drag = usePointerDrag<Drag>((e, from) => {
    const raw = from.value + ((from.y - e.clientY) / DRAG_PX) * from.max
    from.set(Math.round(Math.max(0, Math.min(from.max, raw)) / from.step) * from.step)
  })

  const nameSize = useMemo(
    () => Math.min(NAME_FONT, NAME_ROOM / Math.max(1e-6, textWidth(name.toUpperCase(), cssVar('--lsc-font-sans'), 600, 0.2))),
    [name],
  )

  const ink = 'var(--lsc-fg)'
  const dim = { opacity: on ? 1 : 0.45, transition: 'opacity 0.25s' }
  const word = { fontSize: KNOB_TEXT, fontFamily: 'var(--lsc-font-sans)', fontWeight: 700, letterSpacing: '0.04em' }

  /** A knob on the panel (`value` 0 … 1 of its sweep), its word under it; turned by a drag up or down. */
  const knob = (i: number, label: string, value: number, color: string, start: (y: number) => void) => {
    const cx = KNOB_X + i * KNOB_STEP
    return (
      <g key={label}>
        {Array.from({ length: 11 }, (_, k) => {
          const a = dialPoint(cx, ROW - 2, KNOB_R + 3, k / 10)
          const b = dialPoint(cx, ROW - 2, KNOB_R + 6, k / 10)
          return <path key={k} d={`M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`} stroke={ink} strokeWidth="1.2" />
        })}
        <g
          className="nodrag nopan" role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={1} aria-valuenow={value}
          onPointerDown={(e) => { if (takePress(e)) start(e.clientY) }}
          style={{ cursor: 'ns-resize', touchAction: 'none' }}
        >
          <circle cx={cx} cy={ROW - 2} r={KNOB_R + 6} fill="transparent" stroke="none" />
          <KnobFace cx={cx} cy={ROW - 2} r={KNOB_R} value={value} color={color} />
        </g>
        <text x={cx} y={H - 9} textAnchor="middle" stroke="none" fill="var(--lsc-fg-muted)" style={word}>{label.toUpperCase()}</text>
      </g>
    )
  }

  /** A window's two bars: a signal's left and right (one channel: both the same). */
  const bars = (top: number, s: WireSignal, at: 'in' | 'out', domain: SignalDomain) => (
    <div style={{ position: 'absolute', left: WIN_X + 3, top: top + (WIN_H - 2 * BAR_H - BAR_GAP) / 2, width: WIN_W - 6, display: 'flex', flexDirection: 'column', gap: BAR_GAP, ...dim }}>
      {([['l', s.l], ['r', s.r]] as const).map(([side, levels]) => bar(levels, side, at, domain))}
    </div>
  )
  const bar = (s: SideLevels, side: 'l' | 'r', at: 'in' | 'out', domain: SignalDomain) => (
    <MeterBar
      key={side} db={s.rms} height={BAR_H} domain={domain} peak={s.peak} noise={s.noise}
      clipping={getHealth(s.rms, domain, s.peak) === 'clipping'}
      source={{ nodeId: id, at, side }}
    />
  )

  const programName = t.nodes.effects.programs[EFFECT_PROGRAMS[program]]

  return (
    <FreeControl nodeId={id} typeKey="effects" label={name} showName={false} portLine={ROW * S} outline={false}>
      <div style={{ position: 'relative', width: W * S, height: H * S, ...RACK_COLOURS }}>
        <svg width={W * S} height={H * S} viewBox={`0 0 ${W} ${H}`} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', overflow: 'visible' }}>
          <g stroke={ink} style={dim}>
            <rect x="1.5" y="1.5" width={W - 3} height={H - 3} rx="5" strokeWidth="3" fill="var(--lsc-node-bg)" />
            {/* The rack ears, with their slots */}
            <path d={`M${EAR} 1.5V${H - 1.5}M${W - EAR} 1.5V${H - 1.5}`} strokeWidth="1.6" />
            {[[6, 10], [6, H - 16], [W - EAR + 6, 10], [W - EAR + 6, H - 16]].map(([x, y]) => (
              <rect key={`${x} ${y}`} x={x} y={y} width="10" height="6" rx="3" strokeWidth="1.5" />
            ))}
            <text
              x={LCD_X} y={14} stroke="none" fill="var(--lsc-fg-muted)"
              style={{ fontSize: nameSize, fontFamily: 'var(--lsc-font-sans)', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase' }}
            >
              {name}
            </text>
            {/* The display: the program's number and name, lit while on */}
            <rect x={LCD_X} y={LCD_Y} width={LCD_W} height={LCD_H} rx="3" strokeWidth="1.6" fill={on ? LCD_BG : 'var(--lsc-node-bg-2)'} />
            {on && (
              <g stroke="none" fill={LCD_TEXT} style={{ fontFamily: 'var(--lsc-font-mono)', fontWeight: 700 }}>
                <text x={LCD_X + 6} y={LCD_Y + 11} style={{ fontSize: 8 }}>{String(program + 1).padStart(2, '0')}</text>
                <text x={LCD_X + LCD_W / 2} y={LCD_Y + LCD_H - 8} textAnchor="middle" style={{ fontSize: Math.min(13, (LCD_W - 10) / Math.max(1, programName.length * 0.62)) }}>
                  {programName.toUpperCase()}
                </text>
              </g>
            )}
            {/* In and Out, beside their windows */}
            <g stroke="none" fill="var(--lsc-fg-muted)" style={word}>
              <text x={METER_WORD_X} y={IN_Y + WIN_H / 2 + 2.5} textAnchor="end">{t.nodes.effects.input.toUpperCase()}</text>
              <text x={METER_WORD_X} y={OUT_Y + WIN_H / 2 + 2.5} textAnchor="end">{t.nodes.effects.output.toUpperCase()}</text>
            </g>
            <rect x={WIN_X} y={IN_Y} width={WIN_W} height={WIN_H} rx="3" strokeWidth="1.4" fill="var(--lsc-node-bg-2)" />
            <rect x={WIN_X} y={OUT_Y} width={WIN_W} height={WIN_H} rx="3" strokeWidth="1.4" fill="var(--lsc-node-bg-2)" />
          </g>
          <g style={dim}>
            {knob(0, t.nodes.effects.program, program / (EFFECT_PROGRAMS.length - 1), 'var(--lsc-accent)', (y) =>
              drag.start({ y, value: program, max: EFFECT_PROGRAMS.length - 1, step: 1, set: (v) => updateNodeParams(id, { fxProgram: v }) }))}
            {KNOBS.map((k, i) => knob(i + 1, t.nodes.effects[k.word], p(k.param) / 100, k.color, (y) =>
              drag.start({ y, value: p(k.param), max: 100, step: 1, set: (v) => updateNodeParams(id, { [k.param]: v }) })))}
          </g>
          {/* Its power light: lit while on */}
          <circle cx={POWER_X} cy={14} r="3.5" stroke={ink} strokeWidth="1.4" fill={on ? 'var(--signal-good)' : 'var(--lsc-node-bg-2)'} />
          {/* The I / O rocker: the side pressed in is shaded */}
          <g
            className="nodrag nopan" role="switch" aria-checked={on} aria-label={t.nodes.effects.power}
            onClick={() => updateNodeParams(id, { on: !on })} style={{ cursor: 'pointer' }}
          >
            <rect x={POWER_X - 16} y={24} width="32" height="46" fill="transparent" />
            <rect x={POWER_X - 9} y={28} width="18" height="38" rx="3" stroke={ink} strokeWidth="2" fill="var(--lsc-node-bg-2)" />
            <rect x={POWER_X - 7.5} y={on ? 29.5 : 47.5} width="15" height="17" rx="2" fill={ink} opacity="0.18" />
            <path d={`M${POWER_X - 9} 47H${POWER_X + 9}`} stroke={ink} strokeWidth="1.4" />
            <path d={`M${POWER_X} 33V41`} stroke={ink} strokeWidth="2" />
            <circle cx={POWER_X} cy={57} r="3.6" stroke={ink} strokeWidth="1.8" />
          </g>

          <SelectedEdge nodeId={id} w={W} h={H} rx={6.5} edge={3} scale={S} />
        </svg>

        {/* The meters, in the drawing's units: scaled as the SVG is */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${S})`, transformOrigin: '0 0', pointerEvents: 'none' }}>
          {bars(IN_Y, inSig, 'in', stage?.inDomain ?? 'analog')}
          {bars(OUT_Y, outSig, 'out', stage?.domain ?? 'analog')}
          <div style={{ position: 'absolute', left: WIN_X + 3, top: OUT_Y + WIN_H + 2, width: WIN_W - 6, ...dim }}>
            <MeterScaleRow domain={stage?.domain ?? 'analog'} size={SCALE} />
          </div>

          {/* Anything wrong (switched off, the rack shows it itself) */}
          {condition && condition !== 'switchedOff' && (
            <div style={{ position: 'absolute', left: LCD_X, right: EAR + 4, top: ROW - 16, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <ConditionLabel condition={condition} typeKey="effects" />
            </div>
          )}
        </div>
      </div>
    </FreeControl>
  )
}
