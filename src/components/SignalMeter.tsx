import { motion } from 'framer-motion'
import { getHealthStyle, dbToPercent, formatDb } from '../hooks/useGainStaging'
import { useTranslation } from '../i18n/useTranslation'
import { getHealth } from '../hooks/useSignalChain'
import type { SignalHealth } from '../hooks/useSignalChain'
import { StableText } from './controls/StableText'
import { LEVEL_SAMPLE } from '../utils/readout'

interface SignalMeterProps {
  db: number
  health: SignalHealth
  label?: string
  showValue?: boolean
  /** Right-side level. When set, the meter shows two bars: L (db) and R (dbR). */
  dbR?: number
}

function MeterBar({ db, color }: { db: number; color: string }) {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: 6, borderRadius: 9999, background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border-soft)' }}
    >
      <motion.div
        className="absolute left-0 top-0 h-full"
        style={{ backgroundColor: color, borderRadius: 9999 }}
        animate={{ width: `${dbToPercent(db)}%` }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      />
      {/* Zone tick marks at -40 (25%), -12 (60%), 0 (75%) */}
      <div className="absolute top-0 h-full w-px" style={{ left: `${dbToPercent(-40)}%`, background: 'var(--lsc-border)' }} />
      <div className="absolute top-0 h-full w-px" style={{ left: `${dbToPercent(-12)}%`, background: 'var(--lsc-border)' }} />
      <div className="absolute top-0 h-full w-px" style={{ left: `${dbToPercent(0)}%`, background: 'var(--lsc-fg-muted)' }} />
    </div>
  )
}

/** One labelled channel bar (L or R) with its level, coloured by its own health. */
export function ChannelRow({ ch, db }: { ch: string; db: number }) {
  const color = isFinite(db) ? getHealthStyle(getHealth(db)).color : 'var(--lsc-border)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ fontWeight: 700, width: 10, color: 'var(--lsc-fg-muted)' }}>{ch}</span>
      <div style={{ flex: 1 }}>
        <MeterBar db={db} color={color} />
      </div>
      <StableText reserve={[LEVEL_SAMPLE]} align="end" style={{ fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-fg-muted)' }}>
        {isFinite(db) ? db.toFixed(1) : '−∞'}
      </StableText>
    </div>
  )
}

export function SignalMeter({ db, health, label, showValue = true, dbR }: SignalMeterProps) {
  const style  = getHealthStyle(health)
  const { t }  = useTranslation()
  const stereo = dbR !== undefined

  return (
    <div className="flex flex-col" style={{ gap: 4 }}>
      {label && (
        <span style={{ fontSize: 'var(--node-text-sm)', color: 'var(--lsc-fg-muted)' }}>
          {label}
        </span>
      )}
      {stereo ? (
        <>
          <ChannelRow ch="L" db={db} />
          <ChannelRow ch="R" db={dbR} />
        </>
      ) : (
        <MeterBar db={db} color={style.color} />
      )}
      {showValue && (
        <div className="flex items-center justify-between" style={{ gap: 8 }}>
          {/* In stereo each bar shows its own level, so only the health word stays here */}
          <StableText
            reserve={['+00.0 dBu']}
            style={{ fontSize: 'var(--node-text-sm)', fontFamily: 'var(--lsc-font-mono)', fontWeight: 600, color: style.color }}
          >
            {stereo ? '' : formatDb(db)}
          </StableText>
          <StableText
            reserve={Object.values(t.health)}
            align="end"
            style={{ fontSize: 'var(--node-text-sm)', fontWeight: 600, color: style.color }}
          >
            {t.health[health]}
          </StableText>
        </div>
      )}
    </div>
  )
}
