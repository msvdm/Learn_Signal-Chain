import type { CSSProperties, ReactNode } from 'react'
import { StableText } from '../controls/StableText'
import type { Transfer } from '../../signal/process'
import { useTranslation } from '../../i18n/useTranslation'

// Pieces of the two-column dynamics body (layout: utils/twoColumns.ts): knobs, the transfer curve,
// the turning-down reading

/** Knobs one under the other, value and label beside each knob. */
export function KnobStack({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
}

/** How much the signal is being turned down: a bar across the column, then the label and the amount. */
export function ReductionReadout({ db, maxDb, label, style }: {
  db: number
  /** Full bar */
  maxDb: number
  label: string
  style?: CSSProperties
}) {
  return (
    <div style={style}>
      <div style={{ height: 6, background: 'var(--lsc-sunken)', borderRadius: 9999, overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.min(100, (db / maxDb) * 100)}%`,
            height: '100%',
            background: 'var(--signal-hot)',
            borderRadius: 3,
            transition: 'width 0.1s ease-out',
          }}
        />
      </div>
      <div
        style={{
          marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
          fontSize: 'var(--node-text-xs)', lineHeight: '20px',
        }}
      >
        <span style={{ color: 'var(--lsc-fg-muted)' }}>{label}</span>
        <StableText reserve={['−00.0 dB']} align="end" style={{ fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-fg)' }}>
          {db > 0 ? `−${db.toFixed(1)} dB` : '0.0 dB'}
        </StableText>
      </div>
    </div>
  )
}

// ── Transfer curve ───────────────────────────────────────────────────────────
// X = level in, Y = level out. The grey dashed diagonal is 1:1 (nothing changes); where the curve
// leaves it, the card is at work: a shallower slope (compressor), a flat top (limiter), a drop
// below the threshold (noise gate). The dot is where the signal is right now.

const GW = 168   // SVG width (px — drawn 1:1; with its border the box fills the 170px column)
const GH = 112
const GP = 14    // padding inside the SVG
const STEPS = 80

const IN_MIN  = -60
const IN_MAX  = 0
const OUT_MIN = -60
const GRID_DBS = [-48, -36, -24, -12, 0]

export function TransferCurve({
  transfer, thresholdDb, inputDb, outMaxDb = 0, ceilingDb, badge,
  pointColor = 'var(--lsc-accent)', pointOpacity,
}: {
  /** The card's curve: what leaves for each level in (signal/process.ts) */
  transfer: Transfer
  /** Where it starts to act (threshold, ceiling): a dashed upright line */
  thresholdDb: number
  /** What arrives (the louder side): the dot on the curve, none when silent */
  inputDb: number
  /** Top of the output axis — room above 0 for makeup gain */
  outMaxDb?: number
  /** A limiter's flat top: a faint line from the threshold to the right edge */
  ceilingDb?: number
  /** A word in the top right corner (Open / Closed, Limiting / Pass) */
  badge?: { text: string; color: string; opacity: number }
  pointColor?: string
  pointOpacity?: number
}) {
  const { t } = useTranslation()
  const x = (db: number) => GP + ((db - IN_MIN) / (IN_MAX - IN_MIN)) * (GW - GP * 2)
  const y = (db: number) => {
    const clamped = Math.max(OUT_MIN, Math.min(outMaxDb, db))
    return GH - GP - ((clamped - OUT_MIN) / (outMaxDb - OUT_MIN)) * (GH - GP * 2)
  }

  const curve = Array.from({ length: STEPS + 1 }, (_, i) => {
    const inDb = IN_MIN + (i / STEPS) * (IN_MAX - IN_MIN)
    return `${i === 0 ? 'M' : 'L'} ${x(inDb).toFixed(1)},${y(transfer(inDb).out).toFixed(1)}`
  }).join(' ')
  // 1:1: nothing changes
  const unity = `M ${x(IN_MIN).toFixed(1)},${y(IN_MIN).toFixed(1)} L ${x(IN_MAX).toFixed(1)},${y(IN_MAX).toFixed(1)}`

  const hasSignal = isFinite(inputDb) && inputDb > IN_MIN
  const opX       = x(Math.max(IN_MIN, Math.min(IN_MAX, inputDb)))
  const opY       = y(transfer(inputDb).out)
  const threshX   = x(thresholdDb)

  return (
    <div
      className="nodrag"
      style={{
        background: 'var(--lsc-sunken)',
        border: '1px solid var(--lsc-border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <svg viewBox={`0 0 ${GW} ${GH}`} width={GW} height={GH} style={{ display: 'block' }}>
        <rect x={0} y={0} width={GW} height={GH} fill="var(--lsc-sunken)" />

        {GRID_DBS.map((db) => (
          <g key={db}>
            <line
              x1={x(db)} y1={GP} x2={x(db)} y2={GH - GP}
              stroke="var(--lsc-border)" strokeWidth={db === 0 ? 1.2 : 0.8} strokeDasharray={db === 0 ? '' : '2 3'}
            />
            <line
              x1={GP} y1={y(db)} x2={GW - GP} y2={y(db)}
              stroke="var(--lsc-border)" strokeWidth={db === 0 ? 1.2 : 0.8} strokeDasharray={db === 0 ? '' : '2 3'}
            />
          </g>
        ))}

        <text x={GW - GP + 2} y={y(0) + 3} fontSize="11" fill="var(--lsc-fg-muted)">0</text>
        <text x={GP} y={GH - 2} fontSize="11" fill="var(--lsc-fg-muted)" textAnchor="middle">−60</text>
        <text x={GW - GP} y={GH - 2} fontSize="11" fill="var(--lsc-fg-muted)" textAnchor="end">{t.meters.axisIn}</text>

        <line
          x1={threshX} y1={GP} x2={threshX} y2={GH - GP}
          stroke="var(--signal-hot)" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="3 2"
        />
        {ceilingDb !== undefined && (
          <line
            x1={threshX} y1={y(ceilingDb)} x2={GW - GP} y2={y(ceilingDb)}
            stroke="var(--signal-hot)" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2 3"
          />
        )}

        <path d={unity} fill="none" stroke="var(--lsc-fg)" strokeWidth={1} strokeDasharray="3 3" opacity="0.3" />
        <path d={curve} fill="none" stroke="var(--lsc-accent)" strokeWidth={2} strokeLinecap="round" />

        {hasSignal && (
          <>
            <line x1={opX} y1={GP} x2={opX} y2={opY - 5}
              stroke="var(--signal-too-quiet)" strokeOpacity={0.5} strokeWidth={1} />
            <circle cx={opX} cy={opY} r={4}
              fill="var(--lsc-node-bg)" stroke={pointColor} strokeWidth="1.8" opacity={pointOpacity} />
          </>
        )}

        {badge && (
          <text
            x={GW - GP} y={GP + 8}
            fontSize="11" fontWeight="700"
            fill={badge.color}
            textAnchor="end"
            opacity={badge.opacity}
            style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            {badge.text}
          </text>
        )}
      </svg>
    </div>
  )
}
