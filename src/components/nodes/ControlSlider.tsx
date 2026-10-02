interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  label: string
  formatValue?: (v: number) => string
  onChange: (v: number) => void
  className?: string
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
}: SliderProps) {
  const display = formatValue ? formatValue(value) : String(value)
  return (
    <div className={`nodrag nopan space-y-1 ${className}`}>
      <div className="flex items-center justify-between" style={{ gap: 8 }}>
        <span className="text-[var(--node-text-sm)]" style={{ color: 'var(--lsc-fg-muted)', whiteSpace: 'nowrap' }}>{label}</span>
        <span className="text-[var(--node-text-sm)] font-mono font-bold" style={{ color: 'var(--lsc-fg)', minWidth: '4em', textAlign: 'right', whiteSpace: 'nowrap' }}>
          {display}
        </span>
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
