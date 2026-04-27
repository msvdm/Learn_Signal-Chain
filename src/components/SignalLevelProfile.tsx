import { useSignalStore } from '../store/signalStore'
import { useGraphSignal } from '../hooks/useSignalChain'
import type { SignalHealth } from '../hooks/useSignalChain'

const W = 900
const H = 180
const PAD_TOP = 18
const PAD_BOT = 36
const PAD_LEFT = 56
const PAD_RIGHT = 24
const PLOT_H = H - PAD_TOP - PAD_BOT

function dbToY(db: number): number {
  const clamped = Math.max(-65, Math.min(5, db))
  return PAD_TOP + ((5 - clamped) / 70) * PLOT_H
}

const HEALTH_COLORS: Record<SignalHealth, string> = {
  'too-quiet': 'var(--signal-too-quiet)',
  good: 'var(--signal-good)',
  hot: 'var(--signal-hot)',
  clipping: 'var(--signal-clipping)',
}

interface StagePoint {
  id: string
  label: string
  db: number
  health: SignalHealth
}

export function SignalLevelProfile() {
  const graphNodes = useSignalStore((s) => s.nodes)
  const { stages } = useGraphSignal()

  // Build the primary path: group nodes by x position and pick the one
  // with the smallest y at each column (= the first/top channel row).
  const byX = new Map<number, typeof graphNodes[0]>()
  for (const node of graphNodes) {
    const existing = byX.get(node.position.x)
    if (!existing || node.position.y < existing.position.y) {
      byX.set(node.position.x, node)
    }
  }
  const primaryPath = [...byX.values()].sort((a, b) => a.position.x - b.position.x)

  const stagePoints: StagePoint[] = primaryPath.map((node) => ({
    id: node.id,
    label: node.label ?? node.typeKey,
    db: stages[node.id]?.out ?? -Infinity,
    health: stages[node.id]?.health ?? 'too-quiet',
  }))

  const xPlotStart = PAD_LEFT
  const xPlotEnd = W - PAD_RIGHT
  const plotW = xPlotEnd - xPlotStart

  const xFor = (i: number) =>
    stagePoints.length > 1 ? PAD_LEFT + (i / (stagePoints.length - 1)) * plotW : PAD_LEFT + plotW / 2

  const pts = stagePoints.map((_, i) => [xFor(i), dbToY(_.db)] as [number, number])
  const poly = pts.map(([x, y]) => `${x},${y}`).join(' ')

  return (
    <div className="flex-shrink-0" style={{ background: 'var(--lsc-header)' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        {/* Zone fills */}
        <rect x={xPlotStart} y={PAD_TOP} width={plotW} height={dbToY(0) - PAD_TOP}
          fill="rgba(216,107,107,0.05)" />
        <rect x={xPlotStart} y={dbToY(0)} width={plotW} height={dbToY(-12) - dbToY(0)}
          fill="rgba(216,149,72,0.06)" />
        <rect x={xPlotStart} y={dbToY(-12)} width={plotW} height={dbToY(-40) - dbToY(-12)}
          fill="rgba(79,168,118,0.07)" />
        <rect x={xPlotStart} y={dbToY(-40)} width={plotW} height={(PAD_TOP + PLOT_H) - dbToY(-40)}
          fill="rgba(91,141,232,0.05)" />

        {/* Dashed zone boundaries */}
        <line x1={xPlotStart} y1={dbToY(0)}   x2={xPlotEnd} y2={dbToY(0)}   stroke="rgba(216,149,72,0.35)"  strokeDasharray="4 3" />
        <line x1={xPlotStart} y1={dbToY(-12)}  x2={xPlotEnd} y2={dbToY(-12)} stroke="rgba(79,168,118,0.35)"  strokeDasharray="4 3" />
        <line x1={xPlotStart} y1={dbToY(-40)}  x2={xPlotEnd} y2={dbToY(-40)} stroke="rgba(91,141,232,0.35)"  strokeDasharray="4 3" />

        {/* Zone labels (right side) */}
        <text x={xPlotEnd - 6} y={dbToY(0)  - 4} textAnchor="end" fill="var(--signal-hot)"       fontSize="9" fontFamily="system-ui" fontWeight="600">0 dBu · clip</text>
        <text x={xPlotEnd - 6} y={dbToY(-12) - 4} textAnchor="end" fill="var(--signal-good)"      fontSize="9" fontFamily="system-ui" fontWeight="600">−12 dBu</text>
        <text x={xPlotEnd - 6} y={dbToY(-40) - 4} textAnchor="end" fill="var(--signal-too-quiet)" fontSize="9" fontFamily="system-ui" fontWeight="600">−40 dBu</text>

        {/* Y-axis ticks */}
        {[0, -12, -24, -40, -60].map((v) => (
          <text
            key={v}
            x={PAD_LEFT - 8}
            y={dbToY(v) + 3}
            textAnchor="end"
            fill="var(--lsc-text)"
            fontSize="9"
            fontFamily="ui-monospace,monospace"
          >
            {v}
          </text>
        ))}

        {/* Connecting polyline */}
        {stagePoints.length > 1 && (
          <polyline points={poly} fill="none" stroke="var(--lsc-text)" strokeWidth="1.5" strokeLinejoin="round" />
        )}

        {/* Stage dots and labels */}
        {stagePoints.map((stage, i) => {
          const [x, y] = pts[i]
          const color = HEALTH_COLORS[stage.health]
          const val = stage.db <= -60 ? '−∞' : `${stage.db >= 0 ? '+' : ''}${Math.round(stage.db)}`
          const labelAbove = i % 2 === 0

          return (
            <g key={stage.id} fontFamily="ui-monospace,monospace" textAnchor="middle" fontWeight="600">
              <circle cx={x} cy={y} r={6} fill={color} opacity="0.22" />
              <circle cx={x} cy={y} r={4} fill="white" stroke={color} strokeWidth="1.8" />
              <text x={x} y={labelAbove ? y - 10 : y + 16} fill={color} fontSize="10">{val}</text>
              <text x={x} y={H - 10} fill="var(--lsc-text)" fontSize="10" fontFamily="system-ui" fontWeight="500">
                {stage.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
