import { takePress, usePointerDrag } from '../../hooks/usePointerDrag'
import { StableText } from './StableText'
import { widestFormat } from '../../utils/readout'

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
  /** Where the value and label go: under the knob (default) or beside it (the label may wrap to two lines). */
  layout?: 'below' | 'side'
  /** Under the knob: the label under the value even on a big knob, which puts them side by side (room across is short) */
  labelBelow?: boolean
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
  layout = 'below',
  labelBelow = false,
}: KnobControlProps) {
  const range = max - min
  const normalizedValue = Math.max(0, Math.min(1, (value - min) / range))
  const currentClock = START_CLOCK + normalizedValue * SWEEP

  const cx = size / 2
  const cy = size / 2
  // Strokes grow with a big knob (free-standing Gain / Pan); at card sizes they stay 4px
  const stroke = Math.max(4, size * 0.075)
  const trackR = size / 2 - stroke * 1.5

  const trackStart = polarPoint(cx, cy, trackR, START_CLOCK)
  const trackEnd = polarPoint(cx, cy, trackR, START_CLOCK + SWEEP - 0.01)

  const fillEnd = polarPoint(cx, cy, trackR, currentClock)
  const fillLargeArc = normalizedValue * SWEEP >= 180 ? 1 : 0

  const indicatorTip = polarPoint(cx, cy, trackR - stroke * 2, currentClock)

  const format  = formatValue ?? ((v: number) => String(v))
  const display = format(value)

  // Drag up / down: 150px is the whole range
  const drag = usePointerDrag<{ y: number; value: number }>((e, from) => {
    const dy = from.y - e.clientY
    const deltaValue = (dy / 150) * range
    const raw = from.value + deltaValue
    const clamped = Math.max(min, Math.min(max, raw))
    const stepped = Math.round(clamped / step) * step
    onChange(parseFloat(stepped.toFixed(10)))
  })

  const onPointerDown = (e: React.PointerEvent) => {
    if (takePress(e)) drag.start({ y: e.clientY, value })
  }

  const valueSize = size >= 52 ? 15 : 13
  const inlineLabel = size >= 56 && !labelBelow
  const side = layout === 'side'

  return (
    <div
      className={`nodrag flex ${side ? 'flex-row' : 'flex-col'} items-center select-none ${className}`}
      style={{ minWidth: size, gap: side ? 10 : 4 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onPointerDown={onPointerDown}
        style={{ cursor: 'ns-resize', touchAction: 'none', flexShrink: 0 }}
      >
        {/* Knob body */}
        <circle cx={cx} cy={cy} r={size / 2 - 1} fill="var(--lsc-node-bg-2)" stroke="var(--lsc-border)" strokeWidth="1" />

        {/* Track arc — full sweep */}
        <path
          d={`M ${trackStart.x.toFixed(2)},${trackStart.y.toFixed(2)} A ${trackR} ${trackR} 0 1 1 ${trackEnd.x.toFixed(2)},${trackEnd.y.toFixed(2)}`}
          fill="none"
          stroke="var(--lsc-border)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />

        {/* Fill arc */}
        {normalizedValue > 0.005 && (
          <path
            d={`M ${trackStart.x.toFixed(2)},${trackStart.y.toFixed(2)} A ${trackR} ${trackR} 0 ${fillLargeArc} 1 ${fillEnd.x.toFixed(2)},${fillEnd.y.toFixed(2)}`}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}

        {/* Indicator dot — a plain circle, eased by a CSS transition */}
        <circle
          cx={indicatorTip.x}
          cy={indicatorTip.y}
          r={Math.max(3, size * 0.05)}
          fill="var(--lsc-fg)"
          style={{ transition: 'cx 80ms ease-out, cy 80ms ease-out' }}
        />
      </svg>
      {showReadout && side && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, lineHeight: 1.1 }}>
          <StableText
            reserve={[widestFormat(min, max, step, format)]}
            style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: valueSize, fontWeight: 700, color: 'var(--lsc-fg)' }}
          >
            {display}
          </StableText>
          <span className="lsc-knob-label" style={{ lineHeight: 1.15 }}>{label}</span>
        </div>
      )}
      {showReadout && !side && (
        <div
          style={{
            display: 'flex', flexDirection: inlineLabel ? 'row' : 'column',
            alignItems: inlineLabel ? 'baseline' : 'center', gap: inlineLabel ? 6 : 3,
            whiteSpace: 'nowrap', lineHeight: 1.1,
          }}
        >
          <StableText
            reserve={[widestFormat(min, max, step, format)]}
            align="center"
            style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: valueSize, fontWeight: 700, color: 'var(--lsc-fg)' }}
          >
            {display}
          </StableText>
          <span className="lsc-knob-label">{label}</span>
        </div>
      )}
    </div>
  )
}
