import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

interface KnobControlProps {
  value: number
  min: number
  max: number
  step?: number
  label: string
  formatValue?: (v: number) => string
  onChange: (v: number) => void
  size?: number
  color?: string
  className?: string
}

const START_CLOCK = 225
const SWEEP = 270

function polarPoint(cx: number, cy: number, r: number, clockDeg: number) {
  const rad = ((clockDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

export function KnobControl({
  value,
  min,
  max,
  step = 1,
  label,
  formatValue,
  onChange,
  size = 52,
  color = 'var(--signal-good)',
  className = '',
}: KnobControlProps) {
  const range = max - min
  const normalizedValue = Math.max(0, Math.min(1, (value - min) / range))
  const currentClock = START_CLOCK + normalizedValue * SWEEP

  const cx = size / 2
  const cy = size / 2
  const trackR = size / 2 - 6

  const trackStart = polarPoint(cx, cy, trackR, START_CLOCK)
  const trackEnd = polarPoint(cx, cy, trackR, START_CLOCK + SWEEP - 0.01)

  const fillEnd = polarPoint(cx, cy, trackR, currentClock)
  const fillLargeArc = normalizedValue * SWEEP >= 180 ? 1 : 0

  const indicatorTip = polarPoint(cx, cy, trackR - 5, currentClock)

  const display = formatValue ? formatValue(value) : String(value)

  const startY = useRef<number | null>(null)
  const startValue = useRef(value)
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (startY.current === null) return
      const dy = startY.current - e.clientY
      const deltaValue = (dy / 150) * range
      const raw = startValue.current + deltaValue
      const clamped = Math.max(min, Math.min(max, raw))
      const stepped = Math.round(clamped / step) * step
      onChange(parseFloat(stepped.toFixed(10)))
    }
    const onUp = () => { startY.current = null }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [min, max, range, step, onChange])

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    startY.current = e.clientY
    startValue.current = valueRef.current
  }

  return (
    <div className={`nodrag flex flex-col items-center gap-0.5 select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onPointerDown={onPointerDown}
        style={{ cursor: 'ns-resize', touchAction: 'none' }}
      >
        {/* Knob body */}
        <circle cx={cx} cy={cy} r={size / 2 - 1} fill="var(--lsc-node-bg-2)" stroke="var(--lsc-track-3)" strokeWidth="1.5" />

        {/* Track arc — full sweep, dim */}
        <path
          d={`M ${trackStart.x.toFixed(2)},${trackStart.y.toFixed(2)} A ${trackR} ${trackR} 0 1 1 ${trackEnd.x.toFixed(2)},${trackEnd.y.toFixed(2)}`}
          fill="none"
          stroke="var(--lsc-border)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Fill arc */}
        {normalizedValue > 0.005 && (
          <path
            d={`M ${trackStart.x.toFixed(2)},${trackStart.y.toFixed(2)} A ${trackR} ${trackR} 0 ${fillLargeArc} 1 ${fillEnd.x.toFixed(2)},${fillEnd.y.toFixed(2)}`}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}

        {/* Indicator dot */}
        <motion.circle
          r={2.5}
          fill="white"
          animate={{ cx: indicatorTip.x, cy: indicatorTip.y }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        />
      </svg>
      <span className="text-[9px] font-mono leading-none" style={{ color: 'var(--lsc-text)' }}>
        {display}
      </span>
      <span className="text-[8px] uppercase tracking-wider leading-none" style={{ color: 'var(--lsc-text)' }}>
        {label}
      </span>
    </div>
  )
}
