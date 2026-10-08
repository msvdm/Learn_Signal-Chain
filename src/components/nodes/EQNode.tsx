import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { MeterSides, METER_GAP } from './MeterSides'
import { STRIP_W } from '../SignalMeter'
import { KnobControl } from '../controls/KnobControl'
import { StableText } from '../controls/StableText'
import { EQGraph, type GraphBand } from '../controls/EQGraph'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import type { EQBand } from '../../data/nodeRegistry'
import { NODE_REGISTRY } from '../../data/nodeRegistry'
import type { Translations } from '../../i18n/translations'
import { useParams } from '../../hooks/useParams'
import {
  BAND_COLORS, DB_MIN, DB_MAX, Q_MIN, Q_MAX,
  isShelf, formatFreq, formatGain,
} from '../../signal/eqMath'

const DEFAULT_BANDS = NODE_REGISTRY.eq.defaultParams.bands as EQBand[]

/**
 * Body width and graph height of the Advanced card. Fixed sizes: dragging a band or changing
 * a value never resizes the card. Its meters stand at its sides; the curve and the bands' knobs
 * take what is left between them.
 */
const BODY_W   = 640
const MIDDLE_W = BODY_W - 2 * (STRIP_W + METER_GAP)
const GRAPH_H  = 160
/** The bands' table: the row names on the left, a column per band */
const ROW_NAMES_W = 72
const KNOB = 28

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
      { index: 1, name: eq.bandLoMid, freqRange: [200, 1500] },
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

/** The four bands; anything else (a file edited by hand) starts again from the defaults. */
function getBands(stored: EQBand[]): EQBand[] {
  if (Array.isArray(stored) && stored.length === 4) return stored
  return DEFAULT_BANDS.map((b) => ({ ...b }))
}

// ── The bands' table (Advanced) ─────────────────────────────────────────────────

function ShelfToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      className="nodrag nopan"
      aria-pressed={on}
      onClick={onToggle}
      style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
        padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap',
        border: `1px solid ${on ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
        background: on ? 'var(--lsc-accent)' : 'transparent',
        color: on ? '#fff' : 'var(--lsc-fg-dim)',
        transition: 'all 0.12s',
      }}
    >
      {t.nodes.eq.shelf}
    </button>
  )
}

/** A small knob with its value beside it (the row says what it is). */
function BandKnob({ value, min, max, step, label, display, reserve, color, disabled = false, onChange }: {
  value: number
  min: number
  max: number
  step: number
  label: string
  display: string
  /** As wide as its widest value, so turning it never moves anything */
  reserve: string
  color: string
  disabled?: boolean
  onChange: (v: number) => void
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: disabled ? 0.4 : 1, pointerEvents: disabled ? 'none' : undefined }}
    >
      <KnobControl value={value} min={min} max={max} step={step} label={label} onChange={onChange} color={color} size={KNOB} showReadout={false} />
      <StableText reserve={[reserve]} style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: 11, fontWeight: 700 }}>
        {display}
      </StableText>
    </div>
  )
}

/**
 * The four bands as a table: a column each — its name, Shelf where it can be one, then its Gain,
 * Freq and Width knobs — the row names once on the left. Frequency turns on a log scale (each
 * octave the same turn, like the graph); a shelf's Width stays in place, greyed.
 */
function BandTable({ specs, bands, onChange }: {
  specs: BandSpec[]
  bands: EQBand[]
  onChange: (index: number, patch: Partial<EQBand>) => void
}) {
  const { t } = useTranslation()
  const eq    = t.nodes.eq
  const rowName = (text: string) => (
    // A long one ("Width (Q)") wraps at its space, beside its knob
    <span className="lsc-knob-label" style={{ alignSelf: 'center', lineHeight: 1.2 }}>{text}</span>
  )
  return (
    <div
      className="nodrag nopan"
      style={{
        display: 'grid', gridTemplateColumns: `${ROW_NAMES_W}px repeat(${specs.length}, minmax(0, 1fr))`,
        gridAutoFlow: 'column', gridTemplateRows: 'auto auto repeat(3, auto)',
        columnGap: 6, rowGap: 6, padding: 8, borderRadius: 'var(--lsc-radius-md)',
        background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)',
      }}
    >
      {/* The row names */}
      <span />
      <span />
      {rowName(eq.gain)}
      {rowName(eq.freq)}
      {rowName(eq.widthQ)}

      {specs.map((spec) => {
        const band  = bands[spec.index]
        const color = BAND_COLORS[spec.index]
        const shelf = isShelf(band)
        const q     = band.Q ?? 1.4
        const patch = (p: Partial<EQBand>) => onChange(spec.index, p)
        const range = spec.freqRange ?? [band.freqHz, band.freqHz]
        return [
          // Name (colour = its dot on the graph); a long one wraps
          <span key="name" style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 11, fontWeight: 700, lineHeight: 1.25 }}>
            <span style={{ width: 8, height: 8, marginTop: 3, borderRadius: 9999, background: color, flexShrink: 0 }} />
            {spec.name}
          </span>,
          <span key="shelf" style={{ minHeight: 20 }}>
            {spec.shelfType && <ShelfToggle on={shelf} onToggle={() => patch({ type: shelf ? 'bell' : spec.shelfType })} />}
          </span>,
          <BandKnob
            key="gain" value={band.gainDb} min={DB_MIN} max={DB_MAX} step={0.5}
            label={eq.gain} display={formatGain(band.gainDb)} reserve="+00.0 dB" color={color}
            onChange={(v) => patch({ gainDb: v })}
          />,
          <BandKnob
            key="freq" value={Math.log10(band.freqHz)} min={Math.log10(range[0])} max={Math.log10(range[1])} step={0.001}
            label={eq.freq} display={formatFreq(band.freqHz)} reserve="00.0 kHz" color={color}
            disabled={!spec.freqRange}
            onChange={(v) => patch({ freqHz: Math.round(10 ** v) })}
          />,
          // Kept in place (greyed out) on a shelf so nothing moves
          <BandKnob
            key="q" value={q} min={Q_MIN} max={Q_MAX} step={0.1}
            label={eq.widthQ} display={shelf ? '—' : q.toFixed(1)} reserve="00.0" color={color}
            disabled={shelf}
            onChange={(v) => patch({ Q: v })}
          />,
        ]
      })}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export function EQNode({ id }: CardProps) {
  const p                = useParams(id, 'eq')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const complexityLevel  = useSignalStore((s) => s.complexityLevel)
  const { t }            = useTranslation()

  const bands  = getBands(p('bands'))

  const updateBand = (i: number, patch: Partial<EQBand>) => {
    updateNodeParams(id, { bands: bands.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) })
  }

  // The EQ is not in the Beginner palette; anything below Advanced gets the three-knob card
  const advanced = complexityLevel === 'advanced'
  const specs    = bandSpecs(advanced, t)

  const graphBands: GraphBand[] = specs.map((s) => ({
    band: bands[s.index], name: s.name, color: BAND_COLORS[s.index], freqRange: s.freqRange,
  }))

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="eq"
      label={useNodeName(id, 'eq')}
    >
      {advanced ? (
        // As wide as it always was: its meters at its sides, the curve and the bands between them
        <div style={{ width: BODY_W }}>
          <MeterSides nodeId={id}>
            <div style={{ width: MIDDLE_W, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <EQGraph
                bands={graphBands}
                onBandChange={(i, patch) => updateBand(specs[i].index, patch)}
                width={MIDDLE_W}
                height={GRAPH_H}
                adjustableWidth
              />
              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.4, color: 'var(--lsc-fg-dim)' }}>
                {t.nodes.eq.graphHint}
                {t.nodes.eq.graphHintWidth && ` ${t.nodes.eq.graphHintWidth}`}
              </p>
              <BandTable specs={specs} bands={bands} onChange={updateBand} />
            </div>
          </MeterSides>
        </div>
      ) : (
        // A simple mixing desk's EQ: no curve, just turn a range up or down — its knobs one above
        // another, High on top, as on a desk's channel strip
        <MeterSides nodeId={id}>
          <div style={{ alignSelf: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[...specs].reverse().map((s) => (
              <KnobControl
                key={s.index}
                value={bands[s.index].gainDb} min={DB_MIN} max={DB_MAX} step={0.5}
                label={s.name} formatValue={formatGain}
                onChange={(v) => updateBand(s.index, { gainDb: v })}
                color={BAND_COLORS[s.index]} size={56} layout="side"
              />
            ))}
          </div>
        </MeterSides>
      )}
    </NodeWrapper>
  )
}
