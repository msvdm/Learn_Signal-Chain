import { Fragment, useRef, useEffect, useId } from 'react'
import { StableText } from './StableText'
import { widestFormat } from '../../utils/readout'
import { useLatestRef } from '../../hooks/useLatestRef'
import type { FaderMark } from '../../utils/faderTaper'

const DEFAULT_MARKS = [
  { db: 10,  label: '+10' },
  { db: 0,   label:  '0'  },
  { db: -10, label: '-10' },
  { db: -20, label: '-20' },
  { db: -40, label: '-40' },
  { db: -60, label: '-60' },
  { db: -80, label: '−∞'  },
]

/** A non-even scale: where a value sits along the travel (0 = bottom, 1 = top) and back. */
export interface FaderTaper {
  toPosition: (value: number) => number
  /** The value at a point of the travel, already rounded to a step */
  fromPosition: (position: number) => number
}

// Layout (px, at scale 1), like a desk's fader print:
// numbers on the left | ticks · track · ticks (the cap slides over the ticks)
const LABEL_W    = 22     // numbers, right-aligned
const LABEL_GAP  = 2
// The cap: a tall solid block, like a desk fader's (the white line across it marks the value)
const CAP_W      = 25
const CAP_H      = 34
const AREA_W     = LABEL_W + LABEL_GAP + CAP_W + 2
const TRACK_CX   = LABEL_W + LABEL_GAP + CAP_W / 2   // track centre
const TRACK_W    = 6
const TICK_IN    = TRACK_W / 2 + 1.5                 // ticks start this far from the track centre
const TICK_MAJOR = 6
const TICK_MINOR = 3.5
const DOT_R      = 0.75                              // dots of the high-resolution zone
const MARK_FONT  = 8

interface VerticalFaderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  formatValue?: (v: number) => string
  /** Scale marks: numbered, short ticks (no label) or dots (the high-resolution zone) */
  marks?: FaderMark[]
  height?: number
  /** Word shown under the readout at 0 dB. */
  unityLabel?: string
  /** Draw everything this many times bigger (the free-standing fader). Height is set separately. */
  scale?: number
  /** false = no value readout beside the fader; the caller shows it. */
  showReadout?: boolean
  /** Uneven scale (a desk fader's); default: even from min to max in `step`s */
  taper?: FaderTaper
  /** Cap colour: black, or red for the Main Fader (like a desk's master fader) */
  capColor?: 'black' | 'red'
}

