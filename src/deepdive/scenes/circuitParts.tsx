import { dbToPercent, meterZones, zoneColor } from '../../signal/levels'
import { BASE_GAP } from './circuit'
import { FAINT, INK, MOVER, PART, PART_2 } from './look'

// The parts the amplification subjects draw (Deep dive, D46): a wire the charges move along, the
// 0 V sign, a mains plug, a transistor and a level meter as the canvas's (their geometry: circuit.ts).

/** The 0 V sign: three lines, shorter and shorter */
export function Ground({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={INK} strokeWidth={1.5} strokeLinecap="round">
      <line x1={x - 12} y1={y} x2={x + 12} y2={y} />
      <line x1={x - 8} y1={y + 5} x2={x + 8} y2={y + 5} />
      <line x1={x - 4} y1={y + 10} x2={x + 4} y2={y + 10} />
    </g>
  )
}

/** A mains plug, its cable leaving to the right from (x, y) */
export function Plug({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 34} y={y - 16} width={34} height={32} rx={6} fill={PART_2} />
      <rect x={x - 48} y={y - 10} width={14} height={4} rx={1} fill={PART} />
      <rect x={x - 48} y={y + 6} width={14} height={4} rx={1} fill={PART} />
    </g>
  )
}

/**
 * A transistor whose current runs along the column at `x`: its circle and its base bar (BASE_GAP
 * left of the column, its middle at `y`); `fill` opens as far as its current (named for the painter).
 * The emitter's arrow: out of it (pnp false: below the bar) or into it (pnp: above). Its leads to
 * the column — from y − 28 and to y + 28 — are the scene's.
 */
export function Transistor({ x, y, fill, pnp }: { x: number; y: number; fill: string; pnp: boolean }) {
  const bar = x - BASE_GAP
  // The emitter's lead runs from the bar (bar, y ± 8) to the column (x, y ± 28): its arrow sits along it
  const [x0, y0, x1, y1] = pnp ? [x, y - 28, bar, y - 8] : [bar, y + 8, x, y + 28]
  const mx = x0 + (x1 - x0) * 0.75, my = y0 + (y1 - y0) * 0.75
  const a = Math.atan2(y1 - y0, x1 - x0), s = 7
  const head = `M${mx} ${my} L${(mx - s * Math.cos(a - 0.45)).toFixed(1)} ${(my - s * Math.sin(a - 0.45)).toFixed(1)} ` +
    `L${(mx - s * Math.cos(a + 0.45)).toFixed(1)} ${(my - s * Math.sin(a + 0.45)).toFixed(1)} Z`
  return (
    <>
      <circle data-p={fill} cx={x - 12} cy={y} r={34} fill={MOVER} fillOpacity={0.06} stroke={PART} strokeWidth={2} />
      <line x1={bar} y1={y - 18} x2={bar} y2={y + 18} stroke={INK} strokeWidth={4} />
      <path d={head} fill={INK} />
    </>
  )
}

/**
 * A level meter as the canvas's (D16, D17): its colours belong to the scale — green up to unity,
 * yellow, red at the top —, the average solid, the peaks pale above it, a thin line at the peak.
 * Upright, its bottom at `y + h`. The loop's levels, dBu.
 */
export function LevelMeter({ x, y, w, h, rms, peak }: { x: number; y: number; w: number; h: number; rms: number; peak: number }) {
  const top = (pct: number) => y + h - (h * pct) / 100
  const rmsPct = dbToPercent(rms), peakPct = dbToPercent(peak)
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} fill={FAINT} opacity={0.5} />
      {meterZones('analog').map((z) => {
        const lit = Math.min(z.to, peakPct)
        if (lit <= z.from) return null
        const solid = Math.min(z.to, rmsPct)
        return (
          <g key={z.kind} fill={zoneColor(z.kind)}>
            {solid > z.from && <rect x={x} y={top(solid)} width={w} height={top(z.from) - top(solid)} />}
            {lit > Math.max(z.from, solid) && (
              <rect x={x} y={top(lit)} width={w} height={top(Math.max(z.from, solid)) - top(lit)} opacity={0.35} />
            )}
          </g>
        )
      })}
      <line x1={x - 2} y1={top(peakPct)} x2={x + w + 2} y2={top(peakPct)} stroke={INK} strokeWidth={1.5} />
    </g>
  )
}

