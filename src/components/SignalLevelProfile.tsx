import { useSignalStore } from '../store/signalStore'
import { useGraphSignal } from '../hooks/useSignalChain'
import type { SignalHealth } from '../hooks/useSignalChain'
import type { SignalNode, SignalEdge } from '../data/nodeRegistry'

// ── Layout ─────────────────────────────────────────────────────────────────────

const W       = 900
const ROW_H   = 90       // height per chain row
const PAD_TOP = 14
const PAD_BOT = 28
const PAD_L   = 52
const PAD_R   = 16
const PLOT_H  = ROW_H - PAD_TOP - PAD_BOT

function dbToY(db: number, rowTop: number): number {
  const clamped = Math.max(-65, Math.min(5, db))
  return rowTop + PAD_TOP + ((5 - clamped) / 70) * PLOT_H
}

const HEALTH_COLORS: Record<SignalHealth, string> = {
  'too-quiet': 'var(--signal-too-quiet)',
  good:        'var(--signal-good)',
  hot:         'var(--signal-hot)',
  clipping:    'var(--signal-clipping)',
}

// Palette of distinguishable colors for multiple chains
const CHAIN_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
]

// ── Chain tracing ──────────────────────────────────────────────────────────────

interface Chain {
  id: string
  label: string
  nodes: SignalNode[]
  type: 'track' | 'bus'
  color: string
}

const BUS_TYPES = new Set(['mono-bus', 'stereo-bus', 'master-bus'])

