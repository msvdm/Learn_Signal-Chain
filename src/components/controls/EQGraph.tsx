import { useRef, useState } from 'react'
import { takePress, usePointerDrag } from '../../hooks/usePointerDrag'
import type { EQBand } from '../../data/nodeRegistry'
import {
  FREQ_MIN, FREQ_MAX, DB_MIN, DB_MAX, Q_MIN, Q_MAX,
  bandGain, isShelf, formatFreq, formatGain,
} from '../../signal/eqMath'

export interface GraphBand {
  band: EQBand
  name: string
  color: string
  /** Frequencies the dot can be dragged across. Omitted = fixed frequency (drag up / down only). */
  freqRange?: [number, number]
}

interface EQGraphProps {
  bands: GraphBand[]
  onBandChange: (index: number, patch: Partial<EQBand>) => void
  /** Drawn at exactly this size in px, so the graph is never stretched or squashed. */
  width: number
  height: number
  /** Scrolling over a bell band's dot changes its width (Q). */
  adjustableWidth?: boolean
}

// Plot area inside the SVG: dB labels on the left, frequency labels underneath
const PAD_L = 34
const PAD_R = 10
const PAD_T = 10
const PAD_B = 20
/** The plot spans ±15 dB so a dot at ±12 dB stays fully visible. */
const VIEW_DB = 15
const DOT_R   = 8
const GRID_DB = [12, 6, 0, -6, -12]
const GRID_FREQ: Array<[number, string]> = [
  [50, '50'], [100, '100'], [200, '200'], [500, '500'],
  [1000, '1k'], [2000, '2k'], [5000, '5k'], [10000, '10k'],
]
const DOUBLE_CLICK_MS = 350
/** Scroll distance (px) for one width step — a mouse-wheel notch is ~100 px. */
const WHEEL_STEP = 50

const LOG_MIN  = Math.log10(FREQ_MIN)
const LOG_SPAN = Math.log10(FREQ_MAX) - LOG_MIN

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function dbLabel(db: number): string {
  if (db === 0) return '0 dB'
  return db > 0 ? `+${db}` : `−${-db}`
}

/**
 * Interactive EQ curve. Left → right is low → high frequencies, up = boost, down = cut.
 * Every band is a coloured dot: drag it to move the band, double-click it to go back to 0 dB
 * and — with `adjustableWidth` — scroll over it to make a bell band wider or narrower.
 */
