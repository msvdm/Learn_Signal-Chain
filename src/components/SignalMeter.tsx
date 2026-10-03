import { motion } from 'framer-motion'
import { getHealthStyle, dbToPercent, formatDb } from '../hooks/useGainStaging'
import { useTranslation } from '../i18n/useTranslation'
import { getHealth, UNITY_DBU, ALIGNMENT_DB } from '../hooks/useSignalChain'
import type { SignalHealth, SignalDomain } from '../hooks/useSignalChain'
import { StableText } from './controls/StableText'
import { LEVEL_SAMPLE } from '../utils/readout'

interface SignalMeterProps {
  db: number
  health: SignalHealth
  label?: string
  showValue?: boolean
  /** Right-side level. When set, the meter shows two bars: L (db) and R (dbR). */
  dbR?: number
  /** Analog (dBu, the default) or digital (dBFS): sets the zones, the ticks and the unit */
  domain?: SignalDomain
}

/**
 * Tick marks at the zone edges: where "too quiet" ends and unity (the strong one). Digital also
 * marks its ceiling, 0 dBFS; analog clips at +20 dBu, the end of the scale.
 */
function zoneTicks(domain: SignalDomain): { db: number; strong: boolean }[] {
  const unity = domain === 'digital' ? UNITY_DBU - ALIGNMENT_DB : UNITY_DBU
  const ticks = [{ db: unity - 40, strong: false }, { db: unity, strong: true }]
  return domain === 'digital' ? [...ticks, { db: 0, strong: false }] : ticks
}

/** One level bar on the −60…+20 dB scale, with tick marks at the zone edges. `height` includes the border. */
export function MeterBar({ db, color, height = 6, domain = 'analog' }: { db: number; color: string; height?: number; domain?: SignalDomain }) {
  // Ticks widen with a tall bar (the overview meter), so they stay visible zoomed out
  const tick = Math.max(1, Math.round(height / 8))
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height, borderRadius: 9999, background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border-soft)' }}
    >
      <motion.div
        className="absolute left-0 top-0 h-full"
        style={{ backgroundColor: color, borderRadius: 9999 }}
        animate={{ width: `${dbToPercent(db)}%` }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      />
      {zoneTicks(domain).map(({ db: at, strong }) => (
        <div
          key={at}
          className="absolute top-0 h-full"
          style={{ width: tick, left: `${dbToPercent(at)}%`, background: strong ? 'var(--lsc-fg-muted)' : 'var(--lsc-border)' }}
        />
      ))}
    </div>
  )
}

/** One labelled channel bar (L or R) with its level, coloured by its own health. */
export function ChannelRow({ ch, db, domain = 'analog' }: { ch: string; db: number; domain?: SignalDomain }) {
  const color = isFinite(db) ? getHealthStyle(getHealth(db, domain)).color : 'var(--lsc-border)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ fontWeight: 700, width: 10, color: 'var(--lsc-fg-muted)' }}>{ch}</span>
      <div style={{ flex: 1 }}>
        <MeterBar db={db} color={color} domain={domain} />
      </div>
      <StableText reserve={[LEVEL_SAMPLE]} align="end" style={{ fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-fg-muted)' }}>
        {isFinite(db) ? db.toFixed(1) : '−∞'}
      </StableText>
    </div>
  )
}

export function SignalMeter({ db, health, label, showValue = true, dbR, domain = 'analog' }: SignalMeterProps) {
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
          <ChannelRow ch="L" db={db} domain={domain} />
          <ChannelRow ch="R" db={dbR} domain={domain} />
        </>
      ) : (
        <MeterBar db={db} color={style.color} domain={domain} />
      )}
      {showValue && (
        <div className="flex items-center justify-between" style={{ gap: 8 }}>
          {/* In stereo each bar shows its own level, so only the health word stays here */}
          <StableText
            reserve={[domain === 'digital' ? '+00.0 dBFS' : '+00.0 dBu']}
            style={{ fontSize: 'var(--node-text-sm)', fontFamily: 'var(--lsc-font-mono)', fontWeight: 600, color: style.color }}
          >
            {stereo ? '' : formatDb(db, domain)}
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

/** Two upright level bars, Left and Right, like a mixing desk's master meters (beside the Main Fader). */
export function VerticalMeterPair({ dbL, dbR, height, domain = 'analog' }: { dbL: number; dbR: number; height: number; domain?: SignalDomain }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {([['L', dbL], ['R', dbR]] as const).map(([ch, db]) => (
        <div key={ch} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div
            className="relative overflow-hidden"
            style={{
              width: 12, height, borderRadius: 9999,
              background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border-soft)',
            }}
          >
            <motion.div
              className="absolute left-0 bottom-0 w-full"
              style={{ borderRadius: 9999, backgroundColor: isFinite(db) ? getHealthStyle(getHealth(db, domain)).color : 'transparent' }}
              animate={{ height: `${dbToPercent(db)}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
            {zoneTicks(domain).map(({ db: at, strong }) => (
              <div
                key={at}
                className="absolute left-0 w-full"
                style={{ bottom: `${dbToPercent(at)}%`, height: 2, background: strong ? 'var(--lsc-fg-muted)' : 'var(--lsc-border)' }}
              />
            ))}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1, color: 'var(--lsc-fg-muted)' }}>{ch}</span>
        </div>
      ))}
    </div>
  )
}
