import { useSignalChain } from '../hooks/useSignalChain'
import { useSignalStore } from '../store/signalStore'
import { CHAIN_ORDER } from '../data/levels'
import type { SignalHealth } from '../hooks/useSignalChain'

const DB_MIN = -70
const DB_MAX = 24
const SVG_W = 600
const SVG_H = 120
const PAD_LEFT = 36
const PAD_RIGHT = 12
const PAD_TOP = 8
const PAD_BOT = 24

function dbToY(db: number): number {
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, db))
  return PAD_TOP + ((DB_MAX - clamped) / (DB_MAX - DB_MIN)) * (SVG_H - PAD_TOP - PAD_BOT)
}

const HEALTH_COLORS: Record<SignalHealth, string> = {
  'too-quiet': 'var(--signal-too-quiet)',
  good: 'var(--signal-good)',
  hot: 'var(--signal-hot)',
  clipping: 'var(--signal-clipping)',
}

const STAGE_LABELS: Record<string, string> = {
  mic: 'MIC',
  preamp: 'PREAMP',
  eq: 'EQ',
  comp: 'COMP',
  fader: 'FADER',
  master: 'MASTER',
  speaker: 'OUT',
}

interface StagePoint {
  id: string
  label: string
  db: number
  health: SignalHealth
}

export function SignalLevelProfile() {
  const chain = useSignalChain()
  const unlockedNodes = useSignalStore((s) => s.unlockedNodes)

  const allStages: StagePoint[] = [
    { id: 'mic', label: STAGE_LABELS.mic, db: chain.mic.out, health: chain.mic.health },
    { id: 'preamp', label: STAGE_LABELS.preamp, db: chain.preamp.out, health: chain.preamp.health },
    { id: 'eq', label: STAGE_LABELS.eq, db: chain.eq.out, health: chain.eq.health },
    { id: 'comp', label: STAGE_LABELS.comp, db: chain.comp.out, health: chain.comp.health },
    { id: 'fader', label: STAGE_LABELS.fader, db: chain.fader.out, health: chain.fader.health },
    { id: 'master', label: STAGE_LABELS.master, db: chain.master.out, health: chain.master.health },
    { id: 'speaker', label: STAGE_LABELS.speaker, db: chain.master.out, health: chain.master.health },
  ]

  // Only show stages that are in the chain, in chain order
  const stages = CHAIN_ORDER
    .filter((id) => unlockedNodes.includes(id))
    .map((id) => allStages.find((s) => s.id === id)!)
    .filter(Boolean)

  const plotLeft = PAD_LEFT + 8
  const plotRight = SVG_W - PAD_RIGHT
  const colWidth = stages.length > 1 ? (plotRight - plotLeft) / (stages.length - 1) : 0

  // Zone band boundaries
  const yClip = dbToY(0)
  const yGoodTop = dbToY(-12)
  const yGoodBot = dbToY(-40)
  const yBottom = dbToY(DB_MIN)

  // Polyline
  const polyPoints = stages.map((s, i) => `${plotLeft + i * colWidth},${dbToY(s.db)}`).join(' ')

  // Y-axis label positions
  const yAxisLabels = [
    { db: 0, label: '0' },
    { db: -12, label: '-12' },
    { db: -40, label: '-40' },
  ]

  return (
    <div className="border-t flex-shrink-0" style={{ borderColor: 'var(--node-border)', background: '#0d0f13' }}>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height: SVG_H }}
      >
        {/* Zone fills */}
        {/* Red zone: above 0 dBu */}
        <rect x={plotLeft} y={PAD_TOP} width={plotRight - plotLeft} height={Math.max(0, yClip - PAD_TOP)}
          fill="rgba(248,113,113,0.06)" />
        {/* Yellow zone: -12 to 0 */}
        <rect x={plotLeft} y={yClip} width={plotRight - plotLeft} height={Math.max(0, yGoodTop - yClip)}
          fill="rgba(250,204,21,0.06)" />
        {/* Green zone: -40 to -12 */}
        <rect x={plotLeft} y={yGoodTop} width={plotRight - plotLeft} height={Math.max(0, yGoodBot - yGoodTop)}
          fill="rgba(74,222,128,0.07)" />
        {/* Blue zone: below -40 */}
        <rect x={plotLeft} y={yGoodBot} width={plotRight - plotLeft} height={Math.max(0, yBottom - yGoodBot)}
          fill="rgba(96,165,250,0.05)" />

        {/* Zone boundary lines */}
        <line x1={plotLeft} y1={yClip} x2={plotRight} y2={yClip} stroke="rgba(250,204,21,0.3)" strokeWidth="1" strokeDasharray="4 3" />
        <line x1={plotLeft} y1={yGoodTop} x2={plotRight} y2={yGoodTop} stroke="rgba(74,222,128,0.3)" strokeWidth="1" strokeDasharray="4 3" />
        <line x1={plotLeft} y1={yGoodBot} x2={plotRight} y2={yGoodBot} stroke="rgba(96,165,250,0.3)" strokeWidth="1" strokeDasharray="4 3" />

        {/* Y-axis labels */}
        {yAxisLabels.map(({ db, label }) => (
          <text
            key={db}
            x={PAD_LEFT - 2}
            y={dbToY(db) + 3}
            textAnchor="end"
            fill="#4b5563"
            fontSize="8"
            fontFamily="monospace"
          >
            {label}
          </text>
        ))}

        {/* Signal polyline */}
        {stages.length > 1 && (
          <polyline
            points={polyPoints}
            fill="none"
            stroke="#4b5563"
            strokeWidth="1.5"
            strokeDasharray="none"
          />
        )}

        {/* Stage dots and labels */}
        {stages.map((stage, i) => {
          const x = plotLeft + i * colWidth
          const y = dbToY(stage.db)
          const color = HEALTH_COLORS[stage.health]

          return (
            <g key={stage.id}>
              {/* Vertical column guide */}
              <line
                x1={x} y1={PAD_TOP} x2={x} y2={yBottom}
                stroke="#1e2128"
                strokeWidth="1"
              />
              {/* Dot */}
              <circle cx={x} cy={y} r={5} fill={color} />
              <circle cx={x} cy={y} r={3} fill="#0d0f13" />
              <circle cx={x} cy={y} r={1.5} fill={color} />
              {/* dB value above dot */}
              <text
                x={x}
                y={y - 8}
                textAnchor="middle"
                fill={color}
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="600"
              >
                {stage.db > -60 ? `${stage.db >= 0 ? '+' : ''}${stage.db.toFixed(1)}` : '-∞'}
              </text>
              {/* Stage label below */}
              <text
                x={x}
                y={SVG_H - 6}
                textAnchor="middle"
                fill="#4b5563"
                fontSize="7"
                fontFamily="monospace"
                fontWeight="600"
                letterSpacing="0.5"
              >
                {stage.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
