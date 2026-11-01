import { StableText } from '../controls/StableText'
import { widestFormat } from '../../utils/readout'

interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  label: string
  formatValue?: (v: number) => string
  onChange: (v: number) => void
  className?: string
  /** Texts the value can show (widest first is enough). Default: worked out from min / max / step. */
  reserve?: string[]
}

export function ControlSlider({
  value,
  min,
  max,
  step = 1,
  label,
  formatValue,
  onChange,
  className = '',
  reserve,
}: SliderProps) {
  const format  = formatValue ?? ((v: number) => String(v))
  const display = format(value)
  return (
    <div className={`nodrag nopan ${className}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <span style={{ color: 'var(--lsc-fg-muted)', whiteSpace: 'nowrap' }}>{label}</span>
        <StableText
          reserve={reserve ?? [widestFormat(min, max, step, format)]}
          align="end"
          style={{ fontFamily: 'var(--lsc-font-mono)', fontWeight: 700, color: 'var(--lsc-fg)' }}
        >
          {display}
        </StableText>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="nodrag nopan"
        style={{
          width: '100%', height: 6, appearance: 'none', borderRadius: 9999, cursor: 'pointer',
          accentColor: 'var(--lsc-accent)', background: 'var(--lsc-track)',
        }}
      />
    </div>
  )
}
