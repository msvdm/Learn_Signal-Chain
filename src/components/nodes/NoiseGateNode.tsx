import type { NodeProps, Node } from '@xyflow/react'
import { DoorClosed } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphNoiseGateData extends Record<string, unknown> {
  color?: string
  label?: string
}

// ── Gate transfer-function graph ──────────────────────────────────────────────
// X = input level, Y = output level.
// Below threshold: output is the floor (gate closed = silence).
// At and above threshold: output = input (1:1, gate open).
// The hard right-angle at the threshold is the visual signature of a gate.

const GW = 160
const GH = 120
const GP = 12

const DB_MIN = -60
const DB_MAX = 0

function toX(db: number): number {
  return GP + ((db - DB_MIN) / (DB_MAX - DB_MIN)) * (GW - GP * 2)
}
function toY(db: number): number {
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, db))
  return GH - GP - ((clamped - DB_MIN) / (DB_MAX - DB_MIN)) * (GH - GP * 2)
}

interface GateCurveProps {
  threshold: number
  inputLevel: number
  isOpen: boolean
}

function GateCurve({ threshold, inputLevel, isOpen }: GateCurveProps) {
  // Gate transfer function:
  //  - from DB_MIN to threshold: flat at the floor
  //  - from threshold onward: 1:1 diagonal
  const STEPS = 80
  const pts: string[] = []
  for (let i = 0; i <= STEPS; i++) {
    const inDb  = DB_MIN + (i / STEPS) * (DB_MAX - DB_MIN)
    const outDb = inDb >= threshold ? inDb : DB_MIN
    pts.push(`${i === 0 ? 'M' : 'L'} ${toX(inDb).toFixed(1)},${toY(outDb).toFixed(1)}`)
  }
  const curvePath = pts.join(' ')

  // 1:1 reference line (grey dashed)
  const refPath = `M ${toX(DB_MIN).toFixed(1)},${toY(DB_MIN).toFixed(1)} L ${toX(DB_MAX).toFixed(1)},${toY(DB_MAX).toFixed(1)}`

  // Current operating point
  const clampedInput = Math.max(DB_MIN, Math.min(DB_MAX, inputLevel))
  const opX   = toX(clampedInput)
  const opY   = toY(isOpen ? clampedInput : DB_MIN)
  const hasSignal = isFinite(inputLevel) && inputLevel > DB_MIN

  const threshX = toX(threshold)
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
              x1={toX(db)} y1={GP} x2={toX(db)} y2={GH - GP}
              stroke="var(--lsc-border)" strokeWidth={db === 0 ? 1.2 : 0.8} strokeDasharray={db === 0 ? '' : '2 3'}
            />
            <line
              x1={GP} y1={toY(db)} x2={GW - GP} y2={toY(db)}
              stroke="var(--lsc-border)" strokeWidth={db === 0 ? 1.2 : 0.8} strokeDasharray={db === 0 ? '' : '2 3'}
            />
          </g>
        ))}

        {/* Axis labels */}
        <text x={GW - GP + 2} y={toY(0) + 3} fontSize="7" fill="var(--lsc-text)" opacity="0.5">0</text>
        <text x={GP} y={GH - 2} fontSize="7" fill="var(--lsc-text)" opacity="0.5" textAnchor="middle">−60</text>
        <text x={GW - GP} y={GH - 2} fontSize="7" fill="var(--lsc-text)" opacity="0.5" textAnchor="end">0 dB in</text>

        {/* Threshold line */}
        <line
          x1={threshX} y1={GP} x2={threshX} y2={GH - GP}
          stroke="rgba(216,149,72,0.55)" strokeWidth={1.5} strokeDasharray="3 2"
        />

        {/* 1:1 reference (grey dashed) */}
        <path d={refPath} fill="none" stroke="var(--lsc-text)" strokeWidth={1} strokeDasharray="3 3" opacity="0.3" />

        {/* Gate curve — floor below threshold, 1:1 above */}
        <path d={curvePath} fill="none" stroke="var(--lsc-accent)" strokeWidth={2} strokeLinecap="round" />

        {/* Operating point */}
        {hasSignal && (
          <>
            <line x1={opX} y1={GP} x2={opX} y2={opY - 5}
              stroke="rgba(91,141,232,0.5)" strokeWidth={1} />
            <circle cx={opX} cy={opY} r={4}
              fill="white" stroke={isOpen ? 'var(--signal-good)' : 'var(--lsc-text)'}
              strokeWidth="1.8" opacity={isOpen ? 1 : 0.5}
            />
          </>
        )}

        {/* OPEN / CLOSED badge on the graph */}
        <text
          x={GW - GP} y={GP + 8}
          fontSize="7" fontWeight="700"
          fill={isOpen ? 'var(--signal-good)' : 'var(--lsc-text)'}
          textAnchor="end"
          opacity={isOpen ? 1 : 0.45}
          style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
        >
          {isOpen ? 'OPEN' : 'CLOSED'}
        </text>
      </svg>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function NoiseGateNode({ id, data }: NodeProps<Node<GraphNoiseGateData>>) {
  const { stages, inputDb } = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const threshold  = (node?.params.thresholdDb as number) ?? -40
  const inputLevel = inputDb[id] ?? -Infinity
  const result     = stages[id]
  const isOpen     = isFinite(inputLevel) && inputLevel >= threshold

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="noise-gate"
      icon={<DoorClosed size={14} />}
      label={data.label ?? t.nodes['noise-gate']?.label ?? 'Noise Gate'}
      style={{ width: 220 }}
    >
      <div className="space-y-3">
        <SignalMeter db={inputLevel} health={getHealth(inputLevel)} label={t.meters.input} />

        <GateCurve threshold={threshold} inputLevel={inputLevel} isOpen={isOpen} />

        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
          <KnobControl
            value={threshold}
            min={-80}
            max={0}
            step={1}
            label={t.nodes['noise-gate']?.threshold ?? 'Threshold'}
            formatValue={(v) => `${v} dB`}
            onChange={(v) => updateNodeParams(id, { thresholdDb: v })}
            color={isOpen ? 'var(--signal-good)' : 'rgba(216,149,72,0.9)'}
            size={44}
          />
        </div>

        <SignalMeter db={result?.out ?? -Infinity} health={result?.health ?? 'too-quiet'} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
