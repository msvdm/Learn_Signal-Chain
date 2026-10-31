import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useShallow } from 'zustand/shallow'
import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { ConditionLabel } from './conditions'
import { MeterBar, MeterScaleRow, STILL_DB } from '../SignalMeter'
import { useStage } from '../../hooks/useGraphSignal'
import { useParams, useSettings } from '../../hooks/useParams'
import { useDetailShown } from '../../hooks/useDetailShown'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { takePress, usePointerDrag } from '../../hooks/usePointerDrag'
import { SILENT_WIRE } from '../../signal/engine'
import { getHealth } from '../../signal/levels'
import type { SideLevels } from '../../signal/levels'
import { GAIN_OFF_DB, ampVolumeDb } from '../../signal/gains'
import { reachIn, soundAt } from '../../graph/reach'
import { ampSplit } from '../../graph/queries'
import { AMP_B_PORT } from '../../data/nodeRegistry'
import { SIGNAL_LEVEL, atLeast } from '../../data/levels'
import { cssVar, textWidth } from '../../utils/fitText'
import { PORT_GAP, PORT_TOP } from '../../utils/layoutHelpers'
import { AmpKnob, SelectedEdge } from './ampParts'
import { PANEL_TEXT } from './ampDial'

/** The rack is drawn at this many times the size of its drawing (the user's call: twice as large) */
const S = 2
/** The rack panel in drawing units (px before `S`): 2U, its ears at both ends */
const W = 320
const H = 158
const EAR = 22
/** Channel A's line, level with the port rings: drawn at `S`, it is the first port line (FreeControl `portLine`); B's line four port lines below */
const ROW_A = PORT_TOP / S
const ROW_B = ROW_A + (4 * PORT_GAP) / S
/** The power rocker and its light, across */
const POWER_X = 52
/** A channel's letter, its knob (centre, radius) */
const LETTER_X = 92
const KNOB_X = 124
const KNOB_R = 17
/** A channel's meter window: where it starts across, how wide and tall; its bar inside */
const WIN_X = 158
const WIN_W = W - EAR - 10 - WIN_X
const WIN_H = 16
const BAR_H = WIN_H - 6
/** The scale under channel A's window (px) */
const SCALE = 11
/** The name printed on the panel: its size, the room it has */
const NAME_FONT = 12
const NAME_ROOM = W - 2 * EAR - 90
/** A drag up or down this far (screen px) turns a knob through its whole range */
const DRAG_PX = 150

const formatLevel = (v: number) => (v <= GAIN_OFF_DB ? '−∞' : `${v} dB`)

/**
 * Its front panel a dark grey in both themes, as a real rack amp's, the print on it light: the
 * theme's colours redefined inside it, so its lines, words, meter windows and scale follow
 */
const RACK_COLOURS = {
  '--lsc-node-bg':   'var(--lsc-rack-panel)',
  '--lsc-node-bg-2': 'var(--lsc-rack-window)',
  '--lsc-fg':        'var(--lsc-rack-ink)',
  '--lsc-fg-muted':  'var(--lsc-rack-muted)',
  '--lsc-fg-dim':    'var(--lsc-rack-muted)',
  '--lsc-fg-fainter': 'var(--lsc-rack-muted)',
} as CSSProperties

/**
 * Amplifier (D27): no card — a two-channel power amp in a rack, the same at every zoom, drawn twice
 * the size of its drawing (`S`: the SVG through its viewBox, the meters through one CSS scale). Input A plays
 * out of L, B out of R, each channel with its own Volume knob and its meter window in the panel (the
 * scale between them); one stereo wire goes into both (drawn split at the inputs — ChainEdge). Its
 * I / O rocker switches it off: it sends nothing and goes dark. At Beginner the rocker works; the
 * knobs are part of the picture, and each window is lit, still, while a sound reaches its channel.
 */
