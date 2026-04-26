import type { NodeProps, Node } from '@xyflow/react'
import { Activity } from 'lucide-react'
import { NodeWrapper, ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { KnobControl } from '../controls/KnobControl'
import { EQInlineGraph } from '../controls/EQInlineGraph'
import { useMultiChannelSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import type { ChannelNodeData } from './nodeTypes'
import type { EQBand } from '../../store/signalStore'
import { BAND_COLORS } from '../controls/eqMath'

// Band layout: 0=Low(200Hz), 1=LoMid(500Hz), 2=Mid(1kHz), 3=High(8kHz)
// Beginner + Intermediate show bands 0, 2, 3. Advanced shows all 4.

function ShelfToggle({
  band,
  shelfType,
  onChange,
}: {
  band: EQBand
  shelfType: 'high-shelf' | 'low-shelf'
  onChange: (patch: Partial<EQBand>) => void
}) {
  const isShelf = band.type === shelfType
  return (
    <button
      className="nodrag nopan"
      onClick={() => onChange({ type: isShelf ? 'bell' : shelfType })}
      style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '2px 6px',
        borderRadius: 4,
        border: `1px solid ${isShelf ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
        background: isShelf ? 'var(--lsc-accent)' : 'transparent',
        color: isShelf ? '#fff' : 'var(--lsc-text)',
        cursor: 'pointer',
        transition: 'all 0.12s',
      }}
      title={isShelf ? 'Switch to Bell (peaking)' : `Switch to Shelf (tilts all freqs above/below)`}
    >
      {isShelf ? 'Shelf ✓' : 'Shelf'}
    </button>
  )
}

// ── Beginner: 3 fixed-frequency knobs ──────────────────────────────────────────

function BeginnerView({
  bands,
  updateBand,
}: {
  bands: EQBand[]
  updateBand: (storeIndex: number, patch: Partial<EQBand>) => void
}) {
  const visibleIndices = [0, 2, 3]
  const visibleBands = visibleIndices.map((i) => bands[i])
  const labels = ['Low', 'Mid', 'High']

  return (
    <div className="space-y-3">
      <EQInlineGraph
        bands={visibleBands}
        onBandChange={(graphIdx, patch) => updateBand(visibleIndices[graphIdx], { ...patch, freqHz: bands[visibleIndices[graphIdx]].freqHz })}
        height={64}
      />
      <div className="flex justify-around py-1">
        {visibleIndices.map((storeIdx, i) => (
          <KnobControl
            key={storeIdx}
            value={bands[storeIdx].gainDb}
            min={-12}
            max={12}
            step={0.5}
            label={labels[i]}
            formatValue={(v) => `${v >= 0 ? '+' : ''}${v}dB`}
            onChange={(v) => updateBand(storeIdx, { gainDb: v })}
            color={BAND_COLORS[storeIdx]}
            size={42}
          />
        ))}
      </div>
    </div>
  )
}

// ── Intermediate: 3 bands, Low/High have shelf toggle, Mid has freq slider ─────

function IntermediateView({
  bands,
  updateBand,
}: {
  bands: EQBand[]
  updateBand: (storeIndex: number, patch: Partial<EQBand>) => void
}) {
  const visibleIndices = [0, 2, 3]
  const visibleBands = visibleIndices.map((i) => bands[i])

  return (
    <div className="space-y-2">
      <EQInlineGraph
        bands={visibleBands}
        onBandChange={(graphIdx, patch) => updateBand(visibleIndices[graphIdx], patch)}
        height={72}
      />

      {/* Low band */}
      <div
        className="rounded p-2 space-y-1"
        style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold" style={{ color: BAND_COLORS[0] }}>Low · 200 Hz</span>
          <ShelfToggle band={bands[0]} shelfType="low-shelf" onChange={(p) => updateBand(0, p)} />
        </div>
        <KnobControl
          value={bands[0].gainDb}
          min={-12} max={12} step={0.5}
          label="Gain"
          formatValue={(v) => `${v >= 0 ? '+' : ''}${v}dB`}
          onChange={(v) => updateBand(0, { gainDb: v })}
          color={BAND_COLORS[0]}
          size={38}
        />
      </div>

      {/* Mid band */}
      <div
        className="rounded p-2 space-y-1"
        style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}
      >
        <span className="text-[10px] font-semibold" style={{ color: BAND_COLORS[2] }}>
          Mid · {bands[2].freqHz >= 1000 ? `${bands[2].freqHz / 1000}k` : bands[2].freqHz} Hz
        </span>
        <div className="flex items-center gap-3">
          <KnobControl
            value={bands[2].gainDb}
            min={-12} max={12} step={0.5}
            label="Gain"
            formatValue={(v) => `${v >= 0 ? '+' : ''}${v}dB`}
            onChange={(v) => updateBand(2, { gainDb: v })}
            color={BAND_COLORS[2]}
            size={38}
          />
          <div className="flex-1">
            <ControlSlider
              value={bands[2].freqHz}
              min={200}
              max={5000}
              label="Frequency"
              formatValue={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k Hz` : `${v} Hz`}
              onChange={(v) => updateBand(2, { freqHz: v })}
            />
          </div>
        </div>
      </div>

      {/* High band */}
      <div
        className="rounded p-2 space-y-1"
        style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold" style={{ color: BAND_COLORS[3] }}>High · 8k Hz</span>
          <ShelfToggle band={bands[3]} shelfType="high-shelf" onChange={(p) => updateBand(3, p)} />
        </div>
        <KnobControl
          value={bands[3].gainDb}
          min={-12} max={12} step={0.5}
          label="Gain"
          formatValue={(v) => `${v >= 0 ? '+' : ''}${v}dB`}
          onChange={(v) => updateBand(3, { gainDb: v })}
          color={BAND_COLORS[3]}
          size={38}
        />
      </div>
    </div>
  )
}

// ── Advanced: 4 fully parametric bands, horizontal 2×2 layout ─────────────────

const BAND_NAMES = ['Low', 'Lo-Mid', 'Mid', 'High']

// Band 0 (Low) → only lo-shelf makes sense; Band 3 (High) → only hi-shelf
const BAND_SHELF_TYPE: Array<'low-shelf' | 'high-shelf' | null> = [
  'low-shelf', null, null, 'high-shelf',
]

function AdvancedBandCell({
  band,
  storeIndex,
  updateBand,
}: {
  band: EQBand
  storeIndex: number
  updateBand: (storeIndex: number, patch: Partial<EQBand>) => void
}) {
  const isBell = !band.type || band.type === 'bell'
  const shelfOption = BAND_SHELF_TYPE[storeIndex]
  const freqDisplay = band.freqHz >= 1000
    ? `${(band.freqHz / 1000).toFixed(1)}k`
    : `${band.freqHz}`

  return (
    <div
      className="rounded p-2 flex flex-col gap-1"
      style={{ background: 'var(--lsc-sunken)', border: `1px solid var(--lsc-border)` }}
    >
      {/* Band header: name + shelf toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold" style={{ color: BAND_COLORS[storeIndex] }}>
          {BAND_NAMES[storeIndex]} · {freqDisplay} Hz
        </span>
        {shelfOption && (
          <ShelfToggle
            band={band}
            shelfType={shelfOption}
            onChange={(p) => updateBand(storeIndex, p)}
          />
        )}
      </div>

      {/* Gain knob + sliders */}
      <div className="flex items-start gap-2">
        <KnobControl
          value={band.gainDb}
          min={-12} max={12} step={0.5}
          label="Gain"
          formatValue={(v) => `${v >= 0 ? '+' : ''}${v}dB`}
          onChange={(v) => updateBand(storeIndex, { gainDb: v })}
          color={BAND_COLORS[storeIndex]}
          size={34}
        />
        <div className="flex-1 flex flex-col gap-1">
          <ControlSlider
            value={band.freqHz}
            min={storeIndex === 0 ? 40 : storeIndex === 1 ? 200 : storeIndex === 2 ? 500 : 2000}
            max={storeIndex === 0 ? 500 : storeIndex === 1 ? 1500 : storeIndex === 2 ? 5000 : 16000}
            label="Freq"
            formatValue={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k Hz` : `${v} Hz`}
            onChange={(v) => updateBand(storeIndex, { freqHz: v })}
          />
          {isBell && (
            <ControlSlider
              value={band.Q ?? 1.4}
              min={0.3}
              max={10}
              step={0.1}
              label="Width (Q)"
              formatValue={(v) => v.toFixed(1)}
              onChange={(v) => updateBand(storeIndex, { Q: v })}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function AdvancedView({
  bands,
  updateBand,
}: {
  bands: EQBand[]
  updateBand: (storeIndex: number, patch: Partial<EQBand>) => void
}) {
  return (
    <div className="space-y-2">
      <EQInlineGraph
        bands={bands}
        onBandChange={(i, patch) => updateBand(i, patch)}
        height={72}
      />
      <div className="text-[9px] text-center" style={{ color: 'var(--lsc-text)' }}>
        Drag handles on graph · Bell = peak boost/cut · Shelf = tilt all highs or lows
      </div>

      {/* 2×2 grid */}
      <div className="grid grid-cols-2 gap-2">
        {bands.map((band, i) => (
          <AdvancedBandCell
            key={i}
            band={band}
            storeIndex={i}
            updateBand={updateBand}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ParamEQNode({ id, data }: NodeProps<Node<ChannelNodeData>>) {
  const { allStages, allInputDb } = useMultiChannelSignal()
  const channel = useSignalStore((s) => s.channels.find((c) => c.id === data.channelId))
  const updateChannelEQBand = useSignalStore((s) => s.updateChannelEQBand)
  const complexityLevel = useSignalStore((s) => s.complexityLevel)
  const { t } = useTranslation()

  const nodeState = channel?.nodeState
  const input = allInputDb[id] ?? -Infinity
  const result = allStages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  if (!nodeState) return null

  const isAdvanced = complexityLevel === 'advanced' || complexityLevel === 'routing-madness'
  const updateBand = (storeIndex: number, patch: Partial<EQBand>) =>
    updateChannelEQBand(data.channelId, storeIndex, patch)

  return (
    <NodeWrapper
      nodeId={id}
      channelId={data.channelId}
      typeKey="eq"
      accentColor={data.color}
      icon={<Activity size={14} />}
      label={t.nodes.eq.label}
      style={isAdvanced ? { width: 380 } : undefined}
    >
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        {complexityLevel === 'beginner' && (
          <BeginnerView bands={nodeState.eqBands} updateBand={updateBand} />
        )}
        {complexityLevel === 'intermediate' && (
          <IntermediateView bands={nodeState.eqBands} updateBand={updateBand} />
        )}
        {isAdvanced && (
          <AdvancedView bands={nodeState.eqBands} updateBand={updateBand} />
        )}

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
