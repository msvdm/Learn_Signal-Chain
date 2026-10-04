import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { ControlSlider } from './ControlSlider'
import { widestFormat } from '../../utils/readout'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useTranslation } from '../../i18n/useTranslation'

// ── HPF curve math ────────────────────────────────────────────────────────────

const SVG_W    = 160   // viewBox width; the graph stretches to the card width
const SVG_H    = 52
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

const TOP_PAD = 10  // keep the flat pass band clear of the box edge

function dbToY(db: number): number {
  return TOP_PAD + ((0 - db) / (0 - DB_FLOOR)) * (SVG_H - TOP_PAD)
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

function HPFGraph({ cutoffHz, bypassed }: { cutoffHz: number; bypassed: boolean }) {
  const curvePath = buildPath(bypassed ? 1 : cutoffHz)
  const cutX      = freqToX(cutoffHz)
  const stroke    = bypassed ? 'var(--lsc-fg-fainter)' : 'var(--signal-good)'

  return (
    <div
      className="nodrag"
      style={{
        minWidth: SVG_W, borderRadius: 8, overflow: 'hidden',
        background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border-soft)',
      }}
    >
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width="100%" height={SVG_H} preserveAspectRatio="none" style={{ display: 'block' }}>
        {/* Pass band — everything under the curve gets through */}
        <path
          d={`${curvePath} L ${SVG_W},${SVG_H} L 0,${SVG_H} Z`}
          fill={bypassed ? 'transparent' : 'var(--signal-good-bg)'}
        />

        {/* HPF curve */}
        <path d={curvePath} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />

        {/* Cutoff marker — only when active */}
        {!bypassed && (
          <line
            x1={cutX} y1={4} x2={cutX} y2={SVG_H}
            stroke="var(--lsc-fg-muted)"
            strokeWidth={1}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  )
}

// ── Node component ────────────────────────────────────────────────────────────

export function HpfNode({ id }: CardProps) {
  const p                = useParams(id, 'hpf')
  const bypassed         = useSignalStore((s) => s.nodes.find((n) => n.id === id)?.bypassed ?? false)
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const cutoffHz = p('cutoffHz')

  const sliderVal = hzToSlider(cutoffHz)

  function formatHz(hz: number): string {
    return hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${hz} Hz`
  }

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="hpf"
      label={useNodeName(id, 'hpf')}
    >
      <div className="space-y-2">
        <HPFGraph cutoffHz={cutoffHz} bypassed={bypassed} />

        <ControlSlider
          value={sliderVal}
          min={0}
          max={100}
          step={0.5}
          label={t.nodes.hpf.cutoff}
          formatValue={() => formatHz(cutoffHz)}
          reserve={[widestFormat(0, 100, 0.5, (v) => formatHz(sliderToHz(v)))]}
          onChange={(v) => updateNodeParams(id, { cutoffHz: sliderToHz(v) })}
        />
      </div>
    </NodeWrapper>
  )
}
