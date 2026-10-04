import { useMemo } from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import { NodeWrapper } from './NodeWrapper'
import { ChannelRow, SignalMeter } from '../SignalMeter'
import { KnobControl } from '../controls/KnobControl'
import { useGraphSignal } from '../../hooks/useGraphSignal'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { StableText } from '../controls/StableText'
import { LEVEL_SAMPLE, formatTaperDb } from '../../utils/readout'
import type { SignalEdge, TypeKey } from '../../data/nodeRegistry'
import { matrixSendParam } from '../../data/nodeRegistry'
import { matrixSendKey } from '../../graph/queries'
import { useParams } from '../../hooks/useParams'
import { SILENT_WIRE, levelOf } from '../../signal/engine'
import { TAPER_UNITY } from '../../signal/levels'
import { chainSourcesOfEdge } from '../../utils/chainColors'
import { nodeName } from '../../utils/nodeName'

interface BusData extends Record<string, unknown> {
  color?: string
  label?: string
}

/**
 * Master Bus and Matrix Bus (always stereo), Aux Bus (mono or stereo).
 * One input that accepts any number of wires; they are added together.
 * Master / Matrix / stereo Aux send the mix out on two wires, Left and Right; a mono Aux on one.
 * The Matrix Bus takes finished mixes only and shows one send knob per bus feeding it.
 */
export function MasterBusNode({ id, type, data }: NodeProps<Node<BusData>>) {
  const { stages } = useGraphSignal()
  const nodes         = useSignalStore((s) => s.nodes)
  const allEdges      = useSignalStore((s) => s.edges)
  const incomingEdges = useMemo(() => allEdges.filter((e) => e.target === id), [allEdges, id])
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const setHighlight  = useSignalStore((s) => s.setHighlightEdges)
  const { t, fmt }    = useTranslation()

  const typeKey  = type as TypeKey
  const isAux    = typeKey === 'aux-bus'
  const isMatrix = typeKey === 'matrix-bus'
  const p        = useParams(id, typeKey)
  const result   = stages[id]
  const out      = result?.out ?? SILENT_WIRE
  const level    = levelOf(out)
  const stereo   = result ? out.kind === 'stereo' : !isAux
  const domain   = result?.domain ?? 'analog'
  const unit     = domain === 'digital' ? 'dBFS' : 'dBu'
  const domainWarning = result?.condition === 'domainMixedBus'
  const tm       = t.nodes['matrix-bus']

  const defaultLabel = isMatrix ? tm.label
    : isAux ? t.nodes['aux-bus'].label
    : t.nodes.master.label

  const n = incomingEdges.length

  // Matrix Bus: the wires grouped by the bus they come from — one knob per bus
  const sends = useMemo(() => {
    if (!isMatrix) return []
    const groups = new Map<string, SignalEdge[]>()
    for (const e of incomingEdges) {
      const key = matrixSendKey(e, { nodes, edges: allEdges })
      groups.set(key, [...(groups.get(key) ?? []), e])
    }
    return [...groups].map(([key, wiresIn]) => ({ key, wiresIn }))
  }, [isMatrix, incomingEdges, nodes, allEdges])

  return (
    <NodeWrapper
      nodeId={id}
      typeKey={typeKey}
      label={data.label ?? defaultLabel}
    >
      {isMatrix && (n > 0 ? (
        // One row per bus plugged in: its name, and its send knob
        <div className="nodrag nopan" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sends.map(({ key, wiresIn }) => {
            const from    = nodes.find((x) => x.id === key)
            const sources = [...new Map(wiresIn
              .flatMap((e) => chainSourcesOfEdge(e, nodes, allEdges))
              .map((s) => [s.id, s])).values()]
            const param   = matrixSendParam(key)
            return (
              <div
                key={key}
                title={tm.sendHint}
                onMouseEnter={() => setHighlight(wiresIn.map((e) => e.id))}
                onMouseLeave={() => setHighlight([])}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {/* Fixed width: a long name never resizes the card */}
                <span style={{ width: 132, display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.25 }}>
                  <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    {(sources.length > 0 ? sources : [undefined]).map((s, i) => (
                      <span
                        key={s?.id ?? i}
                        style={{ width: 8, height: 8, borderRadius: 9999, background: s?.color ?? 'var(--lsc-border)' }}
                      />
                    ))}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, overflowWrap: 'anywhere' }}>
                    {nodeName(t, from, from && stages[from.id])}
                  </span>
                </span>
                <KnobControl
                  value={p(param) ?? TAPER_UNITY}
                  min={0}
                  max={100}
                  step={0.5}
                  label=""
                  formatValue={formatTaperDb}
                  onChange={(v) => updateNodeParams(id, { [param]: v })}
                  color="var(--lsc-accent)"
                  size={36}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <span className="lsc-wrap-text" style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--lsc-fg-muted)', maxWidth: 200 }}>
          {tm.empty}
        </span>
      ))}

      {stereo ? (
        <>
          <ChannelRow ch="L" db={out.l} />
          <ChannelRow ch="R" db={out.r} />
        </>
      ) : (
        <>
          <SignalMeter db={level} health={result?.health ?? 'too-quiet'} showValue={false} domain={domain} />
          <div style={{ fontSize: 12, fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-fg-muted)', textAlign: 'right' }}>
            <StableText reserve={[LEVEL_SAMPLE]} align="end">{isFinite(level) ? level.toFixed(1) : '−∞'}</StableText> {unit}
          </div>
        </>
      )}

      {!isMatrix && (
        <span className="lsc-wrap-text" style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--lsc-fg-muted)' }}>
          {n > 0
            ? fmt(t.nodes['aux-bus'].channels, { n: String(n), s: n > 1 ? 's' : '' })
            : t.nodes['aux-bus'].noChannels}
        </span>
      )}

      {domainWarning && (
        <div
          className="lsc-wrap-text"
          style={{
            fontSize: 12, fontWeight: 600, color: 'var(--signal-clipping)',
            padding: '4px 8px', borderRadius: 'var(--lsc-radius-sm)',
            border: '1px solid var(--signal-clipping-border)',
            background: 'var(--signal-clipping-bg)',
          }}
        >
          {t.warnings.domainMixedBus}
        </div>
      )}
    </NodeWrapper>
  )
}
