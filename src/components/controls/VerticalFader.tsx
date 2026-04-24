import { motion } from 'framer-motion'

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
  const pct = ((value - min) / (max - min)) * 100

  const displayValue = formatValue
    ? formatValue(value)
    : `${value >= 0 ? '+' : ''}${value} dB`

  return (
    <div className="nodrag flex items-center justify-center gap-4 py-1">
      <div className="relative w-8 flex items-center justify-center" style={{ height }}>
        {/* Track */}
        <div
          className="absolute w-2 h-full rounded-full"
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
              <div key={db} className="absolute w-full" style={{ top }}>
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
        <motion.div
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
        </motion.div>

        {/* Hidden range input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="nodrag nopan absolute inset-0 opacity-0 cursor-ns-resize w-full h-full"
          style={{
            writingMode: 'vertical-lr',
            direction: 'rtl',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            appearance: 'slider-vertical' as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            WebkitAppearance: 'slider-vertical' as any,
          }}
        />
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
