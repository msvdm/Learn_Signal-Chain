import type { CSSProperties, ReactNode } from 'react'
import { StableText } from '../controls/StableText'
import type { Transfer } from '../../signal/process'
import { throughCurve } from '../../signal/process'
import type { SideLevels, SignalDomain } from '../../signal/levels'
import { SILENCE_DB, ceilingOf } from '../../signal/levels'
import { useTranslation } from '../../i18n/useTranslation'
import { COLUMN_W } from '../../utils/twoColumns'

// Pieces of the two-column dynamics body (layout: utils/twoColumns.ts): knobs, the transfer curve
// with the peaks, the average and the noise on it, the turning-down reading

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
// below the threshold (noise gate). Three marks — the peaks, the average and the noise of what
// arrives (left to right) — sit where the card sends them (bottom to top): what leaves it over a loop
// of real sound, measured (decision D9); one the card moves keeps a faint mark on the
// diagonal, where it would be untouched. A gate drops the noise when its threshold sits between the
// noise and the music; a Peaks mark above the curve got through before the Attack turned it down.

const GW = COLUMN_W - 2   // SVG width (px — drawn 1:1; with its border the box fills its column)
const GH = 112
const GP = 14    // padding inside the SVG
const STEPS = 100

/**
 * Both axes span this much, up to the clip level (+20 dBu) or the digital ceiling (0 dBFS): down to
 * −100 dBu, 20 dB under the hiss every card adds (−80), so a gate's closing shows as a drop.
 */
const RANGE_DB = 120
const GRID_STEP_DB = 20

type CurveReading = 'peak' | 'rms' | 'noise'
/** Drawn in this order: the average on top */
const MARKS: CurveReading[] = ['noise', 'peak', 'rms']
/** Named top-left, where no curve can reach (it never lifts a level by more than its makeup gain, +20 dB at most) */
const LEGEND: CurveReading[] = ['peak', 'rms', 'noise']

/** The mark of each reading: the peaks a triangle, the average a ring (the card's colour), the noise a grey dot. */
function ReadingMark({ reading, x, y, color, opacity }: {
  reading: CurveReading
  x: number
  y: number
  color: string
  opacity?: number
}) {
  if (reading === 'peak') {
    return <path d={`M ${x} ${y - 4.5} L ${x + 4} ${y + 2.5} L ${x - 4} ${y + 2.5} Z`} fill="var(--lsc-fg)" opacity={opacity} />
  }
  if (reading === 'noise') return <circle cx={x} cy={y} r={3.2} fill="var(--lsc-fg-muted)" opacity={opacity} />
  return <circle cx={x} cy={y} r={4} fill="var(--lsc-node-bg)" stroke={color} strokeWidth="1.8" opacity={opacity} />
}

