import { useRef, useEffect } from 'react'

const DEFAULT_MARKS = [
  { db: 10,  label: '+10' },
  { db: 0,   label: '0'   },
  { db: -10, label: '-10' },
  { db: -20, label: '-20' },
  { db: -40, label: '-40' },
]

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
  height = 128,
}: VerticalFaderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value

  const pct = ((value - min) / (max - min)) * 100
  const displayValue = formatValue
    ? formatValue(value)
    : `${value >= 0 ? '+' : ''}${value} dB`

  function computeValueFromPointer(clientY: number): number {
    if (!trackRef.current) return valueRef.current
    const rect = trackRef.current.getBoundingClientRect()
    const relY = Math.max(0, Math.min(rect.height, clientY - rect.top))
    const fraction = 1 - relY / rect.height
    const raw = min + fraction * (max - min)
    const stepped = Math.round(raw / step) * step
    return Math.max(min, Math.min(max, stepped))
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!isDragging.current) return
      onChange(computeValueFromPointer(e.clientY))
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, step, onChange])

  function handlePointerDown(e: React.PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    isDragging.current = true
    onChange(computeValueFromPointer(e.clientY))
  }

  return (
    <div className="nodrag nopan flex items-center justify-center gap-4 py-1">
      <div
        ref={trackRef}
        className="relative w-8 flex items-center justify-center select-none"
        style={{ height, touchAction: 'none', cursor: 'ns-resize' }}
        onPointerDown={handlePointerDown}
      >
        {/* Track */}
        <div
          className="absolute w-2 h-full rounded-full pointer-events-none"
          style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}
        />

        {/* dB scale markers */}
        {marks
          .filter((m) => m.db >= min && m.db <= max)
          .map(({ db, label }) => {
            const markPct = ((db - min) / (max - min)) * 100
            const top = `${100 - markPct}%`
            const isUnity = db === 0
            return (
              <div key={db} className="absolute w-full pointer-events-none" style={{ top }}>
                <div
                  className="absolute h-px"
                  style={{
                    width: isUnity ? 20 : 12,
                    right: isUnity ? -4 : 0,
                    background: isUnity ? 'var(--signal-good)' : 'var(--lsc-border)',
                  }}
                />
                <span
                  className="absolute text-[7px] font-mono"
                  style={{ right: 24, top: -4, color: isUnity ? 'var(--signal-good)' : 'var(--lsc-fg-fainter)' }}
                >
                  {label}
                </span>
              </div>
            )
          })}

        {/* Fader cap */}
        <div
          className="absolute z-10 rounded-sm pointer-events-none"
          style={{
            width: 28,
            height: 14,
            bottom: `${pct}%`,
            marginBottom: -7,
            background: 'linear-gradient(180deg, var(--lsc-track-3) 0%, var(--lsc-track-2) 100%)',
            border: '1px solid var(--lsc-fg-fainter)',
            boxShadow: 'var(--lsc-shadow-fader)',
          }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-px"
            style={{ width: '60%', transform: 'translate(-50%,-50%)', background: 'var(--lsc-fg-faint)' }}
          />
        </div>
      </div>

      {/* Value readout */}
      <div className="text-center min-w-[36px]">
        <div className="text-xs font-mono font-semibold" style={{ color: 'var(--lsc-fg)' }}>
          {displayValue}
        </div>
        {value === 0 && (
          <div className="text-[9px] mt-0.5" style={{ color: 'var(--signal-good)' }}>
            unity
          </div>
        )}
      </div>
    </div>
  )
}
