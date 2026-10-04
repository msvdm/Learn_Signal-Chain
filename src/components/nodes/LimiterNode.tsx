import type { NodeProps, Node } from '@xyflow/react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal } from '../../hooks/useGraphSignal'
import { getHealth } from '../../signal/levels'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useParams } from '../../hooks/useParams'
import { twoColumns } from '../../utils/twoColumns'
import { KnobStack, ReductionReadout } from './DynamicsLayout'

interface GraphLimiterData extends Record<string, unknown> {
  color?: string
  label?: string
}

// ── Brickwall dynamics graph ──────────────────────────────────────────────────
// X = input level, Y = output level.
// Below ceiling: 1:1 diagonal (signal passes through unchanged + makeup).
// At or above ceiling: flat horizontal line — the hard brick wall.
// The abrupt 90° corner at the ceiling is the visual signature of a limiter
// vs. a compressor (which has a shallower slope, not a flat line).

const GW = 168   // SVG canvas width (px — drawn 1:1; with its border the box fills the 170px column)
const GH = 112
const GP = 14    // padding inside SVG

const DB_IN_MIN  = -60
const DB_IN_MAX  = 0
const DB_OUT_MIN = -60
const DB_OUT_MAX = 20  // headroom for makeup gain

function inputX(db: number): number {
  return GP + ((db - DB_IN_MIN) / (DB_IN_MAX - DB_IN_MIN)) * (GW - GP * 2)
}
function outputY(db: number): number {
  const clamped = Math.max(DB_OUT_MIN, Math.min(DB_OUT_MAX, db))
  return GH - GP - ((clamped - DB_OUT_MIN) / (DB_OUT_MAX - DB_OUT_MIN)) * (GH - GP * 2)
}

interface LimiterCurveProps {
  ceiling: number
  makeupGain: number
  inputLevel: number
  gainReduction: number
}