export function EQGraph({ bands, onBandChange, width, height, adjustableWidth = false }: EQGraphProps) {
  const svgRef   = useRef<SVGSVGElement>(null)
  const lastDown = useRef({ index: -1, time: 0 })  // double-click detection
  const wheelAcc = useRef(0)
  const [dragging, setDragging] = useState<number | null>(null)
  const [hovered, setHovered]   = useState<number | null>(null)

  const plotW = width - PAD_L - PAD_R
  const plotH = height - PAD_T - PAD_B
  const fx = (f: number) => PAD_L + ((Math.log10(f) - LOG_MIN) / LOG_SPAN) * plotW
  const xf = (x: number) => 10 ** (LOG_MIN + ((x - PAD_L) / plotW) * LOG_SPAN)
  const dy = (db: number) => PAD_T + ((VIEW_DB - clamp(db, -VIEW_DB, VIEW_DB)) / (2 * VIEW_DB)) * plotH
  const yd = (y: number) => VIEW_DB - ((y - PAD_T) / plotH) * 2 * VIEW_DB
  const zeroY = dy(0)

  // One sample every 2 px, evenly spaced on the (logarithmic) frequency axis
  const steps = Math.round(plotW / 2)
  const freqs = Array.from({ length: steps + 1 }, (_, i) => 10 ** (LOG_MIN + (i / steps) * LOG_SPAN))
  const curve = (gainAt: (f: number) => number) =>
    freqs.map((f, i) => `${i ? 'L' : 'M'}${fx(f).toFixed(1)},${dy(gainAt(f)).toFixed(1)}`).join(' ')
  const area = (gainAt: (f: number) => number) =>
    `${curve(gainAt)} L${fx(FREQ_MAX)},${zeroY} L${fx(FREQ_MIN)},${zeroY} Z`

  /** Pointer position in SVG px — correct at any canvas zoom. */
  function toSvg(e: { clientX: number; clientY: number }) {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (width / rect.width),
      y: (e.clientY - rect.top) * (height / rect.height),
    }
  }

  // A dot follows the pointer, held where it was grabbed (grabX / grabY: dot centre − pointer)
  const drag = usePointerDrag<{ index: number; grabX: number; grabY: number }>((e, { index, grabX, grabY }) => {
    const { band, freqRange } = bands[index]
    const p = toSvg(e)
    const gainDb = Math.round(clamp(yd(p.y + grabY), DB_MIN, DB_MAX) * 2) / 2
    const freqHz = freqRange
      ? Math.round(clamp(xf(p.x + grabX), freqRange[0], freqRange[1]))
      : band.freqHz
    if (gainDb !== band.gainDb || freqHz !== band.freqHz) onBandChange(index, { gainDb, freqHz })
  }, () => setDragging(null))

  function onDotDown(i: number, e: React.PointerEvent) {
    if (!takePress(e)) return
    const { band } = bands[i]
    // Second press on the same dot in quick succession = double-click → back to 0 dB
    if (lastDown.current.index === i && e.timeStamp - lastDown.current.time < DOUBLE_CLICK_MS) {
      lastDown.current = { index: -1, time: 0 }
      if (band.gainDb !== 0) onBandChange(i, { gainDb: 0 })
      return
    }
    lastDown.current = { index: i, time: e.timeStamp }
    const p = toSvg(e)
    drag.start({ index: i, grabX: fx(band.freqHz) - p.x, grabY: dy(band.gainDb) - p.y })
    setDragging(i)
  }

  function onDotWheel(i: number, e: React.WheelEvent) {
    const { band } = bands[i]
    if (!adjustableWidth || isShelf(band)) return
    // Firefox reports mouse-wheel notches in lines
    wheelAcc.current += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
    if (Math.abs(wheelAcc.current) < WHEEL_STEP) return
    const narrower = wheelAcc.current < 0  // scroll up = higher Q = narrower band
    wheelAcc.current = 0
    const q    = band.Q ?? 1.4
    const next = narrower ? Math.max(q + 0.1, q * 1.15) : Math.min(q - 0.1, q / 1.15)
    onBandChange(i, { Q: clamp(Math.round(next * 10) / 10, Q_MIN, Q_MAX) })
  }

  const active   = dragging ?? hovered
  // The dot being handled is drawn last, so it sits on top of the others
  const drawOrder = bands.map((_, i) => i).filter((i) => i !== active)
  if (active !== null) drawOrder.push(active)

  const readout = active !== null ? bands[active] : null
  let readoutStyle: React.CSSProperties = {}
  if (readout) {
    const x = fx(readout.band.freqHz)
    const y = dy(readout.band.gainDb)
    const below = y < 44  // no room above a dot near the top edge
    const alignX = x < width * 0.25 ? '-12px' : x > width * 0.75 ? 'calc(-100% + 12px)' : '-50%'
    readoutStyle = {
      left: x,
      top: below ? y + DOT_R + 8 : y - DOT_R - 8,
      transform: `translate(${alignX}, ${below ? '0' : '-100%'})`,
    }
  }

  return (
    <div className="nodrag nopan" style={{ position: 'relative', width, height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', touchAction: 'none', userSelect: 'none' }}
      >
        <rect
          x={0.5} y={0.5} width={width - 1} height={height - 1} rx={8}
          fill="var(--lsc-sunken)" stroke="var(--lsc-border)"
        />

        {/* Grid + axis labels */}
        <g fontFamily="var(--lsc-font-sans)" fontSize={11} fill="var(--lsc-fg-dim)">
          {GRID_FREQ.map(([f, label]) => (
            <g key={f}>
              <line x1={fx(f)} y1={PAD_T} x2={fx(f)} y2={PAD_T + plotH} stroke="var(--lsc-border)" strokeWidth={1} />
              <text x={fx(f)} y={height - 6} textAnchor="middle">{label}</text>
            </g>
          ))}
          {GRID_DB.map((db) => (
            <g key={db}>
              <line
                x1={PAD_L} y1={dy(db)} x2={PAD_L + plotW} y2={dy(db)}
                stroke={db === 0 ? 'var(--lsc-fg-fainter)' : 'var(--lsc-border)'}
                strokeWidth={1}
              />
              <text x={PAD_L - 6} y={dy(db)} textAnchor="end" dominantBaseline="middle">{dbLabel(db)}</text>
            </g>
          ))}
          <text x={PAD_L - 6} y={height - 6} textAnchor="end">Hz</text>
        </g>

        {/* What each band does on its own, in its colour */}
        {bands.map(({ band, color }, i) => band.gainDb !== 0 && (
          <g key={i}>
            <path d={area((f) => bandGain(f, band))} fill={color} fillOpacity={0.14} />
            <path d={curve((f) => bandGain(f, band))} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={1} />
          </g>
        ))}

        {/* The total — what actually happens to the sound */}
        <path
          d={curve((f) => bands.reduce((sum, b) => sum + bandGain(f, b.band), 0))}
          fill="none"
          stroke="var(--lsc-fg)"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Band dots */}
        {drawOrder.map((i) => {
          const { band, color, freqRange } = bands[i]
          const cx = fx(band.freqHz)
          const cy = dy(band.gainDb)
          return (
            <g
              key={i}
              className="nowheel"
              style={{ cursor: dragging === i ? 'grabbing' : freqRange ? 'grab' : 'ns-resize' }}
              onPointerDown={(e) => onDotDown(i, e)}
              onPointerEnter={() => setHovered(i)}
              onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
              onWheel={(e) => onDotWheel(i, e)}
            >
              {/* Larger invisible grab area */}
              <circle cx={cx} cy={cy} r={16} fill="transparent" />
              {active === i && <circle cx={cx} cy={cy} r={14} fill={color} fillOpacity={0.25} />}
              <circle cx={cx} cy={cy} r={DOT_R} fill={color} stroke="var(--lsc-node-bg)" strokeWidth={2} />
            </g>
          )
        })}
      </svg>

      {/* Values of the dot under the mouse / being dragged */}
      {readout && (
        <div
          style={{
            position: 'absolute', ...readoutStyle,
            padding: '2px 8px', borderRadius: 6,
            background: 'var(--lsc-header)', border: `1px solid ${readout.color}`,
            boxShadow: 'var(--lsc-shadow-popup)',
            fontSize: 11, fontWeight: 600, lineHeight: 1.5, whiteSpace: 'nowrap',
            color: 'var(--lsc-fg)', pointerEvents: 'none',
          }}
        >
          {readout.name}
          <span style={{ fontFamily: 'var(--lsc-font-mono)' }}>
            {' · '}{formatFreq(readout.band.freqHz)}{' · '}{formatGain(readout.band.gainDb)}
            {adjustableWidth && !isShelf(readout.band) && ` · Q ${(readout.band.Q ?? 1.4).toFixed(1)}`}
          </span>
        </div>
      )}
    </div>
  )
}
