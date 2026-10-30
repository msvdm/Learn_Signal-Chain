import { useMemo } from 'react'
import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { ConditionLabel } from './conditions'
import { useStage, useWire } from '../../hooks/useGraphSignal'
import { useParams } from '../../hooks/useParams'
import { useDetailShown } from '../../hooks/useDetailShown'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { takePress, usePointerDrag } from '../../hooks/usePointerDrag'
import { humOf } from '../../signal/engine'
import { GUITAR_AMP_MAX } from '../../signal/gains'
import { outputKey } from '../../graph/graph'
import { AMP_DI_PORT } from '../../data/nodeRegistry'
import { cssVar, textWidth } from '../../utils/fitText'
import { AmpKnob, SelectedEdge } from './ampParts'
import { BareMeter } from './BareMeter'
import { PANEL_TEXT, dialPoint } from './ampDial'

/** The cabinet: a square combo (px, drawn 1:1) */
const CAB = 300
/** Its top panel's jacks, knob and switch sit on this line — level with the port rings (FreeControl `portLine`) */
const LINE = 35
/** The panel's lower edge: the grille below it */
const PANEL_H = 82
/** The knob: its centre across, its radius */
const KNOB_X = 106
const KNOB_R = 20
/** The power switch and its pilot light, across */
const SWITCH_X = 166
const JEWEL_X = 198
/** The DI Out jack with its Ground Lift under it, across; the room its words may take */
const DI_X = 250
const DI_ROOM = 2 * (CAB - 10 - DI_X)
/** The name plate on the grille: its words' size (px), its most width */
const PLATE_FONT = 15
const PLATE_MAX = 240
/** A drag up or down this far turns the knob from 0 to 11 */
const DRAG_PX = 150

/** A word printed on the panel, shrunk to fit `room` (px) */
function fitted(text: string, room: number, size: number): number {
  return Math.min(size, room / Math.max(1e-6, textWidth(text, cssVar('--lsc-font-sans'), 600)))
}

/**
 * Guitar Amp (D27): no card — a square combo amp, the same at every zoom. Its top panel, on the port
 * line: the input jack, the Volume knob (0 … 11 — the 11 lit red at the top), the power switch with
 * its pilot light, the DI Out jack (D26) with its Ground Lift under it (red while the DI Out hums).
 * Its name on a plate on the grille; under the cabinet its meter in dB SPL (D13), from Intermediate.
 * Switched off it sends nothing (its DI Out neither) and goes dark. At Beginner the power switch
 * works; the knob is part of the picture (no value shown) and does not turn.
 */
