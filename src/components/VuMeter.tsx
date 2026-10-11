import { useRef } from 'react'
import type { CSSProperties } from 'react'
import type { SideLevels } from '../signal/levels'
import { VU_LABELS, VU_MARKS, VU_ZERO_DBU, formatVu, vuSwing } from '../signal/levels'
import { useLiveMeter } from '../hooks/useLiveMeter'
import { StableText } from './controls/StableText'
import { paintStyle, readingOf, zoneTextColor } from './meterPaint'
import type { MeterAt, MeterSide } from './meterPaint'
import { DIAL_GAP, DIAL_H as H, DIAL_MAX_W, DIAL_W as W } from './vuLayout'

// A VU meter (D23 — a Recorder Track's, on an analog signal): a needle on a dial, as on a tape
// machine, one per side. It swings with the average over about 300 ms (the meters' RMS, D10) on a
// voltmeter's scale, −20 … +3 VU, 0 VU = +4 dBu (VU_ZERO_DBU), red from 0 up; while the chain plays
// the live loop turns it (useLiveMeter), otherwise it rests on the loop's average. Under each dial
// that average in VU, in the colour of its place on the scale.

// The dial in its viewBox (vuLayout.ts): the needle's pivot below its bottom edge, the scale on an
// arc above it
const PIVOT_X = W / 2
const PIVOT_Y = 116
/** The scale's radius; its numbers further out */
const R       = 88
const LABEL_R = 102
/** The scale's sweep, end to end (degrees) */
const SWEEP   = 90

/** The needle's angle at a swing (0 … 1): straight up halfway */
const angleOf = (swing: number) => (swing - 0.5) * SWEEP

/** Where a mark of `vu` sits along the scale (0 … 1) */
const swingOfVu = (vu: number) => vuSwing(vu + VU_ZERO_DBU)

/** A point `r` from the pivot, at `deg` from straight up. */
function pointAt(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180
  return { x: PIVOT_X + r * Math.sin(rad), y: PIVOT_Y - r * Math.cos(rad) }
}

/** The scale's arc between two swings. */
function arc(from: number, to: number) {
  const a = pointAt(angleOf(from), R)
  const b = pointAt(angleOf(to), R)
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}A${R} ${R} 0 0 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

const ZERO = swingOfVu(0)

/** One side's dial: its needle on the average `db` (dBu), turned while the chain plays. */
function Dial({ db, letter, source }: {
  db: number
  letter: string
  source: { nodeId: string; at: MeterAt; side: MeterSide }
}) {
  const box    = useRef<SVGSVGElement>(null)
  const needle = useRef<SVGGElement>(null)
  useLiveMeter(source.nodeId, box, (live, i) => {
    const r = readingOf(live, source.at, source.side, i)
    paintStyle(needle.current, 'transform', r ? `rotate(${angleOf(vuSwing(r.rms)).toFixed(1)}deg)` : null)
  })
  return (
    <svg
      ref={box} viewBox={`0 0 ${W} ${H}`} aria-hidden
      style={{
        width: '100%', display: 'block', borderRadius: 6,
        background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border-soft)',
        '--vu-angle': `${angleOf(vuSwing(db)).toFixed(1)}deg`,
      } as CSSProperties}
    >
      <path d={arc(0, ZERO)} fill="none" stroke="var(--lsc-fg-muted)" strokeWidth={1.5} />
      <path d={arc(ZERO, 1)} fill="none" stroke="var(--signal-clipping)" strokeWidth={4} />
      {VU_MARKS.map((vu) => {
        const deg = angleOf(swingOfVu(vu))
        const a = pointAt(deg, R)
        const b = pointAt(deg, R + (VU_LABELS.includes(vu) ? 8 : 5))
        return <line key={vu} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={vu > 0 ? 'var(--signal-clipping)' : 'var(--lsc-fg-muted)'} strokeWidth={1.5} />
      })}
      {VU_LABELS.map((vu) => {
        const p = pointAt(angleOf(swingOfVu(vu)), LABEL_R)
        return (
          <text
            key={vu} x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fontWeight={vu === 0 ? 700 : 400}
            fill={vu > 0 ? 'var(--signal-clipping-text)' : 'var(--lsc-fg-dim)'} style={{ fontFamily: 'var(--lsc-font-sans)' }}
          >
            {vu > 0 ? `+${vu}` : vu}
          </text>
        )
      })}
      <text x={PIVOT_X} y={H - 24} textAnchor="middle" fontSize={15} fontWeight={700} fill="var(--lsc-fg-muted)" style={{ fontFamily: 'var(--lsc-font-sans)' }}>VU</text>
      {letter && <text x={10} y={H - 8} fontSize={12} fontWeight={700} fill="var(--lsc-fg-muted)" style={{ fontFamily: 'var(--lsc-font-sans)' }}>{letter}</text>}
      <g ref={needle} className="lsc-vu-needle" style={{ transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px` }}>
        <line x1={PIVOT_X} y1={PIVOT_Y} x2={PIVOT_X} y2={PIVOT_Y - R - 6} stroke="var(--lsc-fg)" strokeWidth={1.5} strokeLinecap="round" />
      </g>
    </svg>
  )
}

/**
 * VU meters for a signal: one dial, or L and R side by side for a stereo one (`r`), each with its
 * average in VU under it; `at`: the card's signal they read, moving while the chain plays.
 */
export function VuMeter({ l, r, nodeId, at }: {
  l: SideLevels
  r?: SideLevels
  nodeId: string
  at: MeterAt
}) {
  const sides = r ? ([['L', l, 'l'], ['R', r, 'r']] as const) : ([['', l, 'l']] as const)
  return (
    <div style={{ display: 'flex', gap: DIAL_GAP, justifyContent: 'center', alignSelf: 'stretch' }}>
      {sides.map(([letter, side, which]) => (
        <div key={which} style={{ flex: `0 1 ${DIAL_MAX_W}px`, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Dial db={side.rms} letter={letter} source={{ nodeId, at, side: which }} />
          <span style={{ fontSize: 'var(--node-text-sm)', fontFamily: 'var(--lsc-font-mono)', fontWeight: 600, whiteSpace: 'nowrap', color: zoneTextColor(side.rms, 'analog', side.noise) }}>
            <StableText reserve={['-88.8']} align="end">{formatVu(side.rms)}</StableText> VU
          </span>
        </div>
      ))}
    </div>
  )
}