export function TransferCurve({
  transfer, thresholdDb, signal, leaving: measured, domain, ceilingDb, badge,
  pointColor = 'var(--lsc-accent)', pointOpacity,
}: {
  /** The card's curve: what leaves for each level in (signal/process.ts) */
  transfer: Transfer
  /** Where it starts to act (threshold, ceiling): a dashed upright line */
  thresholdDb: number
  /** What goes into the curve (curveInputOf in signal/engine.ts): its peaks, average and noise are the marks; none when silent */
  signal: SideLevels
  /** What leaves (the stage's curveOut, measured over time); bypassed, none: the marks go through the curve */
  leaving?: SideLevels
  /** Analog (dBu) or digital (dBFS), arriving: the axes end at its clip level / ceiling */
  domain: SignalDomain
  /** A limiter's flat top: a faint line from the threshold to the right edge */
  ceilingDb?: number
  /** A word in the top right corner (Open / Closed, Limiting / Pass) */
  badge?: { text: string; color: string; opacity: number }
  /** The average's ring */
  pointColor?: string
  pointOpacity?: number
}) {
  const { t } = useTranslation()
  const top    = ceilingOf(domain)
  const bottom = top - RANGE_DB
  const along  = (db: number) => (Math.max(bottom, Math.min(top, db)) - bottom) / RANGE_DB
  const x = (db: number) => GP + along(db) * (GW - GP * 2)
  const y = (db: number) => GH - GP - along(db) * (GH - GP * 2)

  const curve = Array.from({ length: STEPS + 1 }, (_, i) => {
    const inDb = bottom + (i / STEPS) * RANGE_DB
    return `${i === 0 ? 'M' : 'L'} ${x(inDb).toFixed(1)},${y(transfer(inDb).out).toFixed(1)}`
  }).join(' ')
  // 1:1: nothing changes
  const unity = `M ${x(bottom).toFixed(1)},${y(bottom).toFixed(1)} L ${x(top).toFixed(1)},${y(top).toFixed(1)}`
  const grid  = Array.from({ length: RANGE_DB / GRID_STEP_DB }, (_, i) => bottom + (i + 1) * GRID_STEP_DB)

  const leaving  = measured ?? throughCurve(transfer, signal)
  const hasSignal = isFinite(signal.rms) && signal.rms > SILENCE_DB
  const marks = hasSignal
    ? MARKS.filter((k) => isFinite(signal[k])).map((k) => {
        const px = x(signal[k])
        // Moved by the card: at least 2 px off the diagonal
        const from = y(signal[k])
        const to   = y(leaving[k])
        return { k, px, from, to, moved: Math.abs(to - from) >= 2 }
      })
    : []
  const threshX = x(thresholdDb)
  const zeroX   = x(0)
  const halo = { stroke: 'var(--lsc-sunken)', strokeWidth: 3, paintOrder: 'stroke' } as const

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
        <title>{t.meters.curve.tip}</title>
        <rect x={0} y={0} width={GW} height={GH} fill="var(--lsc-sunken)" />

        {grid.map((db) => (
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

        {/* Out: the 0 line — not when it is the top edge (digital), where the badge sits */}
        {top > 0 && <text x={GW - GP + 2} y={y(0) + 3} fontSize="11" fill="var(--lsc-fg-muted)">0</text>}
        <text x={GP} y={GH - 2} fontSize="11" fill="var(--lsc-fg-muted)" textAnchor="middle">{`−${-bottom}`}</text>
        {/* Under the 0 line, or ending at the right edge when 0 is the edge (digital) */}
        <text
          x={zeroX < GW - GP ? zeroX : GW - GP} y={GH - 2} fontSize="11" fill="var(--lsc-fg-muted)"
          textAnchor={zeroX < GW - GP ? 'middle' : 'end'}
        >
          {t.meters.axisIn}
        </text>

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

        {/* Under the marks: its outline may hide the curve, never a mark (a clipping peak sits up here) */}
        {badge && (
          <text
            x={GW - GP} y={GP + 8}
            fontSize="11" fontWeight="700"
            fill={badge.color}
            textAnchor="end"
            opacity={badge.opacity}
            style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
            {...halo}
          >
            {badge.text}
          </text>
        )}
        {LEGEND.map((k, i) => (
          <g key={k}>
            <ReadingMark reading={k} x={GP + 5} y={GP + 6 + i * 13} color={pointColor} />
            <text x={GP + 13} y={GP + 10 + i * 13} fontSize="11" fill="var(--lsc-fg-muted)" {...halo}>
              {t.meters.curve[k]}
            </text>
          </g>
        ))}

        {/* Where the card moves a reading from: a faint mark on the diagonal, a line to where it lands */}
        {marks.filter((m) => m.moved).map((m) => (
          <g key={m.k}>
            <line x1={m.px} y1={m.from} x2={m.px} y2={m.to} stroke="var(--lsc-fg-muted)" strokeWidth={1} opacity={0.6} />
            <ReadingMark reading={m.k} x={m.px} y={m.from} color={pointColor} opacity={0.3} />
          </g>
        ))}
        {marks.map((m) => (
          <ReadingMark key={m.k} reading={m.k} x={m.px} y={m.to} color={pointColor} opacity={m.k === 'rms' ? pointOpacity : undefined} />
        ))}
      </svg>
    </div>
  )
}
