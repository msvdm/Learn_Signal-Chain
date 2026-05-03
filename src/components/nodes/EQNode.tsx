import type { NodeProps, Node } from '@xyflow/react'
import { Activity } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { KnobControl } from '../controls/KnobControl'
import { EQInlineGraph } from '../controls/EQInlineGraph'
import { ControlSlider } from './ControlSlider'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import type { EQBand } from '../../data/nodeRegistry'
import { NODE_REGISTRY } from '../../data/nodeRegistry'
import { BAND_COLORS } from '../controls/eqMath'

const DEFAULT_BANDS = NODE_REGISTRY.eq.defaultParams.bands as EQBand[]

interface GraphEQData extends Record<string, unknown> {
  color?: string
  label?: string
}

function getBands(params: Record<string, import('../../data/nodeRegistry').NodeParamValue>): EQBand[] {
  const stored = params.bands
  if (Array.isArray(stored) && stored.length === 4) return stored as EQBand[]
  return DEFAULT_BANDS.map((b) => ({ ...b }))
}

function ShelfToggle({
  band,
  shelfType,
  onChange,
}: {
  band: EQBand
  shelfType: 'high-shelf' | 'low-shelf'
  onChange: (patch: Partial<EQBand>) => void
}) {
  const { t }   = useTranslation()
  const isShelf = band.type === shelfType
  return (
    <button
      className="nodrag nopan"
      onClick={() => onChange({ type: isShelf ? 'bell' : shelfType })}
      style={{
        fontSize: 'var(--node-text-xs)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '2px 6px',
        borderRadius: 4,
        border: `1px solid ${isShelf ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
        background: isShelf ? 'var(--lsc-accent)' : 'transparent',
        color: isShelf ? '#fff' : 'var(--lsc-fg-dim)',
        cursor: 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {isShelf ? (t.nodes.eq.shelfOn ?? 'Shelf ✓') : (t.nodes.eq.shelf ?? 'Shelf')}
    </button>
  )
}

// ── Beginner: 3 fixed-frequency gain knobs ─────────────────────────────────────

function BeginnerView({ bands, updateBand }: { bands: EQBand[]; updateBand: (i: number, patch: Partial<EQBand>) => void }) {
  const { t }          = useTranslation()
  const visibleIndices = [0, 2, 3]
  const labels         = [t.nodes.eq.bandLow, t.nodes.eq.bandMid, t.nodes.eq.bandHigh]
  return (
    <div className="space-y-3">
      <EQInlineGraph
        bands={visibleIndices.map((i) => bands[i])}
        onBandChange={(graphIdx, patch) =>
          updateBand(visibleIndices[graphIdx], { ...patch, freqHz: bands[visibleIndices[graphIdx]].freqHz })
        }
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

// ── Intermediate: 3 bands, Low/High shelf toggles, Mid has freq slider ─────────

function IntermediateView({ bands, updateBand }: { bands: EQBand[]; updateBand: (i: number, patch: Partial<EQBand>) => void }) {
  const { t }          = useTranslation()
  const visibleIndices = [0, 2, 3]
  const gainLabel      = t.nodes.eq.gain ?? 'Gain'
  return (
    <div className="space-y-2">
      <EQInlineGraph
        bands={visibleIndices.map((i) => bands[i])}
        onBandChange={(graphIdx, patch) => updateBand(visibleIndices[graphIdx], patch)}
        height={72}
      />

      <div className="rounded p-2 space-y-1" style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[var(--node-text-sm)] font-semibold" style={{ color: BAND_COLORS[0] }}>{t.nodes.eq.bandLow} · 200 Hz</span>
          <ShelfToggle band={bands[0]} shelfType="low-shelf" onChange={(p) => updateBand(0, p)} />
        </div>
        <KnobControl value={bands[0].gainDb} min={-12} max={12} step={0.5} label={gainLabel}
          formatValue={(v) => `${v >= 0 ? '+' : ''}${v}dB`} onChange={(v) => updateBand(0, { gainDb: v })}
          color={BAND_COLORS[0]} size={38} />
      </div>

      <div className="rounded p-2 space-y-1" style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}>
        <span className="text-[var(--node-text-sm)] font-semibold" style={{ color: BAND_COLORS[2] }}>
          {t.nodes.eq.bandMid} · {bands[2].freqHz >= 1000 ? `${bands[2].freqHz / 1000}k` : bands[2].freqHz} Hz
        </span>
        <div className="flex items-center gap-3">
          <KnobControl value={bands[2].gainDb} min={-12} max={12} step={0.5} label={gainLabel}
            formatValue={(v) => `${v >= 0 ? '+' : ''}${v}dB`} onChange={(v) => updateBand(2, { gainDb: v })}
            color={BAND_COLORS[2]} size={38} />
          <div className="flex-1">
            <ControlSlider value={bands[2].freqHz} min={200} max={5000} label={t.nodes.eq.frequency ?? 'Frequency'}
              formatValue={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k Hz` : `${v} Hz`}
              onChange={(v) => updateBand(2, { freqHz: v })} />
          </div>
        </div>
      </div>

      <div className="rounded p-2 space-y-1" style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[var(--node-text-sm)] font-semibold" style={{ color: BAND_COLORS[3] }}>{t.nodes.eq.bandHigh} · 8k Hz</span>
          <ShelfToggle band={bands[3]} shelfType="high-shelf" onChange={(p) => updateBand(3, p)} />
        </div>
        <KnobControl value={bands[3].gainDb} min={-12} max={12} step={0.5} label={gainLabel}
          formatValue={(v) => `${v >= 0 ? '+' : ''}${v}dB`} onChange={(v) => updateBand(3, { gainDb: v })}
          color={BAND_COLORS[3]} size={38} />
      </div>
    </div>
  )
}

// ── Advanced: 4 fully parametric bands in a 2×2 grid ──────────────────────────

const BAND_SHELF_TYPE: Array<'low-shelf' | 'high-shelf' | null> = ['low-shelf', null, null, 'high-shelf']

function AdvancedBandCell({ band, storeIndex, updateBand }: {
  band: EQBand
  storeIndex: number
  updateBand: (i: number, patch: Partial<EQBand>) => void
}) {
  const { t }       = useTranslation()
  const bandNames   = [t.nodes.eq.bandLow, t.nodes.eq.bandLoMid ?? 'Lo-Mid', t.nodes.eq.bandMid, t.nodes.eq.bandHigh]
  const isBell      = !band.type || band.type === 'bell'
  const shelfOption = BAND_SHELF_TYPE[storeIndex]
  const freqDisplay = band.freqHz >= 1000 ? `${(band.freqHz / 1000).toFixed(1)}k` : `${band.freqHz}`
  const freqMin     = [40, 200, 500, 2000][storeIndex]
  const freqMax     = [500, 1500, 5000, 16000][storeIndex]

  return (
    <div className="rounded p-2 flex flex-col gap-1" style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[var(--node-text-sm)] font-semibold" style={{ color: BAND_COLORS[storeIndex] }}>
          {bandNames[storeIndex]} · {freqDisplay} Hz
        </span>
        {shelfOption && (
          <ShelfToggle band={band} shelfType={shelfOption} onChange={(p) => updateBand(storeIndex, p)} />
        )}
      </div>
      <div className="flex items-start gap-2">
        <KnobControl value={band.gainDb} min={-12} max={12} step={0.5} label={t.nodes.eq.gain ?? 'Gain'}
          formatValue={(v) => `${v >= 0 ? '+' : ''}${v}dB`} onChange={(v) => updateBand(storeIndex, { gainDb: v })}
          color={BAND_COLORS[storeIndex]} size={34} />
        <div className="flex-1 flex flex-col gap-1">
          <ControlSlider value={band.freqHz} min={freqMin} max={freqMax} label={t.nodes.eq.freq ?? 'Freq'}
            formatValue={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k Hz` : `${v} Hz`}
            onChange={(v) => updateBand(storeIndex, { freqHz: v })} />
          {isBell && (
            <ControlSlider value={band.Q ?? 1.4} min={0.3} max={10} step={0.1} label={t.nodes.eq.widthQ ?? 'Width (Q)'}
              formatValue={(v) => v.toFixed(1)}
              onChange={(v) => updateBand(storeIndex, { Q: v })} />
          )}
        </div>
      </div>
    </div>
  )
}

function AdvancedView({ bands, updateBand }: { bands: EQBand[]; updateBand: (i: number, patch: Partial<EQBand>) => void }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <EQInlineGraph bands={bands} onBandChange={(i, patch) => updateBand(i, patch)} height={72} />
      <p className="text-[var(--node-text-xs)] text-center" style={{ color: 'var(--lsc-fg-fainter)' }}>
        {t.nodes.eq.graphHint ?? 'Drag handles on graph · Bell = peak boost/cut · Shelf = tilt all highs or lows'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {bands.map((band, i) => (
          <AdvancedBandCell key={i} band={band} storeIndex={i} updateBand={updateBand} />
        ))}
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export function EQNode({ id, data }: NodeProps<Node<GraphEQData>>) {
  const { stages, inputDb } = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const complexityLevel  = useSignalStore((s) => s.complexityLevel)
  const { t }            = useTranslation()

  const params = node?.params ?? {}
  const input  = inputDb[id] ?? -Infinity
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const bands  = getBands(params)

  const updateBand = (i: number, patch: Partial<EQBand>) => {
    const newBands: EQBand[] = bands.map((b, idx) => idx === i ? { ...b, ...patch } : b)
    updateNodeParams(id, { bands: newBands })
  }

  const isAdvanced = complexityLevel === 'advanced'

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="eq"
      icon={<Activity size={14} />}
      label={data.label ?? t.nodes.eq.label}
      accentColor={data.color}
      style={isAdvanced ? { width: 380 } : undefined}
    >
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        {complexityLevel === 'beginner' && <BeginnerView bands={bands} updateBand={updateBand} />}
        {complexityLevel === 'intermediate' && <IntermediateView bands={bands} updateBand={updateBand} />}
        {isAdvanced && <AdvancedView bands={bands} updateBand={updateBand} />}

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