function LimiterCurve({ ceiling, makeupGain, inputLevel, gainReduction }: LimiterCurveProps) {
  const STEPS = 80
  const pts: string[] = []
  for (let i = 0; i <= STEPS; i++) {
    const inDb  = DB_IN_MIN + (i / STEPS) * (DB_IN_MAX - DB_IN_MIN)
    const outDb = Math.min(inDb, ceiling) + makeupGain
    pts.push(`${i === 0 ? 'M' : 'L'} ${inputX(inDb).toFixed(1)},${outputY(outDb).toFixed(1)}`)
  }
  const curvePath = pts.join(' ')

  // 1:1 reference line (unity, no makeup)
  const refPts = [
    `M ${inputX(DB_IN_MIN).toFixed(1)},${outputY(DB_IN_MIN).toFixed(1)}`,
    `L ${inputX(0).toFixed(1)},${outputY(0).toFixed(1)}`,
  ].join(' ')

  // Current operating point
  const clampedInput = Math.max(DB_IN_MIN, Math.min(DB_IN_MAX, inputLevel))
  const opX     = inputX(clampedInput)
  const opOutDb = Math.min(inputLevel, ceiling) + makeupGain
  const opY     = outputY(opOutDb)
  const hasSignal   = isFinite(inputLevel) && inputLevel > DB_IN_MIN
  const isLimiting  = gainReduction > 0

  const threshX = inputX(ceiling)
  const gridDbs = [-48, -36, -24, -12, 0]

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

        {/* Grid */}
        {gridDbs.map((db) => (
          <g key={db}>
            <line
              x1={inputX(db)} y1={GP} x2={inputX(db)} y2={GH - GP}
              stroke="var(--lsc-border)" strokeWidth={db === 0 ? 1.2 : 0.8} strokeDasharray={db === 0 ? '' : '2 3'}
            />
            <line
              x1={GP} y1={outputY(db)} x2={GW - GP} y2={outputY(db)}
              stroke="var(--lsc-border)" strokeWidth={db === 0 ? 1.2 : 0.8} strokeDasharray={db === 0 ? '' : '2 3'}
            />
          </g>
        ))}

        {/* Axis labels */}
        <text x={GW - GP + 2} y={outputY(0) + 3} fontSize="11" fill="var(--lsc-fg-muted)">0</text>
        <text x={GP} y={GH - 2} fontSize="11" fill="var(--lsc-fg-muted)" textAnchor="middle">−60</text>
        <text x={GW - GP} y={GH - 2} fontSize="11" fill="var(--lsc-fg-muted)" textAnchor="end">0 dB in</text>

        {/* Ceiling vertical marker */}
        <line
          x1={threshX} y1={GP} x2={threshX} y2={GH - GP}
          stroke="var(--signal-hot)" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="3 2"
        />

        {/* Flat ceiling horizontal marker (the brickwall) */}
        <line
          x1={threshX} y1={outputY(ceiling + makeupGain)} x2={GW - GP} y2={outputY(ceiling + makeupGain)}
          stroke="var(--signal-hot)" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2 3"
        />

        {/* 1:1 reference (grey dashed) */}
        <path d={refPts} fill="none" stroke="var(--lsc-fg)" strokeWidth={1} strokeDasharray="3 3" opacity="0.3" />

        {/* Brickwall curve */}
        <path d={curvePath} fill="none" stroke="var(--lsc-accent)" strokeWidth={2} strokeLinecap="round" />

        {/* LIMITING badge */}
        <text
          x={GW - GP} y={GP + 8}
          fontSize="11" fontWeight="700"
          fill={isLimiting ? 'var(--signal-hot)' : 'var(--lsc-fg)'}
          textAnchor="end"
          opacity={isLimiting ? 1 : 0.4}
          style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
        >
          {isLimiting ? 'LIMITING' : 'PASS'}
        </text>

        {/* Operating point */}
        {hasSignal && (
          <>
            <line x1={opX} y1={GP} x2={opX} y2={opY - 5}
              stroke="var(--signal-too-quiet)" strokeOpacity={0.5} strokeWidth={1} />
            <circle cx={opX} cy={opY} r={4}
              fill="var(--lsc-node-bg)"
              stroke={isLimiting ? 'var(--signal-hot)' : 'var(--lsc-accent)'}
              strokeWidth="1.8"
            />
          </>
        )}
      </svg>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function LimiterNode({ id, data }: NodeProps<Node<GraphLimiterData>>) {
  const { stages }          = useGraphSignal()
  const p                = useParams(id, 'limiter')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const ceiling       = p('thresholdDb')
  const makeupGain    = p('makeupGainDb')
  const levels        = useStereoLevels(id)
  const inputLevel    = levels.inPeak
  const result        = stages[id]
  const gainReduction = result?.gainReductionDb ?? 0

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="limiter"
      label={data.label ?? t.nodes.limiter.label}
    >
      <div style={twoColumns}>
        <SignalMeter db={levels.in} dbR={levels.inR} health={getHealth(levels.inPeak, levels.inDomain)} domain={levels.inDomain} label={t.meters.input} />
        <SignalMeter db={levels.out} dbR={levels.outR} domain={levels.outDomain} health={result?.health ?? 'too-quiet'} label={t.meters.output} />

        <KnobStack>
          <KnobControl
            value={ceiling}
            min={-20}
            max={0}
            step={0.5}
            label={t.nodes.limiter.ceiling}
            formatValue={(v) => `${v} dB`}
            onChange={(v) => updateNodeParams(id, { thresholdDb: v })}
            color="var(--signal-hot)"
            size={44}
            layout="side"
          />
          <KnobControl
            value={makeupGain}
            min={0}
            max={20}
            step={0.5}
            label={t.nodes.limiter.makeupGain}
            formatValue={(v) => `+${v} dB`}
            onChange={(v) => updateNodeParams(id, { makeupGainDb: v })}
            color="var(--signal-good)"
            size={44}
            layout="side"
          />
        </KnobStack>

        <div>
          <LimiterCurve
            ceiling={ceiling}
            makeupGain={makeupGain}
            inputLevel={inputLevel}
            gainReduction={gainReduction}
          />
          <ReductionReadout db={gainReduction} maxDb={20} label={t.nodes.comp.turningDown} style={{ marginTop: 12 }} />
        </div>
      </div>
    </NodeWrapper>
  )
}