function traceChains(graphNodes: SignalNode[], edges: SignalEdge[]): Chain[] {
  if (graphNodes.length === 0) return []

  // Build forward adjacency
  const adj = new Map<string, string[]>()
  for (const n of graphNodes) adj.set(n.id, [])
  for (const e of edges) adj.get(e.source)?.push(e.target)

  // Find nodes with no incoming edges (sources in this graph)
  const hasIncoming = new Set(edges.map((e) => e.target))
  const roots = graphNodes.filter((n) => !hasIncoming.has(n.id))

  const allPaths: SignalNode[][] = []

  function dfs(nodeId: string, path: SignalNode[], visited: Set<string>) {
    if (visited.has(nodeId)) return
    const node = graphNodes.find((n) => n.id === nodeId)
    if (!node) return
    const newPath = [...path, node]
    const targets = adj.get(nodeId) ?? []
    if (targets.length === 0) {
      allPaths.push(newPath)
    } else {
      const next = new Set([...visited, nodeId])
      for (const t of targets) dfs(t, newPath, next)
    }
  }

  for (const root of roots) dfs(root.id, [], new Set())

  // Deduplicate paths that are identical subsets (e.g., same chain reached by same root)
  const seen = new Set<string>()
  const unique = allPaths.filter((path) => {
    const key = path.map((n) => n.id).join('>')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Classify and label each chain
  let colorIdx = 0
  return unique.map((nodes, i) => {
    const hasBus  = nodes.some((n) => BUS_TYPES.has(n.typeKey))
    const srcNode = nodes[0]
    const srcLabel = srcNode?.label ?? srcNode?.typeKey ?? `Chain ${i + 1}`
    return {
      id:    `chain-${i}`,
      label: srcLabel,
      nodes,
      type:  hasBus ? 'bus' : 'track',
      color: CHAIN_COLORS[colorIdx++ % CHAIN_COLORS.length],
    }
  })
}

// ── Single chain row ───────────────────────────────────────────────────────────

interface ChainRowProps {
  chain:   Chain
  stages:  Record<string, { out: number; health: SignalHealth }>
  rowTop:  number
  plotW:   number
}

function ChainRow({ chain, stages, rowTop, plotW }: ChainRowProps) {
  const pts = chain.nodes.map((node, i) => {
    const db = stages[node.id]?.out ?? -Infinity
    const x  = chain.nodes.length > 1
      ? PAD_L + (i / (chain.nodes.length - 1)) * plotW
      : PAD_L + plotW / 2
    return { x, y: dbToY(db, rowTop), db, health: stages[node.id]?.health ?? 'too-quiet', label: node.label ?? node.typeKey }
  })

  const poly = pts.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <g>
      {/* Row background stripe */}
      <rect x={PAD_L} y={rowTop} width={plotW} height={ROW_H} fill="none" />

      {/* Zero line (faint) */}
      <line x1={PAD_L} y1={dbToY(0, rowTop)} x2={PAD_L + plotW} y2={dbToY(0, rowTop)}
        stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

      {/* Chain label */}
      <text x={PAD_L - 4} y={rowTop + PAD_TOP + PLOT_H / 2 + 4} textAnchor="end"
        fill={chain.color} fontSize="9" fontFamily="system-ui" fontWeight="700">
        {chain.label}
      </text>

      {/* Connecting polyline */}
      {pts.length > 1 && (
        <polyline points={poly} fill="none" stroke={chain.color} strokeWidth="1.5"
          strokeLinejoin="round" opacity="0.8" />
      )}

      {/* Stage dots */}
      {pts.map((pt, i) => {
        const color = HEALTH_COLORS[pt.health]
        const val   = pt.db <= -60 ? '−∞' : `${pt.db >= 0 ? '+' : ''}${Math.round(pt.db)}`
        const isLast = i === pts.length - 1

        return (
          <g key={i} fontFamily="ui-monospace,monospace" textAnchor="middle" fontWeight="600">
            <circle cx={pt.x} cy={pt.y} r={5} fill={color} opacity="0.2" />
            <circle cx={pt.x} cy={pt.y} r={3.5} fill="white" stroke={color} strokeWidth="1.6" />
            {/* Value label: alternate above/below to avoid overlap */}
            <text x={pt.x} y={i % 2 === 0 ? pt.y - 8 : pt.y + 14} fill={color} fontSize="9">{val}</text>
            {/* Node label at the very bottom of the row */}
            <text x={pt.x} y={rowTop + ROW_H - 4} fill="var(--lsc-text)" fontSize="9"
              fontFamily="system-ui" fontWeight={isLast ? 600 : 400} opacity="0.75">
              {pt.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SignalLevelProfile() {
  const graphNodes = useSignalStore((s) => s.nodes)
  const graphEdges = useSignalStore((s) => s.edges)
  const { stages } = useGraphSignal()

  const chains = traceChains(graphNodes, graphEdges)

  const tracks = chains.filter((c) => c.type === 'track')
  const busses = chains.filter((c) => c.type === 'bus')

  const hasTracks = tracks.length > 0
  const hasBusses = busses.length > 0

  // Dynamic height: one row per chain, plus section headers (20px each)
  const sectionHeaderH = 20
  const tracksH = hasTracks ? tracks.length * ROW_H + sectionHeaderH : 0
  const bussesH = hasBusses ? busses.length * ROW_H + sectionHeaderH : 0
  const totalH  = Math.max(ROW_H, tracksH + bussesH)

  const plotW = W - PAD_L - PAD_R

  // dB reference lines shared across all rows
  const DB_REFS = [0, -12, -40]
  const DB_ZONE_LABELS = [
    { db: 0,   label: '0 dBu · clip', color: 'var(--signal-hot)' },
    { db: -12, label: '−12 dBu',      color: 'var(--signal-good)' },
    { db: -40, label: '−40 dBu',      color: 'var(--signal-too-quiet)' },
  ]

  // If nothing is on the canvas yet, show a placeholder
  if (graphNodes.length === 0) {
    return (
      <div className="flex-shrink-0" style={{ background: 'var(--lsc-header)' }}>
        <svg viewBox={`0 0 ${W} ${ROW_H}`} width="100%" height={ROW_H} style={{ display: 'block' }}>
          <text x={W / 2} y={ROW_H / 2 + 4} textAnchor="middle" fill="var(--lsc-text)"
            opacity="0.3" fontSize="12" fontFamily="system-ui">
            Add nodes to the canvas to see signal levels
          </text>
        </svg>
      </div>
    )
  }

  // Helper: render one section (tracks or busses)
  function renderSection(sectionChains: Chain[], offsetY: number, title: string) {
    return (
      <g>
        {/* Section title */}
        <text x={PAD_L} y={offsetY + 14} fill="var(--lsc-text)" fontSize="9"
          fontFamily="system-ui" fontWeight="700" opacity="0.45" letterSpacing="0.08em">
          {title.toUpperCase()}
        </text>
        {/* Section rows */}
        {sectionChains.map((chain, i) => (
          <ChainRow
            key={chain.id}
            chain={chain}
            stages={stages}
            rowTop={offsetY + sectionHeaderH + i * ROW_H}
            plotW={plotW}
          />
        ))}
      </g>
    )
  }

  // Y-axis ticks — repeated for each visible dB value
  function renderYAxis(offsetY: number, height: number) {
    const ticks = [-60, -40, -24, -12, 0]
    return ticks.map((v) => {
      // Find a row to anchor to (use first row of tracks section)
      const rowTop = hasTracks ? sectionHeaderH : 0
      const y = dbToY(v, offsetY + rowTop)
      if (y < offsetY || y > offsetY + height) return null
      return (
        <text key={v} x={PAD_L - 6} y={y + 3} textAnchor="end"
          fill="var(--lsc-text)" fontSize="9" fontFamily="ui-monospace,monospace" opacity="0.5">
          {v}
        </text>
      )
    })
  }

  return (
    <div className="flex-shrink-0" style={{ background: 'var(--lsc-header)' }}>
      <svg
        viewBox={`0 0 ${W} ${totalH}`}
        width="100%"
        height={totalH}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        {/* Zone fills (across full height) */}
        {chains.map((chain, ci) => {
          const section  = chain.type === 'track' ? 'track' : 'bus'
          const secChains = section === 'track' ? tracks : busses
          const secOffset = section === 'track' ? 0 : tracksH
          const rowIdx    = secChains.indexOf(chain)
          const rowTop    = secOffset + sectionHeaderH + rowIdx * ROW_H
          return (
            <g key={`zone-${ci}`}>
              <rect x={PAD_L} y={rowTop + PAD_TOP} width={plotW} height={dbToY(0, rowTop) - (rowTop + PAD_TOP)}
                fill="rgba(216,107,107,0.04)" />
              <rect x={PAD_L} y={dbToY(0, rowTop)} width={plotW} height={dbToY(-12, rowTop) - dbToY(0, rowTop)}
                fill="rgba(216,149,72,0.04)" />
              <rect x={PAD_L} y={dbToY(-12, rowTop)} width={plotW} height={dbToY(-40, rowTop) - dbToY(-12, rowTop)}
                fill="rgba(79,168,118,0.05)" />
            </g>
          )
        })}

        {/* Horizontal dB reference lines (once per row, across plotW) */}
        {chains.map((chain, ci) => {
          const secChains = chain.type === 'track' ? tracks : busses
          const secOffset = chain.type === 'track' ? 0 : tracksH
          const rowIdx    = secChains.indexOf(chain)
          const rowTop    = secOffset + sectionHeaderH + rowIdx * ROW_H
          return DB_REFS.map((db) => (
            <line key={`ref-${ci}-${db}`}
              x1={PAD_L} y1={dbToY(db, rowTop)} x2={PAD_L + plotW} y2={dbToY(db, rowTop)}
              stroke={DB_ZONE_LABELS.find((z) => z.db === db)?.color ?? 'var(--lsc-border)'}
              strokeWidth={0.8} strokeDasharray="4 3" opacity="0.35"
            />
          ))
        })}

        {/* Tracks section */}
        {hasTracks && renderSection(tracks, 0, 'Tracks')}

        {/* Busses section */}
        {hasBusses && renderSection(busses, tracksH, 'Busses')}

        {/* Y-axis ticks (left side, anchored to first section) */}
        {renderYAxis(0, totalH)}

        {/* Zone labels on right edge of first chain row */}
        {chains.length > 0 && (() => {
          const rowTop = sectionHeaderH
          return DB_ZONE_LABELS.map(({ db, label, color }) => (
            <text key={db} x={W - PAD_R - 4} y={dbToY(db, rowTop) - 4}
              textAnchor="end" fill={color} fontSize="8" fontFamily="system-ui" fontWeight="600" opacity="0.7">
              {label}
            </text>
          ))
        })()}
      </svg>
    </div>
  )
}
