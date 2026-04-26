import type { NodeProps, Node } from '@xyflow/react'
import { NodeWrapper, ControlSlider } from './NodeWrapper'

// Standard HPF frequency-response symbol: attenuated on the left, flat pass-band on the right
function HPFIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 12"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M 1,11 C 3,11 6,2 9,2 L 15,2" />
    </svg>
  )
}
import { SignalMeter } from '../SignalMeter'
import { useMultiChannelSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import type { ChannelNodeData } from './nodeTypes'
import { freqToX, SVG_W, SVG_H } from '../controls/eqMath'

function HPFCurve({ cutoffHz }: { cutoffHz: number }) {
  // Use the full SVG height: pass band sits at the TOP, cut region falls to the BOTTOM.
  // This matches every textbook HPF frequency-response graph.
  const TOP_Y = SVG_H * 0.08   // 0 dB reference — flat pass band near top
  const BOT_Y = SVG_H * 0.93   // maximum attenuation near bottom

  const cx = freqToX(cutoffHz)
  const points: string[] = []
  const SAMPLES = 200
  const FREQ_MIN = 20
  const FREQ_MAX = 20000

  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const freq = Math.pow(10, t * (Math.log10(FREQ_MAX) - Math.log10(FREQ_MIN)) + Math.log10(FREQ_MIN))
    const x = freqToX(freq)
    let y: number
    if (freq >= cutoffHz) {
      y = TOP_Y  // pass band: flat at top
    } else {
      // Exponential roll-off — curve plunges from TOP_Y toward BOT_Y as freq drops below cutoff.
      // k=1.8 ≈ 12 dB/oct visually: ~85% of the way to the floor within 1 octave.
      const octavesBelow = Math.log2(cutoffHz / freq)
      y = BOT_Y - (BOT_Y - TOP_Y) * Math.exp(-1.8 * octavesBelow)
    }
    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`)
  }
  const curvePath = points.join(' ')

  return (
    <div
      className="nodrag rounded-md overflow-hidden"
      style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}
    >
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height: 56 }}
      >
        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="var(--lsc-sunken)" />
        {/* 0 dB reference line at top */}
        <line x1={0} y1={TOP_Y} x2={SVG_W} y2={TOP_Y}
          stroke="var(--lsc-fg-fainter)" strokeWidth={1} />
        {/* Fill under the curve — shows the signal that passes through */}
        <path
          d={`${curvePath} L ${SVG_W},${BOT_Y} L 0,${BOT_Y} Z`}
          fill="rgba(99,102,241,0.12)"
        />
        {/* Curve */}
        <path
          d={curvePath}
          fill="none"
          stroke="var(--lsc-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Cutoff marker */}
        <line x1={cx} y1={0} x2={cx} y2={SVG_H}
          stroke="var(--lsc-accent)" strokeWidth={1} strokeDasharray="3 2" opacity={0.6} />
      </svg>
    </div>
  )
}

export function HPFNode({ id, data }: NodeProps<Node<ChannelNodeData>>) {
  const { allStages, allInputDb } = useMultiChannelSignal()
  const channel = useSignalStore((s) => s.channels.find((c) => c.id === data.channelId))
  const updateChannelNodeState = useSignalStore((s) => s.updateChannelNodeState)
  const { t } = useTranslation()

  const nodeState = channel?.nodeState
  const input = allInputDb[id] ?? -Infinity
  const result = allStages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  if (!nodeState) return null

  return (
    <NodeWrapper
      nodeId={id}
      channelId={data.channelId}
      typeKey="hpf"
      accentColor={data.color}
      icon={<HPFIcon size={14} />}
      label={t.nodes.hpf.label}
    >
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        <HPFCurve cutoffHz={nodeState.eqHpfHz} />

        <ControlSlider
          value={nodeState.eqHpfHz}
          min={20}
          max={500}
          label={t.nodes.hpf.cutoff}
          formatValue={(v) => `${v} Hz`}
          onChange={(v) => updateChannelNodeState(data.channelId, { eqHpfHz: v })}
        />

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
