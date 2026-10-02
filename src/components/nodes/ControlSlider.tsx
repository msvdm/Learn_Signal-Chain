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
    <div className={`nodrag nopan space-y-1 ${className}`}>
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <span className="text-[var(--node-text-sm)]" style={{ color: 'var(--lsc-fg-muted)', whiteSpace: 'nowrap' }}>{label}</span>
        <StableText
          reserve={reserve ?? [widestFormat(min, max, step, format)]}
          align="end"
          className="text-[var(--node-text-sm)] font-mono font-bold"
          style={{ color: 'var(--lsc-fg)' }}
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
        className="nodrag nopan w-full h-1.5 appearance-none rounded-full cursor-pointer"
        style={{ accentColor: 'var(--lsc-accent)', background: 'var(--lsc-track)' }}
      />
    </div>
  )
}
