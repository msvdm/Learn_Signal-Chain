import { useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { StableText } from '../controls/StableText'
import type { Transfer } from '../../signal/process'
import { throughCurve } from '../../signal/process'
import type { SideLevels, SignalDomain } from '../../signal/levels'
import { SILENCE_DB, ceilingOf } from '../../signal/levels'
import type { LiveStage } from '../../signal/moving'
import { readingAt } from '../../signal/moving'
import { useTranslation } from '../../i18n/useTranslation'
import { useLiveMeter } from '../../hooks/useLiveMeter'
import { useSignalStore } from '../../store/signalStore'
import { paintStyle } from '../meterPaint'
import { COLUMN_W } from '../../utils/twoColumns'

// Pieces of a dynamics card's controls (between its meters: MeterSides; layout: utils/twoColumns.ts):
// knobs, the transfer curve with the peaks, the average and the noise on it, the turning-down
// reading. While the chain plays (hooks/useLiveMeter.ts) the curve's Peaks and Average marks, the
// turning-down bar and the card's Open / Limiting word move with the sound.

/** A dynamics card's knobs (px): as big as the card's height allows, now its readings are gone. */
export const DYNAMICS_KNOB = 56
/** A dynamics card with only two knobs (Limiter, De-esser): they take the room the third would. */
export const DYNAMICS_KNOB_BIG = 72

/** Knobs one under the other, value and label beside each knob. */
export function KnobStack({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
}

/** Zoomed out a card shows its face: what is in its body need not move. */
const useBodyShown = () => !useSignalStore((s) => s.overview)

/** How far a card turns down at a moment of the loop (dB; null: it does not move). */
function reductionAt(live: LiveStage | undefined, i: number | null): number | null {
  const r = live?.reduction
  return r && i !== null ? Math.max(0, r.frames[i] + r.shift) : null
}

/**
 * How much the signal is being turned down: a bar across the column, growing from the right like a
 * desk's gain-reduction meter (it takes level away), then the label and the amount (over the loop).
 */
export function ReductionReadout({ nodeId, db, maxDb, label, style }: {
  /** Its card: the bar moves while the chain plays */
  nodeId: string
  db: number
  /** Full bar */
  maxDb: number
  label: string
  style?: CSSProperties
}) {
  const ref  = useRef<HTMLDivElement>(null)
  const fill = useRef<HTMLDivElement>(null)
  useLiveMeter(useBodyShown() ? nodeId : undefined, ref, (live, i) => {
    const gr = reductionAt(live, i)
    const f  = gr === null ? null : Math.round(Math.min(1, gr / maxDb) * 400) / 400
    paintStyle(fill.current, 'transform', f === null ? null : `translateX(${((1 - f) * 100).toFixed(2)}%)`)
  })
  return (
    <div style={style}>
      <div
        ref={ref}
        style={{ position: 'relative', height: 6, background: 'var(--lsc-sunken)', borderRadius: 9999, overflow: 'hidden', '--gr': Math.min(1, db / maxDb) } as CSSProperties}
      >
        <div ref={fill} className="lsc-meter-fill lsc-reduction-fill" />
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
// arrives (left to right) — sit where the card sends them (bottom to top): still, what leaves it
// over a loop of real sound, measured (decision D9); while the chain plays, the Peaks and Average
// marks move with the sound (its peak meter and its RMS), the Noise stays (it is what you hear
// when the music stops). One the card moves keeps a faint mark on the diagonal, where it would be
// untouched. A gate drops the noise when its threshold sits between the noise and the music; a
// Peaks mark above the curve got through before the Attack turned it down.

const GW = COLUMN_W - 2   // SVG width (px — drawn 1:1; with its border the box fills its column)
const GH = 160
const GP = 14    // padding inside the SVG
const STEPS = 100

/**
 * Both axes span this much, up to the clip level (+20 dBu) or the digital ceiling (0 dBFS): down to
 * −100 dBu, under a dynamics card's own noise (−95, after its curve — D18), so a gate's closing
 * shows as a drop to it.
 */
const RANGE_DB = 120
const GRID_STEP_DB = 20

/** A mark the card moves less than this off the diagonal (px) gets no faint copy */
const MOVED_PX = 2

type CurveReading = 'peak' | 'rms' | 'noise'
/** Drawn in this order: the average on top */
const MARKS: CurveReading[] = ['noise', 'peak', 'rms']
/** Named top-left, where no curve can reach (it never lifts a level by more than its makeup gain, +20 dB at most) */
const LEGEND: CurveReading[] = ['peak', 'rms', 'noise']

/** The mark of each reading: the peaks a triangle, the average a ring (the card's colour), the noise a grey dot. At (0, 0). */
function ReadingMark({ reading, color, opacity }: { reading: CurveReading; color: string; opacity?: number }) {
  if (reading === 'peak') return <path d="M 0 -4.5 L 4 2.5 L -4 2.5 Z" fill="var(--lsc-fg)" opacity={opacity} />
  if (reading === 'noise') return <circle r={3.2} fill="var(--lsc-fg-muted)" opacity={opacity} />
  return <circle r={4} fill="var(--lsc-node-bg)" stroke={color} strokeWidth="1.8" opacity={opacity} />
}

/** The word in the top right corner and the Average ring's look, at work (open, limiting) and not. */
export interface CurveState {
  on:  { text: string; color: string; opacity: number; ring: string; ringOpacity?: number }
  off: { text: string; color: string; opacity: number; ring: string; ringOpacity?: number }
  /** At work, over the loop (the still picture) */
  active: boolean
  /** At work at a moment of the loop, from how far it turns down then (dB) */
  activeAt: (reductionDb: number) => boolean
}

export function TransferCurve({
  nodeId, transfer, thresholdDb, signal, leaving: measured, domain, ceilingDb, state,
}: {
  /** Its card: the marks move while the chain plays */
  nodeId: string
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
  /** A card with a word for being at work (Open / Closed, Limiting / Pass); none: the ring in the accent colour */
  state?: CurveState
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
  const threshX = x(thresholdDb)
  const zeroX   = x(0)
  const halo = { stroke: 'var(--lsc-sunken)', strokeWidth: 3, paintOrder: 'stroke' } as const
  const ring = state ? (state.active ? state.on : state.off) : { ring: 'var(--lsc-accent)', ringOpacity: undefined }

  /** Where a mark sits: at (in, out), its faint copy at (in, in), the line between them. */
  const place = (inDb: number, outDb: number) => {
    const px = x(inDb), from = y(inDb), to = y(outDb)
    return { px, from, to, top: Math.min(from, to), len: Math.abs(to - from), moved: Math.abs(to - from) >= MOVED_PX ? 1 : 0 }
  }

  // The moving marks: what goes in and what leaves at this moment of the loop (each group's own
  // transform over its still place; the word for being at work, on the whole curve)
  const svg   = useRef<SVGSVGElement>(null)
  const parts = useRef<Record<string, SVGGElement | null>>({})
  useLiveMeter(useBodyShown() ? nodeId : undefined, svg, (live, i) => {
    const c  = live?.curve
    const at = c && i !== null ? { in: readingAt(c.in, i), out: readingAt(c.out, i) } : null
    const px = (v: number) => `${v.toFixed(1)}px`
    for (const k of ['peak', 'rms'] as const) {
      const p = at && isFinite(at.in[k]) ? place(at.in[k], at.out[k]) : null
      paintStyle(parts.current[`mark-${k}`], 'transform', p && `translate(${px(p.px)}, ${px(p.to)})`)
      paintStyle(parts.current[`copy-${k}`], 'transform', p && `translate(${px(p.px)}, ${px(p.from)})`)
      paintStyle(parts.current[`copy-${k}`], 'opacity', p && String(p.moved * 0.3))
      paintStyle(parts.current[`line-${k}`], 'transform', p && `translate(${px(p.px)}, ${px(p.top)}) scale(1, ${Math.max(p.len, 0.001).toFixed(1)})`)
      paintStyle(parts.current[`line-${k}`], 'opacity', p && String(p.moved))
    }
    const gr = reductionAt(live, i)
    paintStyle(svg.current, '--live-active', state && gr !== null ? (state.activeAt(gr) ? '1' : '0') : null)
  })
  const part = (name: string) => (el: SVGGElement | null) => { parts.current[name] = el }

  const marks = hasSignal ? MARKS.filter((k) => isFinite(signal[k])).map((k) => ({ k, ...place(signal[k], leaving[k]) })) : []
  const moving = (k: CurveReading) => k !== 'noise'
  /** A mark's group: placed by CSS from its still position, or the moving one (index.css .lsc-curve-at) */
  const at = (vars: Record<string, number>): CSSProperties => Object.fromEntries(Object.entries(vars).map(([k, v]) => [`--${k}`, v]))

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
      <svg
        ref={svg}
        viewBox={`0 0 ${GW} ${GH}`} width={GW} height={GH}
        style={{ display: 'block', '--active': state?.active ? 1 : 0 } as CSSProperties}
      >
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

        {/* Under the marks: its outline may hide the curve, never a mark (a clipping peak sits up here).
            At work and not, one over the other: the moment of the loop shows one */}
        {state && (['on', 'off'] as const).map((which) => (
          <text
            key={which}
            className={`lsc-curve-${which}`}
            x={GW - GP} y={GP + 8}
            fontSize="11" fontWeight="700"
            fill={state[which].color}
            textAnchor="end"
            style={{ textTransform: 'uppercase', letterSpacing: '0.06em', '--word': state[which].opacity } as CSSProperties}
            {...halo}
          >
            {state[which].text}
          </text>
        ))}
        {LEGEND.map((k, i) => (
          <g key={k} transform={`translate(${GP + 5} ${GP + 6 + i * 13})`}>
            <ReadingMark reading={k} color={ring.ring} />
            <text x={8} y={4} fontSize="11" fill="var(--lsc-fg-muted)" {...halo}>
              {t.meters.curve[k]}
            </text>
          </g>
        ))}

        {/* Where the card moves a reading from: a faint mark on the diagonal, a line to where it lands */}
        {marks.map((m) => (
          <g key={m.k}>
            <g
              ref={moving(m.k) ? part(`line-${m.k}`) : undefined}
              className="lsc-curve-line"
              style={at({ x: m.px, top: m.top, len: Math.max(m.len, 0.001), moved: m.moved })}
            >
              <line x1={0} y1={0} x2={0} y2={1} stroke="var(--lsc-fg-muted)" strokeWidth={1} opacity={0.6} vectorEffect="non-scaling-stroke" />
            </g>
            <g ref={moving(m.k) ? part(`copy-${m.k}`) : undefined} className="lsc-curve-copy" style={at({ x: m.px, y: m.from, moved: m.moved })}>
              <ReadingMark reading={m.k} color={ring.ring} />
            </g>
          </g>
        ))}
        {marks.map((m) => (
          <g key={m.k} ref={moving(m.k) ? part(`mark-${m.k}`) : undefined} className="lsc-curve-at" style={at({ x: m.px, y: m.to })}>
            {m.k === 'rms' && state ? (['on', 'off'] as const).map((which) => (
              <g key={which} className={`lsc-curve-${which}`} style={{ '--word': state[which].ringOpacity ?? 1 } as CSSProperties}>
                <ReadingMark reading="rms" color={state[which].ring} />
              </g>
            )) : <ReadingMark reading={m.k} color={ring.ring} opacity={m.k === 'rms' ? ring.ringOpacity : undefined} />}
          </g>
        ))}
      </svg>
    </div>
  )
}
