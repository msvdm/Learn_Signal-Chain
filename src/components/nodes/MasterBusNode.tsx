import { useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { MeterSides } from './MeterSides'
import { ConditionLabel } from './conditions'
import { KnobControl } from '../controls/KnobControl'
import { useStage } from '../../hooks/useGraphSignal'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { formatTaperDb } from '../../utils/readout'
import type { SignalEdge, TypeKey } from '../../data/nodeRegistry'
import { matrixSendParam } from '../../data/nodeRegistry'
import { matrixSendKey } from '../../graph/queries'
import { useParams } from '../../hooks/useParams'
import { stillPicture } from '../../signal/engine'
import { graphOf } from '../../graph/graph'
import type { GraphView } from '../../graph/graph'
import { TAPER_UNITY } from '../../signal/levels'
import { chainSourcesOfEdge } from '../../graph/chainColors'
import { nodeName } from '../../utils/nodeName'

/**
 * Master Bus and Matrix Bus (always stereo), Aux Bus (mono or stereo).
 * One input that accepts any number of wires; they are added together.
 * Master / Matrix / stereo Aux send the mix out on two wires, Left and Right; a mono Aux on one.
 * The Matrix Bus takes finished mixes only and shows one send knob per bus feeding it.
 */
const NO_GRAPH: GraphView = { nodes: [], edges: [] }

export function MasterBusNode({ id, type }: CardProps) {
  const typeKey  = type as TypeKey
  const isMatrix = typeKey === 'matrix-bus'

  const result        = useStage(id)
  const incomingEdges = useSignalStore(useShallow((s) => graphOf(s).into(id)))
  // Only the Matrix Bus needs the whole graph (the buses feeding it, their names and chains)
  const { nodes, edges: allEdges } = useSignalStore(useShallow((s): GraphView => isMatrix ? { nodes: s.nodes, edges: s.edges } : NO_GRAPH))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const setHighlight  = useSignalStore((s) => s.setHighlightEdges)
  const { t, fmt }    = useTranslation()
  const p        = useParams(id, typeKey)
  // Analog and digital signals arriving at once (domainMixedBus)
  const condition = result?.condition
  const tm       = t.nodes['matrix-bus']

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
      label={useNodeName(id, typeKey)}
    >
      {/* The mix leaving it, on its right; what feeds it on the left */}
      <MeterSides nodeId={id} input={false}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                      {nodeName(t, from, from && stillPicture(nodes, allEdges).result.stages[from.id])}
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

        {!isMatrix && (
          <span className="lsc-wrap-text" style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--lsc-fg-muted)' }}>
            {n > 0
              ? n === 1 ? t.nodes['aux-bus'].channelsOne : fmt(t.nodes['aux-bus'].channels, { n: String(n) })
              : t.nodes['aux-bus'].noChannels}
          </span>
        )}

        {condition && <ConditionLabel condition={condition} typeKey={typeKey} />}
        </div>
      </MeterSides>
    </NodeWrapper>
  )
}
