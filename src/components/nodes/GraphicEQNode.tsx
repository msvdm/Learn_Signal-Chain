import { useEffect, useRef, useState } from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import { Sliders } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useLatestRef } from '../../hooks/useLatestRef'
import { GEQ_CENTERS, GEQ_RANGE, geqShortLabel, geqLongLabel } from '../controls/eqMath'

// Same body width as the Parametric EQ, so both EQ cards are the same size
const BODY_W    = 640
const PANEL_PAD = 10
const AXIS_W    = 30                 // +12 … −12 dB labels
const SLIDER_H  = 291
const BANDS     = GEQ_CENTERS.length // 31
const COL_W     = (BODY_W - PANEL_PAD * 2 - 2 - AXIS_W) / BANDS
const CAP_W     = 14
const CAP_H     = 9
const LABEL_ROW = 15                 // frequency labels sit in two staggered rows, so they fit
const AXIS_DB   = [12, 6, 0, -6, -12]

interface GraphGraphicEQData extends Record<string, unknown> {
  color?: string
  label?: string
}

const formatGain = (v: number) => (v > 0 ? `+${v} dB` : v < 0 ? `−${-v} dB` : '0 dB')
/** Height of a gain along the slider (0 = top) */
const yOf = (db: number) => ((GEQ_RANGE - db) / (GEQ_RANGE * 2)) * SLIDER_H

/**
 * 31-band graphic EQ, a third of an octave per slider (20 Hz … 20 kHz), like the one on a
 * PA system's master output. Each slider boosts or cuts its band by up to 12 dB in 0.5 dB steps;
 * the line through the caps shows the curve. Same size as the Parametric EQ.
 */
