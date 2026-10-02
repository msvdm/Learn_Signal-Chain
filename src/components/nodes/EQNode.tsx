import type { NodeProps, Node } from '@xyflow/react'
import { Activity } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { KnobControl } from '../controls/KnobControl'
import { EQGraph, type GraphBand } from '../controls/EQGraph'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import type { EQBand, NodeParamValue } from '../../data/nodeRegistry'
import { NODE_REGISTRY } from '../../data/nodeRegistry'
import type { Translations } from '../../i18n/translations'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import {
  BAND_COLORS, DB_MIN, DB_MAX, Q_MIN, Q_MAX,
  isShelf, formatFreq, formatGain,
} from '../controls/eqMath'

const DEFAULT_BANDS = NODE_REGISTRY.eq.defaultParams.bands as EQBand[]

/**
 * Body width and graph height of the Advanced card. Fixed sizes: dragging a band or changing
 * a value never resizes the card. Each band cell is wide enough for its longest values.
 */
const BODY_W  = 640
const GRAPH_H = 170

interface GraphEQData extends Record<string, unknown> {
  color?: string
  label?: string
}

/** One band as shown on this level. */
interface BandSpec {
  /** Index into the stored `bands` array: 0 Low, 1 Lo-Mid, 2 Mid, 3 High */
  index: number
  name: string
  /** Frequency range it can move across. Omitted = fixed frequency. */
  freqRange?: [number, number]
  shelfType?: 'low-shelf' | 'high-shelf'
}

function bandSpecs(advanced: boolean, t: Translations): BandSpec[] {
  const eq = t.nodes.eq
  if (advanced) {
    // Four fully parametric bands
    return [
      { index: 0, name: eq.bandLow,                freqRange: [40, 500],     shelfType: 'low-shelf' },
      { index: 1, name: eq.bandLoMid ?? 'Lo-Mid', freqRange: [200, 1500] },
      { index: 2, name: eq.bandMid,                freqRange: [500, 5000] },
      { index: 3, name: eq.bandHigh,               freqRange: [2000, 16000], shelfType: 'high-shelf' },
    ]
  }
  // Intermediate: one knob per band, each at its fixed frequency (Lo-Mid stays at 0 dB)
  return [
    { index: 0, name: eq.bandLow },
    { index: 2, name: eq.bandMid },
    { index: 3, name: eq.bandHigh },
  ]
}

function getBands(params: Record<string, NodeParamValue>): EQBand[] {
  const stored = params.bands
  if (Array.isArray(stored) && stored.length === 4) return stored as EQBand[]
  return DEFAULT_BANDS.map((b) => ({ ...b }))
}

// ── Band cell building blocks ─────────────────────────────────────────────────

/** "Label ............ value" on one line that never wraps. */
function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
        fontSize: 'var(--node-text-sm)', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: 'var(--lsc-fg-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--lsc-font-mono)', fontWeight: 700, color: 'var(--lsc-fg)' }}>{value}</span>
    </div>
  )
}

function BandSlider({
  label, display, value, min, max, step, log = false, color, disabled = false, title, onChange,
}: {
  label: string
  display: string
  value: number
  min: number
  max: number
  step: number
  /** Logarithmic travel — each octave gets the same slider distance, like the graph */
  log?: boolean
  color: string
  disabled?: boolean
  title?: string
  onChange: (v: number) => void
}) {
  const toPos = (v: number) => (log ? Math.log10(v) : v)
  return (
    <div
      className="nodrag nopan"
      title={title}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: disabled ? 0.4 : 1 }}
    >
      <ValueRow label={label} value={display} />
      <input
        type="range"
        disabled={disabled}
        min={toPos(min)}
        max={toPos(max)}
        step={log ? 0.001 : step}
        value={toPos(value)}
        onChange={(e) => {
          const v = Number(e.target.value)
          onChange(log ? Math.round(10 ** v) : v)
        }}
        className="nodrag nopan w-full h-1.5 appearance-none rounded-full"
        style={{ accentColor: color, background: 'var(--lsc-track)', cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
    </div>
  )
}

function ShelfToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      className="nodrag nopan"
      aria-pressed={on}
      title={t.nodes.eq.shelfHint}
      onClick={onToggle}
      style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
        padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap',
        border: `1px solid ${on ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
        background: on ? 'var(--lsc-accent)' : 'transparent',
        color: on ? '#fff' : 'var(--lsc-fg-dim)',
        transition: 'all 0.12s',
      }}
    >
      {t.nodes.eq.shelf ?? 'Shelf'}
    </button>
  )
}

function BandCell({ spec, band, onChange }: {
  spec: BandSpec
  band: EQBand
  onChange: (patch: Partial<EQBand>) => void
}) {
  const { t }     = useTranslation()
  const color     = BAND_COLORS[spec.index]
  const shelf     = isShelf(band)
  const gainLabel = t.nodes.eq.gain ?? 'Gain'
  const freqLabel = t.nodes.eq.freq ?? 'Freq'
  const q         = band.Q ?? 1.4

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0,
        padding: 8, borderRadius: 'var(--lsc-radius-md)',
        background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)',
      }}
    >
      {/* Name (colour = its dot on the graph) + Shelf */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 22 }}>
        <span
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 'var(--node-text-sm)', fontWeight: 700, whiteSpace: 'nowrap',
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 9999, background: color, flexShrink: 0 }} />
          {spec.name}
        </span>
        {spec.shelfType && (
          <ShelfToggle on={shelf} onToggle={() => onChange({ type: shelf ? 'bell' : spec.shelfType })} />
        )}
      </div>

      {/* Boost / cut */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <KnobControl
          value={band.gainDb} min={DB_MIN} max={DB_MAX} step={0.5}
          label={gainLabel} onChange={(v) => onChange({ gainDb: v })}
          color={color} size={36} showReadout={false}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: 'var(--node-text-xs)', fontWeight: 700 }}>
            {formatGain(band.gainDb)}
          </span>
          <span className="lsc-knob-label">{gainLabel}</span>
        </div>
      </div>

      {/* Frequency */}
      {spec.freqRange ? (
        <BandSlider
          label={freqLabel} display={formatFreq(band.freqHz)}
          value={band.freqHz} min={spec.freqRange[0]} max={spec.freqRange[1]} step={1} log
          color={color} onChange={(v) => onChange({ freqHz: v })}
        />
      ) : (
        <ValueRow label={freqLabel} value={formatFreq(band.freqHz)} />
      )}

      {/* Width — kept in place (greyed out) on a shelf so the card does not change height */}
      <BandSlider
        label={t.nodes.eq.widthQ ?? 'Width (Q)'} display={shelf ? '—' : q.toFixed(1)}
        value={q} min={Q_MIN} max={Q_MAX} step={0.1}
        color={color} disabled={shelf} title={shelf ? t.nodes.eq.widthShelf : undefined}
        onChange={(v) => onChange({ Q: v })}
      />
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export function EQNode({ id, data }: NodeProps<Node<GraphEQData>>) {
  const { stages }          = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const complexityLevel  = useSignalStore((s) => s.complexityLevel)
  const { t }            = useTranslation()

  const levels = useStereoLevels(id)
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const bands  = getBands(node?.params ?? {})

  const updateBand = (i: number, patch: Partial<EQBand>) => {
    updateNodeParams(id, { bands: bands.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) })
  }

  // The EQ is not in the Beginner palette; anything below Advanced gets the three-knob card
  const advanced = complexityLevel === 'advanced'
  const specs    = bandSpecs(advanced, t)

  const graphBands: GraphBand[] = specs.map((s) => ({
    band: bands[s.index], name: s.name, color: BAND_COLORS[s.index], freqRange: s.freqRange,
  }))
  const meterIn  = <SignalMeter db={levels.in} dbR={levels.inR} health={getHealth(levels.inPeak)} label={t.meters.input} />
  const meterOut = <SignalMeter db={levels.out} dbR={levels.outR} health={result.health} label={t.meters.output} />

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="eq"
      icon={<Activity size={16} />}
      label={data.label ?? t.nodes.eq.label}
      accentColor={data.color}
    >
      {advanced ? (
        <div style={{ width: BODY_W, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>{meterIn}</div>
            <div style={{ flex: 1 }}>{meterOut}</div>
          </div>

          <EQGraph
            bands={graphBands}
            onBandChange={(i, patch) => updateBand(specs[i].index, patch)}
            width={BODY_W}
            height={GRAPH_H}
            adjustableWidth
          />
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: 'var(--lsc-fg-dim)' }}>
            {t.nodes.eq.graphHint}
            {t.nodes.eq.graphHintWidth && ` ${t.nodes.eq.graphHintWidth}`}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${specs.length}, minmax(0, 1fr))`, gap: 8 }}>
            {specs.map((s) => (
              <BandCell
                key={s.index}
                spec={s}
                band={bands[s.index]}
                onChange={(patch) => updateBand(s.index, patch)}
              />
            ))}
          </div>
        </div>
      ) : (
        // A simple mixing desk's EQ: no curve, just turn a range up or down
        <div className="space-y-3">
          {meterIn}
          <div style={{ display: 'flex', justifyContent: 'space-around', gap: 8, paddingTop: 2 }}>
            {specs.map((s) => (
              <KnobControl
                key={s.index}
                value={bands[s.index].gainDb} min={DB_MIN} max={DB_MAX} step={0.5}
                label={s.name} formatValue={formatGain}
                onChange={(v) => updateBand(s.index, { gainDb: v })}
                color={BAND_COLORS[s.index]} size={44}
              />
            ))}
          </div>
          {meterOut}
        </div>
      )}
    </NodeWrapper>
  )
}
