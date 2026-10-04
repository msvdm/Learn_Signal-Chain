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

interface GraphCompData extends Record<string, unknown> {
  color?: string
  label?: string
}

// ── Dynamics transfer-function graph ─────────────────────────────────────────
// Classic compressor visualization: X = input level, Y = output level.
// Below threshold: 1:1 diagonal (unity gain). Above: shallower slope = compression.
// The gap between the 1:1 reference line and the curve = gain reduction.

const GW = 168   // SVG canvas width (px — drawn 1:1; with its border the box fills the 170px column)
const GH = 112   // SVG canvas height
const GP = 14    // padding inside SVG

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
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox={`0 0 ${GW} ${GH}`}
        width={GW}
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
        <text x={GW - GP + 2} y={outputY(0) + 3} fontSize="11" fill="var(--lsc-fg-muted)">0</text>
        <text x={GP} y={GH - 2} fontSize="11" fill="var(--lsc-fg-muted)" textAnchor="middle">−60</text>
        <text x={GW - GP} y={GH - 2} fontSize="11" fill="var(--lsc-fg-muted)" textAnchor="end">0 dB in</text>

        {/* Threshold line */}
        <line
          x1={threshX} y1={GP} x2={threshX} y2={GH - GP}
          stroke="var(--signal-hot)" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="3 2"
        />

        {/* 1:1 reference (grey dashed) */}
        <path d={refPts} fill="none" stroke="var(--lsc-fg)" strokeWidth={1} strokeDasharray="3 3" opacity="0.3" />

        {/* Compression curve */}
        <path d={curvePath} fill="none" stroke="var(--lsc-accent)" strokeWidth={2} strokeLinecap="round" />

        {/* Operating point — shows where the current signal sits */}
        {hasSignal && (
          <>
            <line x1={opX} y1={GP} x2={opX} y2={outputY(opOutDb) - 5}
              stroke="var(--signal-too-quiet)" strokeOpacity={0.5} strokeWidth={1} />
            <circle cx={opX} cy={opY} r={4} fill="var(--lsc-node-bg)" stroke="var(--lsc-accent)" strokeWidth="1.8" />
          </>
        )}
      </svg>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CompressorNode({ id, data }: NodeProps<Node<GraphCompData>>) {
  const { stages }          = useGraphSignal()
  const p                = useParams(id, 'comp')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const levels      = useStereoLevels(id)
  const input       = levels.inPeak
  const result      = stages[id]
  const threshold   = p('thresholdDb')
  const ratio       = p('ratio')
  const makeupGain  = p('makeupGainDb')
  // Shown and stored, but not part of the sound yet
  const attackMs    = p('attackMs')
  const releaseMs   = p('releaseMs')
  const gainReduction = result?.gainReductionDb ?? 0

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="comp"
      label={data.label ?? t.nodes.comp.label}
    >
      <div style={twoColumns}>
        <SignalMeter db={levels.in} dbR={levels.inR} health={getHealth(levels.inPeak, levels.inDomain)} domain={levels.inDomain} label={t.meters.input} />
        <SignalMeter db={levels.out} dbR={levels.outR} domain={levels.outDomain} health={result?.health ?? 'too-quiet'} label={t.meters.output} />

        <KnobStack>
          <KnobControl
            value={threshold}
            min={-60}
            max={0}
            step={0.5}
            label={t.nodes.comp.threshold}
            formatValue={(v) => `${v} dB`}
            onChange={(v) => updateNodeParams(id, { thresholdDb: v })}
            color="var(--signal-hot)"
            size={44}
            layout="side"
          />
          <KnobControl
            value={ratio}
            min={1}
            max={20}
            step={0.5}
            label={t.nodes.comp.ratio}
            formatValue={(v) => `${v}:1`}
            onChange={(v) => updateNodeParams(id, { ratio: v })}
            color="var(--lsc-accent)"
            size={44}
            layout="side"
          />
          <KnobControl
            value={makeupGain}
            min={0}
            max={20}
            step={0.5}
            label={t.nodes.comp.makeupGain}
            formatValue={(v) => `+${v} dB`}
            onChange={(v) => updateNodeParams(id, { makeupGainDb: v })}
            color="var(--signal-good)"
            size={44}
            layout="side"
          />
        </KnobStack>

        <div>
          <DynamicsCurve
            threshold={threshold}
            ratio={ratio}
            makeupGain={makeupGain}
            inputLevel={input}
            gainReduction={gainReduction}
          />
          <ReductionReadout db={gainReduction} maxDb={20} label={t.nodes.comp.turningDown} style={{ marginTop: 12 }} />
        </div>

        {/* How fast it starts turning down (Attack) and lets go again (Release) */}
        <KnobControl
          value={attackMs}
          min={1}
          max={100}
          step={1}
          label={t.nodes.comp.attack}
          formatValue={(v) => `${v} ms`}
          onChange={(v) => updateNodeParams(id, { attackMs: v })}
          color="var(--lsc-accent)"
          size={44}
          layout="side"
        />
        <KnobControl
          value={releaseMs}
          min={10}
          max={1000}
          step={10}
          label={t.nodes.comp.release}
          formatValue={(v) => `${v} ms`}
          onChange={(v) => updateNodeParams(id, { releaseMs: v })}
          color="var(--lsc-accent)"
          size={44}
          layout="side"
        />
      </div>
    </NodeWrapper>
  )
}
