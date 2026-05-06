import type { NodeProps, Node } from '@xyflow/react'
import { ShieldAlert } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import type { CompressorResult } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

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

const GW = 160
const GH = 120
const GP = 12

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
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <svg viewBox={`0 0 ${GW} ${GH}`} width="100%" height={GH} style={{ display: 'block' }}>
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
        <text x={GW - GP + 2} y={outputY(0) + 3} fontSize="7" fill="var(--lsc-text)" opacity="0.5">0</text>
        <text x={GP} y={GH - 2} fontSize="7" fill="var(--lsc-text)" opacity="0.5" textAnchor="middle">−60</text>
        <text x={GW - GP} y={GH - 2} fontSize="7" fill="var(--lsc-text)" opacity="0.5" textAnchor="end">0 dB in</text>

        {/* Ceiling vertical marker */}
        <line
          x1={threshX} y1={GP} x2={threshX} y2={GH - GP}
          stroke="rgba(216,149,72,0.55)" strokeWidth={1.5} strokeDasharray="3 2"
        />

        {/* Flat ceiling horizontal marker (the brickwall) */}
        <line
          x1={threshX} y1={outputY(ceiling + makeupGain)} x2={GW - GP} y2={outputY(ceiling + makeupGain)}
          stroke="rgba(216,149,72,0.3)" strokeWidth={1} strokeDasharray="2 3"
        />

        {/* 1:1 reference (grey dashed) */}
        <path d={refPts} fill="none" stroke="var(--lsc-text)" strokeWidth={1} strokeDasharray="3 3" opacity="0.3" />

        {/* Brickwall curve */}
        <path d={curvePath} fill="none" stroke="var(--lsc-accent)" strokeWidth={2} strokeLinecap="round" />

        {/* LIMITING badge */}
        <text
          x={GW - GP} y={GP + 8}
          fontSize="7" fontWeight="700"
          fill={isLimiting ? 'var(--signal-hot)' : 'var(--lsc-text)'}
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
              stroke="rgba(91,141,232,0.5)" strokeWidth={1} />
            <circle cx={opX} cy={opY} r={4}
              fill="white"
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
  const { stages, inputDb } = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const params        = node?.params ?? {}
  const ceiling       = (params.thresholdDb as number) ?? -3
  const makeupGain    = (params.makeupGainDb as number) ?? 0
  const inputLevel    = inputDb[id] ?? -Infinity
  const result        = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const, gainReductionDb: 0 }
  const limResult     = result as CompressorResult
  const gainReduction = limResult.gainReductionDb ?? 0

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="limiter"
      icon={<ShieldAlert size={14} />}
      label={data.label ?? t.nodes.limiter?.label ?? 'Limiter'}
      style={{ width: 220 }}
    >
      <div className="space-y-3">
        <SignalMeter db={inputLevel} health={getHealth(inputLevel)} label={t.meters.input} />

        <LimiterCurve
          ceiling={ceiling}
          makeupGain={makeupGain}
          inputLevel={inputLevel}
          gainReduction={gainReduction}
        />

        {/* Knob row */}
        <div style={{ display: 'flex', justifyContent: 'space-around', paddingTop: 2 }}>
          <KnobControl
            value={ceiling}
            min={-20}
            max={0}
            step={0.5}
            label={t.nodes.limiter?.ceiling ?? 'Ceiling'}
            formatValue={(v) => `${v} dB`}
            onChange={(v) => updateNodeParams(id, { thresholdDb: v })}
            color="var(--signal-hot)"
            size={44}
          />
          <KnobControl
            value={makeupGain}
            min={0}
            max={20}
            step={0.5}
            label={t.nodes.limiter?.makeupGain ?? 'Makeup'}
            formatValue={(v) => `+${v} dB`}
            onChange={(v) => updateNodeParams(id, { makeupGainDb: v })}
            color="var(--signal-good)"
            size={44}
          />
        </div>

        {/* GR meter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 'var(--node-text-xs)', color: 'var(--lsc-text)', opacity: 0.6, whiteSpace: 'nowrap' }}>
            GR
          </span>
          <div
            style={{
              flex: 1, height: 5,
              background: 'var(--lsc-sunken)',
              borderRadius: 3,
              border: '1px solid var(--lsc-border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, (gainReduction / 20) * 100)}%`,
                height: '100%',
                background: 'var(--signal-hot)',
                borderRadius: 3,
                transition: 'width 0.1s ease-out',
              }}
            />
          </div>
          <span style={{ fontSize: 'var(--node-text-xs)', fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-text)', minWidth: 28, textAlign: 'right' }}>
            {gainReduction > 0 ? `−${gainReduction.toFixed(1)}` : '0.0'}
          </span>
        </div>

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
