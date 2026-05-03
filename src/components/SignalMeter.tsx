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
        <span className="text-[var(--node-text-sm)]" style={{ color: 'var(--lsc-text)' }}>
          {label}
        </span>
      )}
      <div
        className="relative h-2.5 w-full rounded-full overflow-hidden"
        style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border-soft)' }}
      >
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ backgroundColor: style.color }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
        {/* Zone tick marks at -40 (46.5%), -12 (79.1%), 0 (93%) */}
        <div className="absolute top-0 h-full w-px" style={{ left: '46.5%', background: 'var(--lsc-border)' }} />
        <div className="absolute top-0 h-full w-px" style={{ left: '79.1%', background: 'var(--lsc-border)' }} />
        <div className="absolute top-0 h-full w-px" style={{ left: '93%', background: 'var(--lsc-text)' }} />
      </div>
      {showValue && (
        <div className="flex items-center justify-between">
          <span className="text-[var(--node-text-sm)] font-mono font-semibold" style={{ color: style.color }}>
            {formatDb(db)}
          </span>
          <span className="text-[var(--node-text-sm)] font-medium" style={{ color: style.color }}>
            {t.health[health]}
          </span>
        </div>
      )}
    </div>
  )
}