export function VerticalFader({
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  marks = DEFAULT_MARKS,
  height = 120,
  unityLabel = 'unity',
  scale = 1,
  showReadout = true,
  taper,
  capColor = 'black',
}: VerticalFaderProps) {
  const k         = scale
  const trackCx   = TRACK_CX * k
  const trackW    = TRACK_W * k
  const capW      = CAP_W * k
  const capH      = CAP_H * k
  const capLeft   = trackCx - capW / 2                  // centres cap on track
  const line      = Math.max(1, Math.round(k * 0.75))   // tick thickness
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging   = useRef(false)
  // Grabbing the cap keeps the spot you hold under the pointer (no jump): pointer − cap centre
  const grabOffset   = useRef(0)
  const valueRef     = useLatestRef(value)

  const positionOf = (v: number) => taper ? taper.toPosition(v) : (v - min) / (max - min)
  const valueAt    = (fraction: number) => {
    if (taper) return taper.fromPosition(fraction)
    const stepped = Math.round((min + fraction * (max - min)) / step) * step
    return Math.max(min, Math.min(max, stepped))
  }

  const pct          = positionOf(value) * 100
  const format       = formatValue ?? ((v: number) => `${v >= 0 ? '+' : ''}${v} dB`)
  const displayValue = format(value)

  function computeFromPointer(clientY: number): number {
    if (!containerRef.current) return valueRef.current
    const rect = containerRef.current.getBoundingClientRect()
    const relY = Math.max(0, Math.min(rect.height, clientY - grabOffset.current - rect.top))
    return valueAt(1 - relY / rect.height)
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => { if (isDragging.current) onChange(computeFromPointer(e.clientY)) }
    const onUp   = () => { isDragging.current = false }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, step, onChange])

  function handlePointerDown(e: React.PointerEvent) {
    // Only the main button moves the fader: a right-click opens the element's menu instead
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    isDragging.current = true
    // On the cap: drag it from where it is held. On the track: the cap jumps there.
    const rect     = e.currentTarget.getBoundingClientRect()
    const capY     = rect.top + (1 - positionOf(valueRef.current)) * rect.height
    const capHalf  = (capH / 2) * (rect.height / height)
    const onCap    = Math.abs(e.clientY - capY) <= capHalf
    grabOffset.current = onCap ? e.clientY - capY : 0
    if (!onCap) onChange(computeFromPointer(e.clientY))
  }

  return (
    <div className="nodrag nopan" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>

      {/* Draggable fader area */}
      <div
        ref={containerRef}
        style={{ position: 'relative', width: AREA_W * k, height, touchAction: 'none', cursor: 'ns-resize', flexShrink: 0 }}
        onPointerDown={handlePointerDown}
      >
        {/* Track groove */}
        <div style={{
          position: 'absolute', left: trackCx - trackW / 2, top: 0, bottom: 0, width: trackW,
          borderRadius: 4 * k,
          background: 'var(--lsc-sunken)',
          border: '1px solid var(--lsc-border)',
          pointerEvents: 'none',
        }} />

        {/* Scale: numbers on the left, ticks on both sides of the track, dots around unity */}
        {marks.filter((m) => m.db >= min && m.db <= max).map(({ db, label, dot }) => {
          const top     = `${100 - positionOf(db) * 100}%`
          const isUnity = db === 0
          const color   = isUnity ? 'var(--signal-good)' : label ? 'var(--lsc-fg-dim)' : 'var(--lsc-border)'
          if (dot) {
            // Two dots each side: the fine-control zone around unity, one row per dB
            return [-1, 1].flatMap((side) => [TICK_IN + 1.5, TICK_IN + 4.5].map((x) => (
              <span
                key={`${db}:${side}:${x}`}
                style={{
                  position: 'absolute', top, left: trackCx + side * x * k - DOT_R * k,
                  width: DOT_R * 2 * k, height: DOT_R * 2 * k, marginTop: -DOT_R * k,
                  borderRadius: 9999, background: 'var(--lsc-fg-dim)', pointerEvents: 'none',
                }}
              />
            )))
          }
          const len = (label ? TICK_MAJOR : TICK_MINOR) * k
          return (
            <Fragment key={db}>
              {[-1, 1].map((side) => (
                <div
                  key={side}
                  style={{
                    position: 'absolute', top, marginTop: -line / 2, height: line, width: len,
                    left: side < 0 ? trackCx - TICK_IN * k - len : trackCx + TICK_IN * k,
                    background: color, pointerEvents: 'none',
                  }}
                />
              ))}
              {label && <span style={{
                position: 'absolute', top, right: (AREA_W - LABEL_W) * k,
                transform: 'translateY(-50%)',
                fontSize: MARK_FONT * k, fontFamily: 'var(--lsc-font-mono)', fontWeight: 600, lineHeight: 1,
                color: isUnity ? 'var(--signal-good)' : 'var(--lsc-fg-muted)',
                pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
              }}>
                {label}
              </span>}
            </Fragment>
          )
        })}

        {/* Fader cap — its white line sits on the value */}
        <FaderCap
          color={capColor}
          style={{
            position: 'absolute',
            left: capLeft, width: capW, height: capH,
            top: `${100 - pct}%`, marginTop: -(capH / 2),
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Value readout */}
      {showReadout && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 52 }}>
        <StableText
          reserve={[widestFormat(min, max, step, format)]}
          align="center"
          style={{ fontSize: 14, fontFamily: 'var(--lsc-font-mono)', fontWeight: 700, color: 'var(--lsc-fg)' }}
        >
          {displayValue}
        </StableText>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--signal-good)', visibility: value === 0 ? 'visible' : 'hidden' }}>
          {unityLabel}
        </span>
      </div>}
    </div>
  )
}

// Solid cap colours: a lit top edge, the body, the dark underside, and the ridge across the middle
const CAP_COLORS = {
  black: { hi: '#5d6066', base: '#25262a', lo: '#09090b', ridge: '#3d3f45' },
  red:   { hi: '#f36b62', base: '#c62828', lo: '#7a1212', ridge: '#e2463d' },
}

/** A desk fader's cap: sloped upper face, a ridge with a white line across the middle, sloped lower face. */
function FaderCap({ color, style }: { color: 'black' | 'red'; style: React.CSSProperties }) {
  const id = useId()
  const c  = CAP_COLORS[color]
  return (
    <svg
      viewBox="0 0 60 80"
      preserveAspectRatio="none"
      style={{ ...style, overflow: 'visible', filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.35))' }}
    >
      <defs>
        <linearGradient id={`${id}-upper`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.hi} />
          <stop offset="1" stopColor={c.base} />
        </linearGradient>
        <linearGradient id={`${id}-lower`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.base} />
          <stop offset="1" stopColor={c.lo} />
        </linearGradient>
      </defs>
      {/* Body */}
      <rect x="0" y="0" width="60" height="80" rx="6" fill={c.base} stroke="var(--lsc-fader-cap-rim)" strokeWidth="1.2" />
      {/* Upper face, rising towards the top edge */}
      <path d="M2,8 Q30,1 58,8 L58,35 L2,35 Z" fill={`url(#${id}-upper)`} />
      {/* Ridge across the middle, catching the light */}
      <rect x="1" y="35" width="58" height="10" fill={c.ridge} />
      {/* The value line */}
      <rect x="8" y="38.5" width="44" height="3" rx="1.5" fill="#f4f4f4" />
      {/* Lower face, falling away into shadow */}
      <path d="M2,45 L58,45 L58,72 Q30,79 2,72 Z" fill={`url(#${id}-lower)`} />
    </svg>
  )
}
