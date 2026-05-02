import type { NodeProps, Node } from '@xyflow/react'
import { Box } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import type { CompressorResult } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'

interface GraphCompData extends Record<string, unknown> {
  color?: string
  label?: string
}

// ── Dynamics transfer-function graph ─────────────────────────────────────────
// Classic compressor visualization: X = input level, Y = output level.
// Below threshold: 1:1 diagonal (unity gain). Above: shallower slope = compression.
// The gap between the 1:1 reference line and the curve = gain reduction.

const GW = 160   // SVG canvas width
const GH = 120   // SVG canvas height
const GP = 12    // padding inside SVG

// Input/output range shown on axes (dBFS)
const DB_IN_MIN = -60
const DB_IN_MAX = 0
const DB_OUT_MIN = -60
const DB_OUT_MAX = 20   // headroom for makeup gain

function inputX(db: number): number {
  return GP + ((db - DB_IN_MIN) / (DB_IN_MAX - DB_IN_MIN)) * (GW - GP * 2)
}
function outputY(db: number): number {
  const clamped = Math.max(DB_OUT_MIN, Math.min(DB_OUT_MAX, db))
  return GH - GP - ((clamped - DB_OUT_MIN) / (DB_OUT_MAX - DB_OUT_MIN)) * (GH - GP * 2)
}

interface DynamicsCurveProps {
  threshold: number
  ratio: number
  makeupGain: number
  inputLevel: number
  gainReduction: number
}

function DynamicsCurve({ threshold, ratio, makeupGain, inputLevel, gainReduction }: DynamicsCurveProps) {
  // Build the transfer-function path
  const pts: string[] = []
  const STEPS = 80
  for (let i = 0; i <= STEPS; i++) {
    const inDb = DB_IN_MIN + (i / STEPS) * (DB_IN_MAX - DB_IN_MIN)
    let outDb: number
    if (inDb <= threshold) {
      outDb = inDb + makeupGain
    } else {
      const gr = (inDb - threshold) * (1 - 1 / ratio)
      outDb = inDb - gr + makeupGain
    }
    pts.push(`${i === 0 ? 'M' : 'L'} ${inputX(inDb).toFixed(1)},${outputY(outDb).toFixed(1)}`)
  }
  const curvePath = pts.join(' ')

  // Reference 1:1 line (unity, no makeup)
  const refPts = [
    `M ${inputX(DB_IN_MIN).toFixed(1)},${outputY(DB_IN_MIN).toFixed(1)}`,
    `L ${inputX(0).toFixed(1)},${outputY(0).toFixed(1)}`,
  ].join(' ')

  // Current operating point
  const opX = inputX(Math.max(DB_IN_MIN, Math.min(DB_IN_MAX, inputLevel)))
  const opOutDb = inputLevel <= threshold
    ? inputLevel + makeupGain
    : inputLevel - gainReduction + makeupGain
  const opY = outputY(opOutDb)
  const hasSignal = isFinite(inputLevel) && inputLevel > DB_IN_MIN

  // Threshold vertical marker
  const threshX = inputX(threshold)

  // Grid lines
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
      <svg
        viewBox={`0 0 ${GW} ${GH}`}
        width="100%"
        height={GH}
        style={{ display: 'block' }}
      >
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

        {/* Threshold line */}
        <line
          x1={threshX} y1={GP} x2={threshX} y2={GH - GP}
          stroke="rgba(216,149,72,0.55)" strokeWidth={1.5} strokeDasharray="3 2"
        />

        {/* 1:1 reference (grey dashed) */}
        <path d={refPts} fill="none" stroke="var(--lsc-text)" strokeWidth={1} strokeDasharray="3 3" opacity="0.3" />

        {/* Compression curve */}
        <path d={curvePath} fill="none" stroke="var(--lsc-accent)" strokeWidth={2} strokeLinecap="round" />

        {/* Operating point — shows where the current signal sits */}
        {hasSignal && (
          <>
            <line x1={opX} y1={GP} x2={opX} y2={outputY(opOutDb) - 5}
              stroke="rgba(91,141,232,0.5)" strokeWidth={1} />
            <circle cx={opX} cy={opY} r={4} fill="white" stroke="var(--lsc-accent)" strokeWidth="1.8" />
          </>
        )}
      </svg>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CompressorNode({ id, data }: NodeProps<Node<GraphCompData>>) {
  const { stages, inputDb } = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)

  const params      = node?.params ?? {}
  const input       = inputDb[id] ?? -Infinity
  const result      = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const, gainReductionDb: 0 }
  const compResult  = result as CompressorResult
  const threshold   = (params.thresholdDb as number) ?? -20
  const ratio       = (params.ratio as number) ?? 2
  const makeupGain  = (params.makeupGainDb as number) ?? 0
  const gainReduction = compResult.gainReductionDb ?? 0

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="comp"
      icon={<Box size={14} />}
      label={data.label ?? 'Compressor'}
      accentColor={data.color}
      style={{ width: 220 }}
    >
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label="Input" />

        <DynamicsCurve
          threshold={threshold}
          ratio={ratio}
          makeupGain={makeupGain}
          inputLevel={input}
          gainReduction={gainReduction}
        />

        {/* Knob row */}
        <div style={{ display: 'flex', justifyContent: 'space-around', paddingTop: 2 }}>
          <KnobControl
            value={threshold}
            min={-60}
            max={0}
            step={0.5}
            label="Threshold"
            formatValue={(v) => `${v} dB`}
            onChange={(v) => updateNodeParams(id, { thresholdDb: v })}
            color="var(--signal-hot)"
            size={44}
          />
          <KnobControl
            value={ratio}
            min={1}
            max={20}
            step={0.5}
            label="Ratio"
            formatValue={(v) => `${v}:1`}
            onChange={(v) => updateNodeParams(id, { ratio: v })}
            color="var(--lsc-accent)"
            size={44}
          />
          <KnobControl
            value={makeupGain}
            min={0}
            max={20}
            step={0.5}
            label="Makeup"
            formatValue={(v) => `+${v} dB`}
            onChange={(v) => updateNodeParams(id, { makeupGainDb: v })}
            color="var(--signal-good)"
            size={44}
          />
        </div>

        {/* GR meter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: 'var(--lsc-text)', opacity: 0.6, whiteSpace: 'nowrap' }}>
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
          <span style={{ fontSize: 9, fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-text)', minWidth: 28, textAlign: 'right' }}>
            {gainReduction > 0 ? `−${gainReduction.toFixed(1)}` : '0.0'}
          </span>
        </div>

        <SignalMeter db={result.out} health={result.health} label="Output" />
      </div>
    </NodeWrapper>
  )
}
