import type { NodeProps, Node } from '@xyflow/react'
import { DoorClosed } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import type { CompressorResult } from '../../hooks/useSignalChain'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { twoColumns } from '../../utils/twoColumns'
import { KnobStack, ReductionReadout } from './DynamicsLayout'

interface GraphNoiseGateData extends Record<string, unknown> {
  color?: string
  label?: string
}

// ── Gate transfer-function graph ──────────────────────────────────────────────
// X = input level, Y = output level.
// Below threshold: output is the floor (gate closed = silence).
// At and above threshold: output = input (1:1, gate open).
// The hard right-angle at the threshold is the visual signature of a gate.

const GW = 168   // SVG canvas width (px — drawn 1:1; with its border the box fills the 170px column)
const GH = 112
const GP = 14    // padding inside SVG

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
  /** How far it turns down when closed (negative dB) */
  range: number
  inputLevel: number
  isOpen: boolean
  openLabel: string
  closedLabel: string
}

function GateCurve({ threshold, range, inputLevel, isOpen, openLabel, closedLabel }: GateCurveProps) {
  // Gate transfer function:
  //  - below the threshold: turned down by the range (a line under the 1:1, or the floor)
  //  - from threshold onward: 1:1 diagonal
  const STEPS = 80
  const pts: string[] = []
  for (let i = 0; i <= STEPS; i++) {
    const inDb  = DB_MIN + (i / STEPS) * (DB_MAX - DB_MIN)
    const outDb = inDb >= threshold ? inDb : inDb + range
    pts.push(`${i === 0 ? 'M' : 'L'} ${toX(inDb).toFixed(1)},${toY(outDb).toFixed(1)}`)
  }
  const curvePath = pts.join(' ')

  // 1:1 reference line (grey dashed)
  const refPath = `M ${toX(DB_MIN).toFixed(1)},${toY(DB_MIN).toFixed(1)} L ${toX(DB_MAX).toFixed(1)},${toY(DB_MAX).toFixed(1)}`

  // Current operating point
  const clampedInput = Math.max(DB_MIN, Math.min(DB_MAX, inputLevel))
  const opX   = toX(clampedInput)
  const opY   = toY(isOpen ? clampedInput : clampedInput + range)
  const hasSignal = isFinite(inputLevel) && inputLevel > DB_MIN

  const threshX = toX(threshold)
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
        <text x={GW - GP + 2} y={toY(0) + 3} fontSize="11" fill="var(--lsc-fg-muted)">0</text>
        <text x={GP} y={GH - 2} fontSize="11" fill="var(--lsc-fg-muted)" textAnchor="middle">−60</text>
        <text x={GW - GP} y={GH - 2} fontSize="11" fill="var(--lsc-fg-muted)" textAnchor="end">0 dB in</text>

        {/* Threshold line */}
        <line
          x1={threshX} y1={GP} x2={threshX} y2={GH - GP}
          stroke="var(--signal-hot)" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="3 2"
        />

        {/* 1:1 reference (grey dashed) */}
        <path d={refPath} fill="none" stroke="var(--lsc-fg)" strokeWidth={1} strokeDasharray="3 3" opacity="0.3" />

        {/* Gate curve — floor below threshold, 1:1 above */}
        <path d={curvePath} fill="none" stroke="var(--lsc-accent)" strokeWidth={2} strokeLinecap="round" />

        {/* Operating point */}
        {hasSignal && (
          <>
            <line x1={opX} y1={GP} x2={opX} y2={opY - 5}
              stroke="var(--signal-too-quiet)" strokeOpacity={0.5} strokeWidth={1} />
            <circle cx={opX} cy={opY} r={4}
              fill="var(--lsc-node-bg)" stroke={isOpen ? 'var(--signal-good)' : 'var(--lsc-fg)'}
              strokeWidth="1.8" opacity={isOpen ? 1 : 0.5}
            />
          </>
        )}

        {/* OPEN / CLOSED badge on the graph */}
        <text
          x={GW - GP} y={GP + 8}
          fontSize="11" fontWeight="700"
          fill={isOpen ? 'var(--signal-good)' : 'var(--lsc-fg)'}
          textAnchor="end"
          opacity={isOpen ? 1 : 0.45}
          style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
        >
          {isOpen ? openLabel : closedLabel}
        </text>
      </svg>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function NoiseGateNode({ id, data }: NodeProps<Node<GraphNoiseGateData>>) {
  const { stages }       = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()
  const tg               = t.nodes['noise-gate']

  const params     = node?.params ?? {}
  const threshold  = (params.thresholdDb as number) ?? -40
  const range      = (params.rangeDb as number) ?? -80
  // Shown and stored, but timings are not part of the sound yet
  const holdMs     = (params.holdMs as number) ?? 50
  const attackMs   = (params.attackMs as number) ?? 1
  const releaseMs  = (params.releaseMs as number) ?? 100
  const levels     = useStereoLevels(id)
  const inputLevel = levels.inPeak
  const result     = stages[id] as CompressorResult | undefined
  const isOpen     = isFinite(inputLevel) && inputLevel >= threshold

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="noise-gate"
      icon={<DoorClosed size={16} />}
      label={data.label ?? tg?.label ?? 'Noise Gate'}
    >
      <div style={twoColumns}>
        <SignalMeter db={levels.in} dbR={levels.inR} health={getHealth(levels.inPeak)} label={t.meters.input} />
        <SignalMeter db={levels.out} dbR={levels.outR} health={result?.health ?? 'too-quiet'} label={t.meters.output} />

        <KnobStack>
          <KnobControl
            value={threshold}
            min={-80}
            max={0}
            step={1}
            label={tg?.threshold ?? 'Threshold'}
            formatValue={(v) => `${v} dB`}
            onChange={(v) => updateNodeParams(id, { thresholdDb: v })}
            color={isOpen ? 'var(--signal-good)' : 'var(--signal-hot)'}
            size={44}
            layout="side"
          />
          {/* How far it turns down when closed: −80 dB = silence */}
          <KnobControl
            value={range}
            min={-80}
            max={0}
            step={1}
            label={tg?.range ?? 'Range'}
            formatValue={(v) => `${v} dB`}
            onChange={(v) => updateNodeParams(id, { rangeDb: v })}
            color="var(--signal-hot)"
            size={44}
            layout="side"
          />
          <KnobControl
            value={holdMs}
            min={0}
            max={500}
            step={5}
            label={tg?.hold ?? 'Hold'}
            formatValue={(v) => `${v} ms`}
            onChange={(v) => updateNodeParams(id, { holdMs: v })}
            color="var(--lsc-accent)"
            size={44}
            layout="side"
          />
        </KnobStack>

        <div>
          <GateCurve
            threshold={threshold}
            range={range}
            inputLevel={inputLevel}
            isOpen={isOpen}
            openLabel={tg?.statusOpen ?? 'Open'}
            closedLabel={tg?.statusClosed ?? 'Closed'}
          />
          <ReductionReadout db={result?.gainReductionDb ?? 0} maxDb={80} label={t.nodes.comp.turningDown} style={{ marginTop: 12 }} />
        </div>

        {/* How fast it opens (Attack) and closes again (Release) */}
        <KnobControl
          value={attackMs}
          min={1}
          max={50}
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