export function GraphicEQNode({ id, data }: NodeProps<Node<GraphGraphicEQData>>) {
  const { stages }       = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const params = node?.params ?? {}
  const levels = useStereoLevels(id)
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const gains  = GEQ_CENTERS.map((_, i) => (params[`b${i}`] as number) ?? 0)

  // The band under the pointer or being dragged — only for the readout and highlight
  const [active, setActive] = useState<number | null>(null)
  const areaRef  = useRef<HTMLDivElement>(null)
  const dragBand = useRef<number | null>(null)
  const setGain  = useLatestRef((band: number, db: number) => updateNodeParams(id, { [`b${band}`]: db }))

  function bandAt(clientX: number): number {
    const rect = areaRef.current!.getBoundingClientRect()
    return Math.max(0, Math.min(BANDS - 1, Math.floor(((clientX - rect.left) / rect.width) * BANDS)))
  }
  function gainAt(clientY: number): number {
    const rect = areaRef.current!.getBoundingClientRect()
    const rel  = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    return Math.round((GEQ_RANGE - rel * GEQ_RANGE * 2) * 2) / 2
  }
  const gainAtRef = useLatestRef(gainAt)

  // A drag keeps to the slider it started on, however far the pointer wanders sideways
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragBand.current !== null) setGain.current(dragBand.current, gainAtRef.current(e.clientY))
    }
    const onUp = () => { dragBand.current = null }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [setGain, gainAtRef])

  function onPointerDown(e: React.PointerEvent) {
    // Only the main button moves a slider: a right-click opens the element's menu instead
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const band = bandAt(e.clientX)
    dragBand.current = band
    setActive(band)
    setGain.current(band, gainAt(e.clientY))
  }

  const capX   = (i: number) => (i + 0.5) * COL_W
  const curve  = gains.map((g, i) => `${i === 0 ? 'M' : 'L'} ${capX(i).toFixed(1)},${yOf(g).toFixed(1)}`).join(' ')
  const isFlat = gains.every((g) => g === 0)

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="graphic-eq"
      icon={<Sliders size={16} />}
      label={data.label ?? t.nodes.graphicEq.label}
      accentColor={data.color}
    >
      <div style={{ width: BODY_W, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <SignalMeter db={levels.in} dbR={levels.inR} health={getHealth(levels.inPeak)} label={t.meters.input} />
          </div>
          <div style={{ flex: 1 }}>
            <SignalMeter db={levels.out} dbR={levels.outR} health={result.health} label={t.meters.output} />
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
                <span style={{ fontWeight: 700 }}>{geqLongLabel(GEQ_CENTERS[active])}</span>
                <span style={{ fontFamily: 'var(--lsc-font-mono)', fontWeight: 700, marginLeft: 10, color: 'var(--lsc-accent)' }}>
                  {formatGain(gains[active])}
                </span>
              </>
            )}
          </span>
          <button
            className="nodrag nopan lsc-btn-outline"
            title={t.nodes.graphicEq.flatHint}
            disabled={isFlat}
            onClick={() => updateNodeParams(id, Object.fromEntries(GEQ_CENTERS.map((_, i) => [`b${i}`, 0])))}
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

        {/* Slider panel */}
        <div
          className="nodrag nopan"
          style={{
            padding: PANEL_PAD, borderRadius: 8,
            background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)',
          }}
        >
          <div style={{ display: 'flex' }}>
            {/* dB scale */}
            <div style={{ position: 'relative', width: AXIS_W, height: SLIDER_H, flexShrink: 0 }}>
              {AXIS_DB.map((db) => (
                <span
                  key={db}
                  style={{
                    position: 'absolute', right: 6, top: yOf(db), transform: 'translateY(-50%)',
                    fontSize: 11, fontFamily: 'var(--lsc-font-mono)', lineHeight: 1,
                    color: db === 0 ? 'var(--signal-good)' : 'var(--lsc-fg-dim)',
                  }}
                >
                  {db > 0 ? `+${db}` : db < 0 ? `−${-db}` : '0'}
                </span>
              ))}
            </div>

            {/* The sliders: press anywhere in a column, then drag up / down */}
            <div
              ref={areaRef}
              onPointerDown={onPointerDown}
              onPointerMove={(e) => { if (dragBand.current === null) setActive(bandAt(e.clientX)) }}
              onPointerLeave={() => { if (dragBand.current === null) setActive(null) }}
              onDoubleClick={(e) => setGain.current(bandAt(e.clientX), 0)}
              style={{ position: 'relative', width: COL_W * BANDS, height: SLIDER_H, cursor: 'ns-resize', touchAction: 'none' }}
            >
              {/* Grid: ±12, ±6 and the 0 dB line */}
              {AXIS_DB.map((db) => (
                <div
                  key={db}
                  style={{
                    position: 'absolute', left: 0, right: 0, top: yOf(db), height: 1,
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
                    background: active === i ? 'var(--lsc-accent)' : 'var(--lsc-track-3)', pointerEvents: 'none',
                  }}
                />
              ))}

              {/* The curve through the caps */}
              <svg
                width={COL_W * BANDS} height={SLIDER_H}
                style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
              >
                <path d={curve} fill="none" stroke="var(--lsc-accent)" strokeWidth={2} strokeLinejoin="round" opacity={0.85} />
              </svg>

              {/* Caps: small fader caps, the white line marks the setting */}
              {gains.map((g, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute', left: capX(i) - CAP_W / 2, top: yOf(g) - CAP_H / 2,
                    width: CAP_W, height: CAP_H, borderRadius: 2,
                    background: 'linear-gradient(#4a4c52, #25262a 45%, #111214)',
                    border: '1px solid var(--lsc-fader-cap-rim)',
                    boxShadow: active === i ? '0 0 0 2px var(--lsc-accent)' : '0 1px 2px rgba(0,0,0,0.35)',
                    pointerEvents: 'none',
                  }}
                >
                  <div style={{ position: 'absolute', left: 3, right: 3, top: '50%', height: 1.5, marginTop: -0.75, background: '#f4f4f4' }} />
                </div>
              ))}
            </div>
          </div>

          {/* Frequencies, in two staggered rows */}
          <div style={{ position: 'relative', marginLeft: AXIS_W, height: LABEL_ROW * 2, marginTop: 6 }}>
            {GEQ_CENTERS.map((hz, i) => (
              <span
                key={hz}
                style={{
                  position: 'absolute', left: capX(i), top: (i % 2) * LABEL_ROW, transform: 'translateX(-50%)',
                  fontSize: 11, fontFamily: 'var(--lsc-font-mono)', lineHeight: `${LABEL_ROW}px`, whiteSpace: 'nowrap',
                  fontWeight: active === i ? 700 : 400,
                  color: active === i ? 'var(--lsc-accent)' : 'var(--lsc-fg-dim)',
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
