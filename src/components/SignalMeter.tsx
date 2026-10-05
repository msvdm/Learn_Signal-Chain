import { motion } from 'framer-motion'
import { useTranslation } from '../i18n/useTranslation'
import { healthColor, dbToPercent, formatDb, getHealth, UNITY_DBU, ALIGNMENT_DB } from '../signal/levels'
import type { SideLevels, SignalHealth, SignalDomain } from '../signal/levels'
import { useReadingsShown } from '../hooks/useReadingsShown'
import { StableText } from './controls/StableText'
import { LEVEL_SAMPLE } from '../utils/readout'

// The meters. The bar is the average; from Intermediate up (useReadingsShown) a thin mark in the
// bar's colour shows the peaks — the loudest moments — and a grey fog from the quiet end shows the
// noise, once it is loud enough to reach the scale (−60 dBu). Beginner sees the bar alone.

interface SignalMeterProps {
  /** The signal, or its left side when `r` is set */
  l: SideLevels
  /** Right side. When set, the meter shows two bars: L and R. */
  r?: SideLevels
  health: SignalHealth
  label?: string
  showValue?: boolean
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

const SPRING = { type: 'spring', stiffness: 300, damping: 30 } as const
/** Thickness of an upright meter's peak mark (px) */
const PEAK_MARK = 3

/** On the scale: louder than its quiet end (−60). */
const onScale = (db: number | undefined): db is number => db !== undefined && dbToPercent(db) > 0

/**
 * One level bar on the −60…+20 dB scale, with tick marks at the zone edges. `height` includes the
 * border. `peak` draws the peak mark, `noise` the fog (leave them out: the bar alone).
 */
export function MeterBar({ db, color, height = 6, domain = 'analog', peak, noise }: {
  db: number
  color: string
  height?: number
  domain?: SignalDomain
  peak?: number
  noise?: number
}) {
  // Ticks widen with a tall bar (the overview meter), so they stay visible zoomed out
  const tick = Math.max(1, Math.round(height / 8))
  const mark = tick * 3
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height, borderRadius: 9999, background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border-soft)' }}
    >
      <motion.div
        className="absolute left-0 top-0 h-full"
        style={{ backgroundColor: color, borderRadius: 9999 }}
        animate={{ width: `${dbToPercent(db)}%` }}
        transition={SPRING}
      />
      {onScale(noise) && (
        <motion.div
          aria-hidden
          className="absolute left-0 top-0 h-full"
          style={{ background: 'linear-gradient(to right, var(--lsc-noise-fog) 75%, transparent)' }}
          initial={false}
          animate={{ width: `${dbToPercent(noise)}%` }}
          transition={SPRING}
        />
      )}
      {zoneTicks(domain).map(({ db: at, strong }) => (
        <div
          key={at}
          className="absolute top-0 h-full"
          style={{ width: tick, left: `${dbToPercent(at)}%`, background: strong ? 'var(--lsc-fg-muted)' : 'var(--lsc-border)' }}
        />
      ))}
      {onScale(peak) && (
        // Centred on the peak, inside the bar at both ends: the track is inset by half the mark
        <div className="absolute top-0 h-full" style={{ left: mark / 2, right: mark / 2 }}>
          <motion.div
            aria-hidden
            className="absolute top-0 h-full"
            style={{ width: mark, marginLeft: -mark / 2, background: color }}
            initial={false}
            animate={{ left: `${dbToPercent(peak)}%` }}
            transition={SPRING}
          />
        </div>
      )}
    </div>
  )
}

/** One labelled channel bar (L or R) with its level (the average), coloured by its own health (clipping from its peaks). */
export function ChannelRow({ ch, side, domain = 'analog' }: { ch: string; side: SideLevels; domain?: SignalDomain }) {
  const detailed = useReadingsShown()
  const db       = side.rms
  const color    = isFinite(db) ? healthColor(getHealth(db, domain, side.peak)) : 'var(--lsc-border)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ fontWeight: 700, width: 10, color: 'var(--lsc-fg-muted)' }}>{ch}</span>
      <div style={{ flex: 1 }}>
        <MeterBar
          db={db} color={color} domain={domain}
          peak={detailed ? side.peak : undefined} noise={detailed ? side.noise : undefined}
        />
      </div>
      <StableText reserve={[LEVEL_SAMPLE]} align="end" style={{ fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-fg-muted)' }}>
        {isFinite(db) ? db.toFixed(1) : '−∞'}
      </StableText>
    </div>
  )
}

