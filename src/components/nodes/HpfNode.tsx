import type { NodeProps, Node } from '@xyflow/react'
import { Filter } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { ControlSlider } from './ControlSlider'
import { useSignalStore } from '../../store/signalStore'

// ── HPF curve math ────────────────────────────────────────────────────────────

const SVG_W    = 200
const SVG_H    = 46
const FREQ_MIN = 20
const FREQ_MAX = 20000
const DB_FLOOR = -48  // bottom of graph = fully blocked

function freqToX(freq: number): number {
  return (
    ((Math.log10(freq) - Math.log10(FREQ_MIN)) /
      (Math.log10(FREQ_MAX) - Math.log10(FREQ_MIN))) *
    SVG_W
  )
}

function dbToY(db: number): number {
  return ((0 - db) / (0 - DB_FLOOR)) * SVG_H
}

// 2nd-order Butterworth HPF: −12 dB/octave below cutoff, −3 dB at cutoff
function hpfMagnitudeDb(freq: number, cutoffHz: number): number {
  const r = freq / cutoffHz
  return 20 * Math.log10((r * r) / Math.sqrt(1 + r * r * r * r))
}

function buildPath(cutoffHz: number): string {
  const pts: string[] = []
  for (let i = 0; i <= 150; i++) {
    const t    = i / 150
    const freq = Math.pow(10, t * (Math.log10(FREQ_MAX) - Math.log10(FREQ_MIN)) + Math.log10(FREQ_MIN))
    const db   = Math.max(DB_FLOOR, hpfMagnitudeDb(freq, cutoffHz))
    pts.push(`${i === 0 ? 'M' : 'L'} ${freqToX(freq).toFixed(1)},${dbToY(db).toFixed(1)}`)
  }
  return pts.join(' ')
}

// ── Log-scale slider helpers (20 Hz – 1000 Hz) ───────────────────────────────

function sliderToHz(v: number): number {
  return Math.round(20 * Math.pow(50, v / 100))
}

function hzToSlider(hz: number): number {
  return (Math.log(hz / 20) / Math.log(50)) * 100
}

// ── HPF frequency graph ───────────────────────────────────────────────────────

const FREQ_TICKS = [50, 100, 200, 500, 1000, 5000, 10000]
const DB_TICKS   = [-12, -24, -36]

function HPFGraph({ cutoffHz, bypassed }: { cutoffHz: number; bypassed: boolean }) {
  const curvePath = buildPath(bypassed ? 1 : cutoffHz)
  const cutX      = freqToX(cutoffHz)
  const zeroY     = dbToY(0)

  return (
    <div
      className="nodrag rounded overflow-hidden"
      style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}
    >
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height: SVG_H }}
      >
        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="var(--lsc-sunken)" />

        {/* dB grid lines */}
        {DB_TICKS.map((db) => (
          <line
            key={db}
            x1={0} y1={dbToY(db)} x2={SVG_W} y2={dbToY(db)}
            stroke="var(--lsc-border-mute)" strokeWidth={0.8}
          />
        ))}

        {/* Frequency grid lines */}
        {FREQ_TICKS.map((f) => (
          <line
            key={f}
            x1={freqToX(f)} y1={0} x2={freqToX(f)} y2={SVG_H}
            stroke="var(--lsc-border-mute)" strokeWidth={0.8}
          />
        ))}

        {/* 0 dB reference */}
        <line x1={0} y1={zeroY} x2={SVG_W} y2={zeroY}
          stroke="var(--lsc-fg-fainter)" strokeWidth={1} />

        {/* Blocked region fill (below the curve) */}
        <path
          d={`${curvePath} L ${SVG_W},${SVG_H} L 0,${SVG_H} Z`}
          fill={bypassed ? 'rgba(100,100,100,0.08)' : 'rgba(239,68,68,0.10)'}
        />

        {/* HPF curve */}
        <path
          d={curvePath}
          fill="none"
          stroke={bypassed ? 'var(--lsc-fg-fainter)' : 'var(--lsc-accent)'}
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* Cutoff marker — only when active */}
        {!bypassed && (
          <line
            x1={cutX} y1={0} x2={cutX} y2={SVG_H}
            stroke="var(--lsc-accent)"
            strokeWidth={1}
            strokeDasharray="3 2"
            opacity={0.6}
          />
        )}

        {/* Frequency axis labels */}
        {[100, 1000, 10000].map((f) => (
          <text
            key={f}
            x={freqToX(f)}
            y={SVG_H - 2}
            textAnchor="middle"
            fontSize={7}
            fill="var(--lsc-text-muted)"
            style={{ userSelect: 'none' }}
          >
            {f >= 1000 ? `${f / 1000}k` : f}
          </text>
        ))}

        {/* -3 dB dot at cutoff */}
        {!bypassed && (
          <circle
            cx={cutX}
            cy={dbToY(-3)}
            r={3}
            fill="var(--lsc-accent)"
            opacity={0.9}
          />
        )}
      </svg>
    </div>
  )
}

// ── Node component ────────────────────────────────────────────────────────────

interface HpfData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function HpfNode({ id, data }: NodeProps<Node<HpfData>>) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)

  const cutoffHz = (node?.params.cutoffHz as number) ?? 80
  const bypassed = node?.bypassed ?? false

  const sliderVal = hzToSlider(cutoffHz)

  function formatHz(hz: number): string {
    return hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${hz} Hz`
  }

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="hpf"
      icon={<Filter size={14} />}
      label={data.label ?? 'High-Pass Filter'}
      accentColor={data.color}
      style={{ width: 140 }}
    >
      <div className="space-y-2">
        <HPFGraph cutoffHz={cutoffHz} bypassed={bypassed} />

        <ControlSlider
          value={sliderVal}
          min={0}
          max={100}
          step={0.5}
          label="Cut below"
          formatValue={() => formatHz(cutoffHz)}
          onChange={(v) => updateNodeParams(id, { cutoffHz: sliderToHz(v) })}
        />
      </div>
    </NodeWrapper>
  )
}
