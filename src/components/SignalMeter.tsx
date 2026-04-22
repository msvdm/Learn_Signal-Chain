import { motion } from 'framer-motion'
import { getHealthStyle, dbToPercent, formatDb } from '../hooks/useGainStaging'
import type { SignalHealth } from '../hooks/useSignalChain'

interface SignalMeterProps {
  db: number
  health: SignalHealth
  label?: string
  showValue?: boolean
}

export function SignalMeter({ db, health, label, showValue = true }: SignalMeterProps) {
  const style = getHealthStyle(health)
  const pct = dbToPercent(db)

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs text-slate-500">{label}</span>}
      <div className="relative h-3 w-full rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ backgroundColor: style.color }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
        {/* Tick marks at key dB levels */}
        {/* -40 dBu = ((-40+60)/80)*100 = 25% */}
        <div className="absolute top-0 h-full w-px bg-slate-300" style={{ left: '25%' }} />
        {/* -12 dBu = 60% */}
        <div className="absolute top-0 h-full w-px bg-slate-300" style={{ left: '60%' }} />
        {/* 0 dBu = 75% */}
        <div className="absolute top-0 h-full w-px bg-slate-400" style={{ left: '75%' }} />
      </div>
      {showValue && (
        <div className="flex items-center justify-between">
          <span className={`text-xs font-mono font-semibold ${style.textClass}`}>
            {formatDb(db)}
          </span>
          <span className={`text-xs font-medium ${style.textClass}`}>{style.label}</span>
        </div>
      )}
    </div>
  )
}