export function SignalMeter({ l, r, health, label, showValue = true, domain = 'analog' }: SignalMeterProps) {
  const color    = healthColor(health)
  const { t }    = useTranslation()
  const detailed = useReadingsShown()

  return (
    <div className="flex flex-col" style={{ gap: 4 }}>
      {label && (
        <span style={{ fontSize: 'var(--node-text-sm)', color: 'var(--lsc-fg-muted)' }}>
          {label}
        </span>
      )}
      {r ? (
        <>
          <ChannelRow ch="L" side={l} domain={domain} />
          <ChannelRow ch="R" side={r} domain={domain} />
        </>
      ) : (
        <MeterBar
          db={l.rms} color={color} domain={domain}
          peak={detailed ? l.peak : undefined} noise={detailed ? l.noise : undefined}
        />
      )}
      {showValue && (
        <div className="flex items-center justify-between" style={{ gap: 8 }}>
          {/* In stereo each bar shows its own level, so only the health word stays here */}
          <StableText
            reserve={[domain === 'digital' ? '+00.0 dBFS' : '+00.0 dBu']}
            style={{ fontSize: 'var(--node-text-sm)', fontFamily: 'var(--lsc-font-mono)', fontWeight: 600, color }}
          >
            {r ? '' : formatDb(l.rms, domain)}
          </StableText>
          <StableText
            reserve={Object.values(t.health)}
            align="end"
            style={{ fontSize: 'var(--node-text-sm)', fontWeight: 600, color }}
          >
            {t.health[health]}
          </StableText>
        </div>
      )}
    </div>
  )
}

/**
 * Two upright level bars, Left and Right, like a mixing desk's master meters (beside the Main
 * Fader). Each coloured by its own health (clipping from its peaks); from Intermediate up with its
 * peak mark and the noise rising from the bottom.
 */
export function VerticalMeterPair({ l, r, height, domain = 'analog' }: { l: SideLevels; r: SideLevels; height: number; domain?: SignalDomain }) {
  const detailed = useReadingsShown()
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {([['L', l], ['R', r]] as const).map(([ch, side]) => {
        const color = isFinite(side.rms) ? healthColor(getHealth(side.rms, domain, side.peak)) : 'transparent'
        return (
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
                style={{ borderRadius: 9999, backgroundColor: color }}
                animate={{ height: `${dbToPercent(side.rms)}%` }}
                transition={SPRING}
              />
              {detailed && onScale(side.noise) && (
                <motion.div
                  aria-hidden
                  className="absolute left-0 bottom-0 w-full"
                  style={{ background: 'linear-gradient(to top, var(--lsc-noise-fog) 75%, transparent)' }}
                  initial={false}
                  animate={{ height: `${dbToPercent(side.noise)}%` }}
                  transition={SPRING}
                />
              )}
              {zoneTicks(domain).map(({ db: at, strong }) => (
                <div
                  key={at}
                  className="absolute left-0 w-full"
                  style={{ bottom: `${dbToPercent(at)}%`, height: 2, background: strong ? 'var(--lsc-fg-muted)' : 'var(--lsc-border)' }}
                />
              ))}
              {detailed && onScale(side.peak) && (
                <div className="absolute left-0 w-full" style={{ top: PEAK_MARK / 2, bottom: PEAK_MARK / 2 }}>
                  <motion.div
                    aria-hidden
                    className="absolute left-0 w-full"
                    style={{ height: PEAK_MARK, marginBottom: -PEAK_MARK / 2, background: color }}
                    initial={false}
                    animate={{ bottom: `${dbToPercent(side.peak)}%` }}
                    transition={SPRING}
                  />
                </div>
              )}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1, color: 'var(--lsc-fg-muted)' }}>{ch}</span>
          </div>
        )
      })}
    </div>
  )
}
