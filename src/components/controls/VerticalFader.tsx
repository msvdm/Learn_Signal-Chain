import { Fragment, useRef, useEffect } from 'react'
import { StableText } from './StableText'
import { widestFormat } from '../../utils/readout'
import { useLatestRef } from '../../hooks/useLatestRef'

const DEFAULT_MARKS = [
  { db: 10,  label: '+10' },
  { db: 0,   label:  '0'  },
  { db: -10, label: '-10' },
  { db: -20, label: '-20' },
  { db: -40, label: '-40' },
  { db: -60, label: '-60' },
  { db: -80, label: '−∞'  },
]

// Layout constants (px, at scale 1)
const AREA_W     = 60
const TRACK_LEFT = 8
const TRACK_W    = 8
const CAP_W      = 22
const CAP_H      = 12
const TICK_GAP   = 2
const MARK_FONT  = 10

interface VerticalFaderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  formatValue?: (v: number) => string
  marks?: Array<{ db: number; label: string }>
  height?: number
  /** Word shown under the readout at 0 dB. */
  unityLabel?: string
  /** Draw everything this many times bigger (the free-standing fader). Height is set separately. */
  scale?: number
  /** false = no value readout beside the fader; the caller shows it. */
  showReadout?: boolean
}

export function VerticalFader({
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  marks = DEFAULT_MARKS,
  height = 120,
  unityLabel = 'unity',
  scale = 1,
  showReadout = true,
}: VerticalFaderProps) {
  const k         = scale
  const trackLeft = TRACK_LEFT * k
  const trackW    = TRACK_W * k
  const capW      = CAP_W * k
  const capH      = CAP_H * k
  const capLeft   = trackLeft + trackW / 2 - capW / 2   // centres cap on track
  const tickLeft  = trackLeft + trackW + TICK_GAP * k   // right of track + gap
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging   = useRef(false)
  const valueRef     = useLatestRef(value)

  const pct          = ((value - min) / (max - min)) * 100
  const format       = formatValue ?? ((v: number) => `${v >= 0 ? '+' : ''}${v} dB`)
  const displayValue = format(value)

  function computeFromPointer(clientY: number): number {
    if (!containerRef.current) return valueRef.current
    const rect     = containerRef.current.getBoundingClientRect()
    const relY     = Math.max(0, Math.min(rect.height, clientY - rect.top))
    const fraction = 1 - relY / rect.height
    const raw      = min + fraction * (max - min)
    const stepped  = Math.round(raw / step) * step
    return Math.max(min, Math.min(max, stepped))
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => { if (isDragging.current) onChange(computeFromPointer(e.clientY)) }
    const onUp   = () => { isDragging.current = false }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, step, onChange])

  function handlePointerDown(e: React.PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    isDragging.current = true
    onChange(computeFromPointer(e.clientY))
  }

  return (
    <div className="nodrag nopan" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>

      {/* Draggable fader area */}
      <div
        ref={containerRef}
        style={{ position: 'relative', width: AREA_W * k, height, touchAction: 'none', cursor: 'ns-resize', flexShrink: 0 }}
        onPointerDown={handlePointerDown}
      >
        {/* Track groove */}
        <div style={{
          position: 'absolute', left: trackLeft, top: 0, bottom: 0, width: trackW,
          borderRadius: 4 * k,
          background: 'var(--lsc-sunken)',
          border: '1px solid var(--lsc-border)',
          pointerEvents: 'none',
        }} />

        {/* Scale: ticks + labels to the right of the track */}
        {marks.filter((m) => m.db >= min && m.db <= max).map(({ db, label }) => {
          const topPct  = 100 - ((db - min) / (max - min)) * 100
          const isUnity = db === 0
          return (
            <Fragment key={db}>
              <div style={{
                position: 'absolute',
                top: `${topPct}%`, left: tickLeft,
                width: (isUnity ? 8 : 5) * k, height: Math.max(1, Math.round(k * 0.75)),
                background: isUnity ? 'var(--signal-good)' : 'var(--lsc-border)',
                pointerEvents: 'none',
              }} />
              <span style={{
                position: 'absolute',
                top: `${topPct}%`, left: tickLeft + (isUnity ? 10 : 7) * k,
                transform: 'translateY(-50%)',
                fontSize: MARK_FONT * k, fontFamily: 'var(--lsc-font-mono)', lineHeight: 1,
                color: isUnity ? 'var(--signal-good)' : 'var(--lsc-fg-muted)',
                pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </Fragment>
          )
        })}

        {/* Fader cap */}
        <div style={{
          position: 'absolute',
          left: capLeft, width: capW, height: capH,
          top: `${100 - pct}%`, marginTop: -(capH / 2),
          background: 'var(--lsc-node-bg-2)',
          border: `${Math.max(1, Math.round(k))}px solid var(--lsc-fg-muted)`,
          borderRadius: 2 * k,
          boxShadow: 'var(--lsc-shadow-fader)',
          pointerEvents: 'none',
        }}>
          {/* Centre line on cap */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            width: '60%', height: Math.max(1, Math.round(k)),
            transform: 'translate(-50%, -50%)',
            background: 'var(--lsc-fg-muted)',
          }} />
        </div>
      </div>

      {/* Value readout */}
      {showReadout && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 52 }}>
        <StableText
          reserve={[widestFormat(min, max, step, format)]}
          align="center"
          style={{ fontSize: 14, fontFamily: 'var(--lsc-font-mono)', fontWeight: 700, color: 'var(--lsc-fg)' }}
        >
          {displayValue}
        </StableText>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--signal-good)', visibility: value === 0 ? 'visible' : 'hidden' }}>
          {unityLabel}
        </span>
      </div>}
    </div>
  )
}
