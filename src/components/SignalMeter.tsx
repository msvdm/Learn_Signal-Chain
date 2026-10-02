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
    <div className="flex flex-col" style={{ gap: 4 }}>
      {label && (
        <span style={{ fontSize: 'var(--node-text-sm)', color: 'var(--lsc-fg-muted)' }}>
          {label}
        </span>
      )}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: 6, borderRadius: 9999, background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border-soft)' }}
      >
        <motion.div
          className="absolute left-0 top-0 h-full"
          style={{ backgroundColor: style.color, borderRadius: 9999 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
        {/* Zone tick marks at -40 (25%), -12 (60%), 0 (75%) */}
        <div className="absolute top-0 h-full w-px" style={{ left: `${dbToPercent(-40)}%`, background: 'var(--lsc-border)' }} />
        <div className="absolute top-0 h-full w-px" style={{ left: `${dbToPercent(-12)}%`, background: 'var(--lsc-border)' }} />
        <div className="absolute top-0 h-full w-px" style={{ left: `${dbToPercent(0)}%`, background: 'var(--lsc-fg-muted)' }} />
      </div>
      {showValue && (
        <div className="flex items-center justify-between" style={{ gap: 8 }}>
          <span style={{ fontSize: 'var(--node-text-sm)', fontFamily: 'var(--lsc-font-mono)', fontWeight: 600, color: style.color, whiteSpace: 'nowrap' }}>
            {formatDb(db)}
          </span>
          <span style={{ fontSize: 'var(--node-text-sm)', fontWeight: 600, color: style.color, whiteSpace: 'nowrap' }}>
            {t.health[health]}
          </span>
        </div>
      )}
    </div>
  )
}
