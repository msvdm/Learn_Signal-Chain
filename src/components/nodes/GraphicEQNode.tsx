import { useEffect, useRef, useState } from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal } from '../../hooks/useGraphSignal'
import { getHealth } from '../../signal/levels'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useParams } from '../../hooks/useParams'
import { useLatestRef } from '../../hooks/useLatestRef'
import { GEQ_CENTERS, GEQ_RANGE, geqShortLabel, geqLongLabel } from '../../signal/eqMath'

// Same body width as the Parametric EQ, so both EQ cards are the same size
const BODY_W    = 640
const PANEL_PAD = 10
const AXIS_W    = 30                 // +12 … −12 dB labels
const SLIDER_H  = 291                // all the sliders together, mono or stereo — the card never resizes
const BANK_GAP  = 11                 // between the L and R sliders in stereo
const BANDS     = GEQ_CENTERS.length // 31
const COL_W     = (BODY_W - PANEL_PAD * 2 - 2 - AXIS_W) / BANDS
const CAP_W     = 14
const CAP_H     = 9
const LABEL_ROW = 15                 // frequency labels sit in two staggered rows, so they fit
const GRID_DB   = [12, 6, 0, -6, -12]
// A half-height bank (stereo) labels fewer lines, away from its edges, so L's and R's never crowd
const AXIS_DB_HALF = [6, 0, -6]

type Side = 'l' | 'r'

interface GraphGraphicEQData extends Record<string, unknown> {
  color?: string
  label?: string
}

const formatGain = (v: number) => (v > 0 ? `+${v} dB` : v < 0 ? `−${-v} dB` : '0 dB')
/** Height of a gain along a slider `h` tall (0 = top) */
const yOf = (db: number, h: number) => ((GEQ_RANGE - db) / (GEQ_RANGE * 2)) * h
const capX = (i: number) => (i + 0.5) * COL_W
/** Mono and the left side use b0…b30; the right side r0…r30 */
const paramOf = (side: Side, band: number) => (side === 'r' ? `r${band}` : `b${band}`)

/**
 * 31-band graphic EQ, a third of an octave per slider (20 Hz … 20 kHz), like the one on a
 * PA system's master output. Each slider boosts or cuts its band by up to 12 dB in 0.5 dB steps;
 * the line through the caps shows the curve. Same size as the Parametric EQ.
 * Fed a stereo wire it is a two-channel EQ: the sliders split into L (top) and R (bottom),
 * in the same space. The right side copies the left until it is first touched.
 */
