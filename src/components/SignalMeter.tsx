import { motion } from 'framer-motion'
import { getHealthStyle, dbToPercent, formatDb } from '../hooks/useGainStaging'
import { useTranslation } from '../i18n/useTranslation'
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
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
      )}
      <div
        className="relative h-2.5 w-full rounded-full overflow-hidden"
        style={{ background: '#0d0f13', border: '1px solid #1e2128' }}
      >
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ backgroundColor: style.color }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
        {/* Zone tick marks */}
        <div className="absolute top-0 h-full w-px" style={{ left: '25%', background: '#2e3341' }} />
        <div className="absolute top-0 h-full w-px" style={{ left: '60%', background: '#2e3341' }} />
        <div className="absolute top-0 h-full w-px" style={{ left: '75%', background: '#4b5563' }} />
      </div>
      {showValue && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-semibold" style={{ color: style.color }}>
            {formatDb(db)}
          </span>
          <span className="text-[10px] font-medium" style={{ color: style.color }}>
            {t.health[health]}
          </span>
        </div>
      )}
    </div>
  )
}
