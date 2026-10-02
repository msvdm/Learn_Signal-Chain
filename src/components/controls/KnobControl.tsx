import { useRef, useEffect } from 'react'

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
  /** false = knob only; the caller shows the value and label itself */
  showReadout?: boolean
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
  showReadout = true,
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

  const indicatorTip = polarPoint(cx, cy, trackR - 8, currentClock)

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

  const valueSize = size >= 52 ? 15 : 13
  const inlineLabel = size >= 56

  return (
    <div
      className={`nodrag flex flex-col items-center select-none ${className}`}
      style={{ minWidth: size, gap: 4 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onPointerDown={onPointerDown}
        style={{ cursor: 'ns-resize', touchAction: 'none' }}
      >
        {/* Knob body */}
        <circle cx={cx} cy={cy} r={size / 2 - 1} fill="var(--lsc-node-bg-2)" stroke="var(--lsc-border)" strokeWidth="1" />

        {/* Track arc — full sweep */}
        <path
          d={`M ${trackStart.x.toFixed(2)},${trackStart.y.toFixed(2)} A ${trackR} ${trackR} 0 1 1 ${trackEnd.x.toFixed(2)},${trackEnd.y.toFixed(2)}`}
          fill="none"
          stroke="var(--lsc-border)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Fill arc */}
        {normalizedValue > 0.005 && (
          <path
            d={`M ${trackStart.x.toFixed(2)},${trackStart.y.toFixed(2)} A ${trackR} ${trackR} 0 ${fillLargeArc} 1 ${fillEnd.x.toFixed(2)},${fillEnd.y.toFixed(2)}`}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}

        {/* Indicator dot — plain circle with CSS transition avoids framer-motion
            SVG attribute initialisation issues (cx/cy undefined on first paint) */}
        <circle
          cx={indicatorTip.x}
          cy={indicatorTip.y}
          r={3}
          fill="var(--lsc-fg)"
          style={{ transition: 'cx 80ms ease-out, cy 80ms ease-out' }}
        />
      </svg>
      {showReadout && (
        <div
          style={{
            display: 'flex', flexDirection: inlineLabel ? 'row' : 'column',
            alignItems: inlineLabel ? 'baseline' : 'center', gap: inlineLabel ? 6 : 3,
            whiteSpace: 'nowrap', lineHeight: 1.1,
          }}
        >
          <span style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: valueSize, fontWeight: 700, color: 'var(--lsc-fg)' }}>
            {display}
          </span>
          <span className="lsc-knob-label">{label}</span>
        </div>
      )}
    </div>
  )
}