export function AmpNode({ id }: CardProps) {
  const { t }            = useTranslation()
  const name             = useNodeName(id, 'amp')
  const p                = useParams(id, 'amp')
  const settings         = useSettings(id, 'amp')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const detailed         = useDetailShown()
  const stage            = useStage(id)

  const on        = p('on')
  const gainA     = ampVolumeDb(settings, 'l')
  const gainB     = ampVolumeDb(settings, 'r')
  const condition = stage?.condition
  const out       = stage?.out ?? SILENT_WIRE

  // Beginner (D20): no signal worked out — where the sound reaches (graph/reach.ts)
  const [soundA, soundB] = useSignalStore(useShallow((s) => {
    if (atLeast(s.complexityLevel, SIGNAL_LEVEL)) return [false, false]
    const reach = reachIn(s)
    const both  = ampSplit(id, s) !== null && soundAt(reach, id)
    return [both || soundAt(reach, id, 'in'), both || soundAt(reach, id, AMP_B_PORT)]
  }))

  // Until B is turned it follows A: A's first turn leaves B where it is
  const setA = (v: number) => updateNodeParams(id, p('gainDbR') === undefined ? { gainDb: v, gainDbR: gainB } : { gainDb: v })
  const setB = (v: number) => updateNodeParams(id, { gainDbR: v })
  const drag = usePointerDrag<{ y: number; value: number; set: (v: number) => void }>((e, from) => {
    const raw = from.value + ((from.y - e.clientY) / DRAG_PX) * -GAIN_OFF_DB
    from.set(Math.round(Math.max(GAIN_OFF_DB, Math.min(0, raw)) * 2) / 2)
  })

  const nameSize = useMemo(
    () => Math.min(NAME_FONT, NAME_ROOM / Math.max(1e-6, textWidth(name.toUpperCase(), cssVar('--lsc-font-sans'), 600, 0.2))),
    [name],
  )

  const ink = 'var(--lsc-fg)'
  const dim = { opacity: on ? 1 : 0.45, transition: 'opacity 0.25s' }

  /** A channel's row: its letter, its knob (its value under it from Intermediate), its meter window. */
  const channel = (row: number, letter: string, label: string, value: number, set: (v: number) => void) => (
    <g key={letter} style={dim}>
      <text x={LETTER_X} y={row + 5} textAnchor="middle" stroke="none" fill={ink} style={{ fontSize: 14, fontFamily: 'var(--lsc-font-sans)', fontWeight: 700 }}>{letter}</text>
      <AmpKnob
        cx={KNOB_X} cy={row} r={KNOB_R} value={(value - GAIN_OFF_DB) / -GAIN_OFF_DB} ticks={11} label={label}
        onPointerDown={detailed ? (e) => { if (takePress(e)) drag.start({ y: e.clientY, value, set }) } : undefined}
      />
      {detailed && (
        <text x={KNOB_X} y={row + KNOB_R + 21} textAnchor="middle" stroke="none" fill="var(--lsc-fg-muted)" style={{ fontSize: PANEL_TEXT, fontFamily: 'var(--lsc-font-mono)', fontWeight: 600 }}>
          {formatLevel(value)}
        </text>
      )}
      <rect x={WIN_X} y={row - WIN_H / 2} width={WIN_W} height={WIN_H} rx="3" stroke={ink} strokeWidth="1.6" fill="var(--lsc-node-bg-2)" />
    </g>
  )

  /** A window's bar: what leaves that channel (from Intermediate, moving); at Beginner lit, still, while a sound reaches it. */
  const bar = (row: number, s: SideLevels, side: 'l' | 'r', still: boolean) => (
    <div style={{ position: 'absolute', left: WIN_X + 3, top: row - BAR_H / 2, width: WIN_W - 6, ...dim }}>
      {detailed ? (
        <MeterBar
          db={s.rms} height={BAR_H} domain="analog" peak={s.peak} noise={s.noise}
          clipping={getHealth(s.rms, 'analog', s.peak) === 'clipping'}
          source={{ nodeId: id, at: 'out', side }}
        />
      ) : (
        <MeterBar db={on && still ? STILL_DB : -Infinity} height={BAR_H} domain="analog" clipping={false} />
      )}
    </div>
  )

  return (
    <FreeControl nodeId={id} typeKey="amp" label={name} showName={false} portLine={ROW_A * S} outline={false}>
      <div style={{ position: 'relative', width: W * S, height: H * S, ...RACK_COLOURS }}>
        <svg width={W * S} height={H * S} viewBox={`0 0 ${W} ${H}`} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', overflow: 'visible' }}>
          <g stroke={ink} style={dim}>
            <rect x="1.5" y="1.5" width={W - 3} height={H - 3} rx="6" strokeWidth="3" fill="var(--lsc-node-bg)" />
            {/* The rack ears, with their slots */}
            <path d={`M${EAR} 1.5V${H - 1.5}M${W - EAR} 1.5V${H - 1.5}`} strokeWidth="1.6" />
            {[[6, 12], [6, H - 18], [W - EAR + 6, 12], [W - EAR + 6, H - 18]].map(([x, y]) => (
              <rect key={`${x} ${y}`} x={x} y={y} width="10" height="6" rx="3" strokeWidth="1.5" />
            ))}
            <text
              x={W - EAR - 10} y={20} textAnchor="end" stroke="none" fill="var(--lsc-fg-muted)"
              style={{ fontSize: nameSize, fontFamily: 'var(--lsc-font-sans)', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase' }}
            >
              {name}
            </text>
          </g>
          {/* Its power light: lit while on */}
          <circle cx={POWER_X} cy={ROW_A - 14} r="4" stroke={ink} strokeWidth="1.5" fill={on ? 'var(--signal-good)' : 'var(--lsc-node-bg-2)'} />
          {channel(ROW_A, t.nodes.amp.channelA, t.nodes.amp.levelA, gainA, setA)}
          {channel(ROW_B, t.nodes.amp.channelB, t.nodes.amp.levelB, gainB, setB)}
          {/* The I / O rocker: the side pressed in is shaded */}
          <g
            className="nodrag nopan" role="switch" aria-checked={on} aria-label={t.nodes.amp.power}
            onClick={() => updateNodeParams(id, { on: !on })} style={{ cursor: 'pointer' }}
          >
            <rect x={POWER_X - 20} y={ROW_A} width="40" height="64" fill="transparent" />
            <rect x={POWER_X - 12} y={ROW_A + 4} width="24" height="52" rx="4" stroke={ink} strokeWidth="2.2" fill="var(--lsc-node-bg-2)" />
            <rect x={POWER_X - 10} y={on ? ROW_A + 6 : ROW_A + 31} width="20" height="23" rx="2" fill={ink} opacity="0.18" />
            <path d={`M${POWER_X - 12} ${ROW_A + 30}H${POWER_X + 12}`} stroke={ink} strokeWidth="1.6" />
            <path d={`M${POWER_X} ${ROW_A + 12}V${ROW_A + 22}`} stroke={ink} strokeWidth="2.2" />
            <circle cx={POWER_X} cy={ROW_A + 43} r="5" stroke={ink} strokeWidth="2" />
          </g>

          {/* Selected: the panel's edge (its outer edge: 0 … W, its corners 6 + half its line) */}
          <SelectedEdge nodeId={id} w={W} h={H} rx={7.5} edge={3} scale={S} />
        </svg>

        {/* What is drawn over the panel, in its units: scaled as the SVG is (the clicks go through to the knobs and the rocker) */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${S})`, transformOrigin: '0 0', pointerEvents: 'none' }}>
          {bar(ROW_A, out.l, 'l', soundA)}
          {bar(ROW_B, out.r, 'r', soundB)}
          {/* The scale, between the two windows */}
          <div style={{ position: 'absolute', left: WIN_X + 3, top: ROW_A + WIN_H / 2 + 2, width: WIN_W - 6, ...dim }}>
            <MeterScaleRow domain="analog" size={SCALE} />
          </div>

          {/* Fed a digital signal: said across the panel (switched off, the rack shows it itself) */}
          {condition && condition !== 'switchedOff' && (
            <div style={{ position: 'absolute', left: WIN_X - 20, right: EAR + 4, top: (ROW_A + ROW_B) / 2 - 16, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <ConditionLabel condition={condition} typeKey="amp" />
            </div>
          )}
        </div>
      </div>
    </FreeControl>
  )
}