export function GraphicEQNode({ id, data }: NodeProps<Node<GraphGraphicEQData>>) {
  const { stages }       = useGraphSignal()
  const p                = useParams(id, 'graphic-eq')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const levels = useStereoLevels(id)
  const result = stages[id]
  const stereo = levels.stereo
  const left   = GEQ_CENTERS.map((_, i) => p(`b${i}`))
  const right  = GEQ_CENTERS.map((_, i) => p(`r${i}`) ?? left[i])
  const gainsOf = (side: Side) => (side === 'r' ? right : left)

  // The band under the pointer or being dragged — only for the readout and highlight
  const [active, setActive] = useState<{ side: Side; band: number } | null>(null)
  // A drag keeps to the bank and slider it started on
  const drag    = useRef<{ side: Side; band: number; el: HTMLElement } | null>(null)
  const setGain = useLatestRef((side: Side, band: number, db: number) => {
    // The first touch on the right side copies the left over, then the two are independent
    if (side === 'r' && p('r0') === undefined) {
      updateNodeParams(id, { ...Object.fromEntries(right.map((g, i) => [`r${i}`, g])), [`r${band}`]: db })
    } else {
      updateNodeParams(id, { [paramOf(side, band)]: db })
    }
  })

  // A drag keeps to the slider it started on, however far the pointer wanders sideways
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current
      if (d) setGain.current(d.side, d.band, gainAt(e.clientY, d.el))
    }
    const onUp = () => { drag.current = null }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [setGain])

  function onBankDown(side: Side, e: React.PointerEvent<HTMLDivElement>) {
    // Only the main button moves a slider: a right-click opens the element's menu instead
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const el   = e.currentTarget
    const band = bandAt(e.clientX, el)
    drag.current = { side, band, el }
    setActive({ side, band })
    setGain.current(side, band, gainAt(e.clientY, el))
  }

  const sides: Side[] = stereo ? ['l', 'r'] : ['l']
  const bankH  = stereo ? (SLIDER_H - BANK_GAP) / 2 : SLIDER_H
  const isFlat = sides.every((side) => gainsOf(side).every((g) => g === 0))
  const flat   = () => updateNodeParams(id, Object.fromEntries(GEQ_CENTERS.flatMap((_, i) =>
    stereo ? [[`b${i}`, 0], [`r${i}`, 0]] : [[`b${i}`, 0]])))

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="graphic-eq"
      label={data.label ?? t.nodes.graphicEq.label}
    >
      <div style={{ width: BODY_W, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <SignalMeter db={levels.in} dbR={levels.inR} health={getHealth(levels.inPeak, levels.inDomain)} domain={levels.inDomain} label={t.meters.input} />
          </div>
          <div style={{ flex: 1 }}>
            <SignalMeter db={levels.out} dbR={levels.outR} domain={levels.outDomain} health={result?.health ?? 'too-quiet'} label={t.meters.output} />
          </div>
        </div>

        {/* The band being touched, or how to use it — fixed height, so the card never resizes */}
        <div style={{ height: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              flex: 1, minWidth: 0, fontSize: 12, lineHeight: '16px', maxHeight: 32, overflow: 'hidden',
              color: active === null ? 'var(--lsc-fg-dim)' : 'var(--lsc-fg)',
            }}
          >
            {active === null ? t.nodes.graphicEq.hint : (
              <>
                <span style={{ fontWeight: 700 }}>{geqLongLabel(GEQ_CENTERS[active.band])}</span>
                {stereo && <span style={{ fontWeight: 700, marginLeft: 10, color: 'var(--lsc-fg-muted)' }}>{active.side.toUpperCase()}</span>}
                <span style={{ fontFamily: 'var(--lsc-font-mono)', fontWeight: 700, marginLeft: 10, color: 'var(--lsc-accent)' }}>
                  {formatGain(gainsOf(active.side)[active.band])}
                </span>
              </>
            )}
          </span>
          <button
            className="nodrag nopan lsc-btn-outline"
            title={t.nodes.graphicEq.flatHint}
            disabled={isFlat}
            onClick={flat}
            style={{
              height: 26, padding: '0 10px', borderRadius: 6, flexShrink: 0,
              border: '1px solid var(--lsc-border)', background: 'transparent',
              color: isFlat ? 'var(--lsc-fg-fainter)' : 'var(--lsc-fg)',
              fontSize: 12, fontWeight: 600, cursor: isFlat ? 'default' : 'pointer',
            }}
          >
            {t.nodes.graphicEq.flat}
          </button>
        </div>

        {/* Slider panel: one bank, or L above R in stereo — the same height either way */}
        <div
          className="nodrag nopan"
          style={{
            padding: PANEL_PAD, borderRadius: 8,
            background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: BANK_GAP, height: SLIDER_H }}>
            {sides.map((side) => (
              <SliderBank
                key={side}
                gains={gainsOf(side)}
                height={bankH}
                channel={stereo ? side.toUpperCase() : null}
                activeBand={active?.side === side ? active.band : null}
                onDown={(e) => onBankDown(side, e)}
                onHover={(band) => { if (!drag.current) setActive(band === null ? null : { side, band }) }}
                onReset={(band) => setGain.current(side, band, 0)}
              />
            ))}
          </div>

          {/* Frequencies, in two staggered rows */}
          <div style={{ position: 'relative', marginLeft: AXIS_W, height: LABEL_ROW * 2, marginTop: 6 }}>
            {GEQ_CENTERS.map((hz, i) => (
              <span
                key={hz}
                style={{
                  position: 'absolute', left: capX(i), top: (i % 2) * LABEL_ROW, transform: 'translateX(-50%)',
                  fontSize: 11, fontFamily: 'var(--lsc-font-mono)', lineHeight: `${LABEL_ROW}px`, whiteSpace: 'nowrap',
                  fontWeight: active?.band === i ? 700 : 400,
                  color: active?.band === i ? 'var(--lsc-accent)' : 'var(--lsc-fg-dim)',
                  pointerEvents: 'none',
                }}
              >
                {geqShortLabel(hz)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </NodeWrapper>
  )
}

function bandAt(clientX: number, el: HTMLElement): number {
  const rect = el.getBoundingClientRect()
  return Math.max(0, Math.min(BANDS - 1, Math.floor(((clientX - rect.left) / rect.width) * BANDS)))
}

function gainAt(clientY: number, el: HTMLElement): number {
  const rect = el.getBoundingClientRect()
  const rel  = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
  return Math.round((GEQ_RANGE - rel * GEQ_RANGE * 2) * 2) / 2
}

/**
 * One row of 31 sliders with its dB scale, grid, curve and caps. Press anywhere in a column,
 * then drag up / down; double-click = 0 dB. In stereo, `channel` (L / R) is shown beside it.
 */
function SliderBank({ gains, height, channel, activeBand, onDown, onHover, onReset }: {
  gains: number[]
  height: number
  channel: string | null
  activeBand: number | null
  onDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onHover: (band: number | null) => void
  onReset: (band: number) => void
}) {
  const axis  = channel ? AXIS_DB_HALF : GRID_DB
  const curve = gains.map((g, i) => `${i === 0 ? 'M' : 'L'} ${capX(i).toFixed(1)},${yOf(g, height).toFixed(1)}`).join(' ')

  return (
    <div style={{ display: 'flex' }}>
      {/* dB scale, and the channel letter in stereo */}
      <div style={{ position: 'relative', width: AXIS_W, height, flexShrink: 0 }}>
        {channel && (
          <span
            style={{
              position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
              fontSize: 13, fontWeight: 800, lineHeight: 1, color: 'var(--lsc-fg-muted)',
            }}
          >
            {channel}
          </span>
        )}
        {axis.map((db) => (
          <span
            key={db}
            style={{
              position: 'absolute', right: 6, top: yOf(db, height), transform: 'translateY(-50%)',
              fontSize: 11, fontFamily: 'var(--lsc-font-mono)', lineHeight: 1,
              color: db === 0 ? 'var(--signal-good)' : 'var(--lsc-fg-dim)',
            }}
          >
            {db > 0 ? `+${db}` : db < 0 ? `−${-db}` : '0'}
          </span>
        ))}
      </div>

      <div
        onPointerDown={onDown}
        onPointerMove={(e) => onHover(bandAt(e.clientX, e.currentTarget))}
        onPointerLeave={() => onHover(null)}
        onDoubleClick={(e) => onReset(bandAt(e.clientX, e.currentTarget))}
        style={{ position: 'relative', width: COL_W * BANDS, height, cursor: 'ns-resize', touchAction: 'none' }}
      >
        {/* Grid: ±12, ±6 and the 0 dB line */}
        {GRID_DB.map((db) => (
          <div
            key={db}
            style={{
              position: 'absolute', left: 0, right: 0, top: yOf(db, height), height: 1,
              background: db === 0 ? 'var(--signal-good)' : 'var(--lsc-border)',
              opacity: db === 0 ? 0.6 : 1, pointerEvents: 'none',
            }}
          />
        ))}

        {/* Tracks */}
        {GEQ_CENTERS.map((hz, i) => (
          <div
            key={hz}
            style={{
              position: 'absolute', top: 0, bottom: 0, left: capX(i) - 1.5, width: 3, borderRadius: 2,
              background: activeBand === i ? 'var(--lsc-accent)' : 'var(--lsc-track-3)', pointerEvents: 'none',
            }}
          />
        ))}

        {/* The curve through the caps */}
        <svg
          width={COL_W * BANDS} height={height}
          style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
        >
          <path d={curve} fill="none" stroke="var(--lsc-accent)" strokeWidth={2} strokeLinejoin="round" opacity={0.85} />
        </svg>

        {/* Caps: small fader caps, the white line marks the setting */}
        {gains.map((g, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', left: capX(i) - CAP_W / 2, top: yOf(g, height) - CAP_H / 2,
              width: CAP_W, height: CAP_H, borderRadius: 2,
              background: 'linear-gradient(#4a4c52, #25262a 45%, #111214)',
              border: '1px solid var(--lsc-fader-cap-rim)',
              boxShadow: activeBand === i ? '0 0 0 2px var(--lsc-accent)' : '0 1px 2px rgba(0,0,0,0.35)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ position: 'absolute', left: 3, right: 3, top: '50%', height: 1.5, marginTop: -0.75, background: '#f4f4f4' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
