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

// Layout constants (px)
const TRACK_LEFT = 8
const TRACK_W    = 8
const CAP_W      = 22
const CAP_H      = 12
const CAP_LEFT   = TRACK_LEFT + TRACK_W / 2 - CAP_W / 2   // centres cap on track
const TICK_LEFT  = TRACK_LEFT + TRACK_W + 2                // right of track + gap

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
}: VerticalFaderProps) {
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
        style={{ position: 'relative', width: 60, height, touchAction: 'none', cursor: 'ns-resize', flexShrink: 0 }}
        onPointerDown={handlePointerDown}
      >
        {/* Track groove */}
        <div style={{
          position: 'absolute', left: TRACK_LEFT, top: 0, bottom: 0, width: TRACK_W,
          borderRadius: 4,
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
                top: `${topPct}%`, left: TICK_LEFT,
                width: isUnity ? 8 : 5, height: 1,
                background: isUnity ? 'var(--signal-good)' : 'var(--lsc-border)',
                pointerEvents: 'none',
              }} />
              <span style={{
                position: 'absolute',
                top: `${topPct}%`, left: TICK_LEFT + (isUnity ? 10 : 7),
                transform: 'translateY(-50%)',
                fontSize: 10, fontFamily: 'var(--lsc-font-mono)', lineHeight: 1,
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
          left: CAP_LEFT, width: CAP_W, height: CAP_H,
          top: `${100 - pct}%`, marginTop: -(CAP_H / 2),
          background: 'var(--lsc-node-bg-2)',
          border: '1px solid var(--lsc-fg-muted)',
          borderRadius: 2,
          boxShadow: 'var(--lsc-shadow-fader)',
          pointerEvents: 'none',
        }}>
          {/* Centre line on cap */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            width: '60%', height: 1,
            transform: 'translate(-50%, -50%)',
            background: 'var(--lsc-fg-muted)',
          }} />
        </div>
      </div>

      {/* Value readout */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 52 }}>
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
      </div>
    </div>
  )
}
