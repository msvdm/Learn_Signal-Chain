import { Fragment, useRef, useEffect } from 'react'

const DEFAULT_MARKS = [
  { db: 10,  label: '+10' },
  { db: 0,   label:  '0'  },
  { db: -10, label: '-10' },
  { db: -20, label: '-20' },
  { db: -40, label: '-40' },
  { db: -60, label: '-60' },
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
}

export function VerticalFader({
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  marks = DEFAULT_MARKS,
  height = 144,
}: VerticalFaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging   = useRef(false)
  const valueRef     = useRef(value)
  valueRef.current   = value

  const pct          = ((value - min) / (max - min)) * 100
  const displayValue = formatValue
    ? formatValue(value)
    : `${value >= 0 ? '+' : ''}${value} dB`

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
    <div className="nodrag nopan" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>

      {/* Draggable fader area */}
      <div
        ref={containerRef}
        style={{ position: 'relative', width: 72, height, touchAction: 'none', cursor: 'ns-resize' }}
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
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }} />
              <span style={{
                position: 'absolute',
                top: `${topPct}%`, left: TICK_LEFT + (isUnity ? 10 : 7),
                transform: 'translateY(-50%)',
                fontSize: 'var(--node-text-3xs)', fontFamily: 'monospace', lineHeight: 1,
                color: isUnity ? 'var(--signal-good)' : 'var(--lsc-text)',
                opacity: isUnity ? 1 : 0.65,
                pointerEvents: 'none', userSelect: 'none',
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
          background: 'linear-gradient(180deg, var(--lsc-track-3) 0%, var(--lsc-track-2) 100%)',
          border: '1px solid var(--lsc-text)',
          borderRadius: 2,
          boxShadow: 'var(--lsc-shadow-fader)',
          pointerEvents: 'none',
        }}>
          {/* Centre line on cap */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            width: '60%', height: 1,
            transform: 'translate(-50%, -50%)',
            background: 'var(--lsc-text)',
          }} />
        </div>
      </div>

      {/* Value readout */}
      <div style={{ textAlign: 'center', lineHeight: 1 }}>
        <div style={{ fontSize: 'var(--node-text-xs)', fontFamily: 'monospace', fontWeight: 600, color: 'var(--lsc-text)' }}>
          {displayValue}
        </div>
        {value === 0 && (
          <div style={{ fontSize: 'var(--node-text-2xs)', color: 'var(--signal-good)', marginTop: 2 }}>unity</div>
        )}
      </div>
    </div>
  )
}