export function GuitarAmpNode({ id }: CardProps) {
  const { t }            = useTranslation()
  const name             = useNodeName(id, 'guitar-amp')
  const p                = useParams(id, 'guitar-amp')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const detailed         = useDetailShown()
  const stage            = useStage(id)
  const hum              = isFinite(humOf(useWire(outputKey(id, AMP_DI_PORT))))

  const on        = p('on')
  const volume    = p('volume')
  const lift      = p('groundLift')
  const condition = stage?.condition

  const drag = usePointerDrag<{ y: number; value: number }>((e, from) => {
    const raw = from.value + ((from.y - e.clientY) / DRAG_PX) * GUITAR_AMP_MAX
    updateNodeParams(id, { volume: Math.round(Math.max(0, Math.min(GUITAR_AMP_MAX, raw)) * 2) / 2 })
  })

  const diWord   = t.ports.diOut
  const liftWord = t.nodes['di-box'].groundLift
  const sizes = useMemo(() => {
    // (Italic runs a little wider than the upright text measured)
    const nameW = Math.ceil(textWidth(name, cssVar('--lsc-font-sans'), 600) * PLATE_FONT * 1.06)
    return {
      di:     fitted(diWord, DI_ROOM, PANEL_TEXT),
      lift:   fitted(liftWord, DI_ROOM, PANEL_TEXT),
      plate:  Math.min(PLATE_MAX, nameW + 24),
      // A long name is squeezed into the plate's most width
      squeeze: nameW > PLATE_MAX - 24 ? PLATE_MAX - 24 : undefined,
    }
  }, [diWord, liftWord, name])

  const zero   = dialPoint(KNOB_X, LINE, KNOB_R + 14, 0)
  const eleven = dialPoint(KNOB_X, LINE, KNOB_R + 14, 1)
  const toggle = () => updateNodeParams(id, { on: !on })
  const ink    = 'var(--lsc-fg)'

  const meter = <BareMeter nodeId={id} typeKey="guitar-amp" width={CAB} />

  return (
    <FreeControl nodeId={id} typeKey="guitar-amp" label={name} showName={false} portLine={LINE} footer={meter} outline={false}>
      <div style={{ position: 'relative', width: CAB, height: CAB }}>
        <svg width={CAB} height={CAB} viewBox={`0 0 ${CAB} ${CAB}`} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <pattern id={`grille-${id}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 0V7M0 0H7" stroke={ink} strokeWidth="0.7" opacity="0.45" />
            </pattern>
          </defs>
          {/* Switched off it goes dark; its switch still answers */}
          <g stroke={ink} style={{ opacity: on ? 1 : 0.45, transition: 'opacity 0.25s' }}>
            <rect x="1.5" y="1.5" width={CAB - 3} height={CAB - 3} rx="14" strokeWidth="3" fill="var(--lsc-node-bg)" />
            <path d={`M1.5 ${PANEL_H}H${CAB - 1.5}`} strokeWidth="2.5" />
            {/* The input jack */}
            <circle cx="34" cy={LINE} r="8" strokeWidth="2.5" />
            <circle cx="34" cy={LINE} r="2.5" strokeWidth="2" />
            {/* The DI Out jack and, under it, its Ground Lift */}
            <text x={DI_X} y={LINE - 19} textAnchor="middle" stroke="none" fill="var(--lsc-fg-muted)" style={{ fontSize: sizes.di, fontFamily: 'var(--lsc-font-sans)', fontWeight: 600 }}>{diWord}</text>
            <circle cx={DI_X} cy={LINE} r="7" strokeWidth="2.5" />
            <circle cx={DI_X} cy={LINE} r="2.2" strokeWidth="2" />
            {/* The grille, its name plate on it */}
            <rect x="14" y={PANEL_H + 10} width={CAB - 28} height={CAB - PANEL_H - 24} rx="6" fill={`url(#grille-${id})`} strokeWidth="1.6" />
            <rect x="26" y={PANEL_H + 18} width={sizes.plate} height="26" rx="4" strokeWidth="1.6" fill="var(--lsc-node-bg-2)" />
            <text
              x={26 + sizes.plate / 2} y={PANEL_H + 36} textAnchor="middle" stroke="none" fill={ink}
              textLength={sizes.squeeze} lengthAdjust={sizes.squeeze ? 'spacingAndGlyphs' : undefined}
              style={{ fontSize: PLATE_FONT, fontFamily: 'var(--lsc-font-sans)', fontWeight: 600, fontStyle: 'italic' }}
            >
              {name}
            </text>
          </g>

          {/* Volume, 0 … 11 */}
          <g style={{ opacity: on ? 1 : 0.45 }}>
            <text x={zero.x} y={zero.y + 4} textAnchor="middle" fill="var(--lsc-fg-muted)" style={{ fontSize: PANEL_TEXT, fontFamily: 'var(--lsc-font-sans)' }}>0</text>
            <text
              x={eleven.x} y={eleven.y + 4} textAnchor="middle"
              fill={on && volume >= GUITAR_AMP_MAX ? 'var(--signal-clipping)' : 'var(--lsc-fg-muted)'}
              style={{ fontSize: PANEL_TEXT, fontFamily: 'var(--lsc-font-sans)', fontWeight: volume >= GUITAR_AMP_MAX ? 700 : 400 }}
            >
              11
            </text>
            <AmpKnob
              cx={KNOB_X} cy={LINE} r={KNOB_R} value={volume / GUITAR_AMP_MAX} ticks={12} label={t.nodes['guitar-amp'].volume}
              onPointerDown={detailed ? (e) => { if (takePress(e)) drag.start({ y: e.clientY, value: volume }) } : undefined}
            />
            {/* Its value, from Intermediate (D3) */}
            {detailed && (
              <text x={KNOB_X} y={LINE + KNOB_R + 21} textAnchor="middle" fill={ink} style={{ fontSize: 13, fontFamily: 'var(--lsc-font-mono)', fontWeight: 700 }}>
                {volume}
              </text>
            )}
          </g>

          {/* The power switch: a toggle, up = on; the red jewel lit while on */}
          <g
            className="nodrag nopan" role="switch" aria-checked={on} aria-label={t.nodes['guitar-amp'].power}
            onClick={toggle} style={{ cursor: 'pointer' }}
          >
            <rect x={SWITCH_X - 21} y={LINE - 25} width="42" height="50" fill="transparent" />
            <rect x={SWITCH_X - 11} y={LINE - 17} width="22" height="34" rx="4" stroke={ink} strokeWidth="2" fill="var(--lsc-node-bg-2)" />
            <path d={on ? `M${SWITCH_X} ${LINE}V${LINE - 13}` : `M${SWITCH_X} ${LINE}V${LINE + 13}`} stroke={ink} strokeWidth="4" />
          </g>
          <circle cx={JEWEL_X} cy={LINE} r="8" stroke={ink} strokeWidth="2.5" fill={on ? 'var(--signal-clipping)' : 'var(--lsc-node-bg-2)'} />

          {/* Ground Lift: pressed in = lifted; red while the DI Out hums */}
          <g
            className="nodrag nopan" role="switch" aria-checked={lift} aria-label={liftWord}
            onClick={() => updateNodeParams(id, { groundLift: !lift })} style={{ cursor: 'pointer', opacity: on ? 1 : 0.45 }}
          >
            <rect x={DI_X - DI_ROOM / 2} y={LINE + 13} width={DI_ROOM} height="34" fill="transparent" />
            <rect
              x={DI_X - 12} y={LINE + 15} width="24" height="12" rx="3" strokeWidth={hum ? 2.4 : 1.8}
              stroke={hum ? 'var(--signal-clipping)' : ink}
              fill={lift ? ink : hum ? 'var(--signal-clipping-bg)' : 'var(--lsc-node-bg-2)'}
            />
            <text x={DI_X} y={LINE + 41} textAnchor="middle" fill={hum ? 'var(--signal-clipping-text)' : 'var(--lsc-fg-muted)'} style={{ fontSize: sizes.lift, fontFamily: 'var(--lsc-font-sans)', fontWeight: 600 }}>
              {liftWord}
            </text>
          </g>

          {/* Selected: its cabinet's edge (the cabinet's outer edge: 0 … CAB, its corners 14 + half its line) */}
          <SelectedEdge nodeId={id} w={CAB} h={CAB} rx={15.5} edge={3} />
        </svg>

        {/* Fed a digital signal: said on the grille (switched off, the amp shows it itself) */}
        {condition && condition !== 'switchedOff' && (
          <div style={{ position: 'absolute', left: 30, right: 30, top: PANEL_H + 60, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <ConditionLabel condition={condition} typeKey="guitar-amp" />
          </div>
        )}
      </div>
    </FreeControl>
  )
}
