import { takePress, usePointerDrag } from '../../hooks/usePointerDrag'
import { StableText } from './StableText'
import { widestFormat } from '../../utils/readout'
import { KnobFace } from './KnobFace'
import { capRadius } from './knobShape'

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
  /** How far (px on screen, up / down) a drag takes it through its whole range */
  dragPx?: number
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
  dragPx = 150,
}: KnobControlProps) {
  const range = max - min
  const normalizedValue = Math.max(0, Math.min(1, (value - min) / range))
  const format  = formatValue ?? ((v: number) => String(v))
  const display = format(value)

  // Drag up / down: dragPx is the whole range
  const drag = usePointerDrag<{ y: number; value: number }>((e, from) => {
    const dy = from.y - e.clientY
    const deltaValue = (dy / dragPx) * range
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
      className={`nodrag ${className}`}
      style={{ display: 'flex', flexDirection: side ? 'row' : 'column', alignItems: 'center', userSelect: 'none', WebkitUserSelect: 'none', minWidth: size, gap: side ? 10 : 4 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onPointerDown={onPointerDown}
        style={{ cursor: 'ns-resize', touchAction: 'none', flexShrink: 0 }}
      >
        {/* The logo's knob: its cap, the notch pointing at the value */}
        <KnobFace cx={size / 2} cy={size / 2} r={capRadius(size)} value={normalizedValue} color={color} />
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
