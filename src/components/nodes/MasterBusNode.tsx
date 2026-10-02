import { useMemo } from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import { Merge } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { ChannelRow, SignalMeter } from '../SignalMeter'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { isNodeStereo } from '../../data/nodeRegistry'
import { StableText } from '../controls/StableText'
import { LEVEL_SAMPLE } from '../../utils/readout'

interface BusData extends Record<string, unknown> {
  color?: string
  label?: string
  typeKey?: string
}

/** Plain-language note on a bus card (stereo folded to mono, mono spread to stereo). */
function BusHint({ text }: { text: string }) {
  return (
    <div
      className="lsc-wrap-text"
      style={{
        fontSize: 12, lineHeight: 1.4, color: 'var(--lsc-fg)',
        padding: '6px 8px', borderRadius: 'var(--lsc-radius-sm)',
        border: '1px solid var(--lsc-accent)',
        background: 'var(--lsc-accent-bg)',
      }}
    >
      {text}
    </div>
  )
}

/**
 * Master Bus (always stereo) and Aux Bus (mono or stereo).
 * Inputs come from the registry: Master / stereo Aux = L In + R In, mono Aux = one In.
 * Each input accepts any number of wires; they are added together.
 */
export function MasterBusNode({ id, data }: NodeProps<Node<BusData>>) {
  const { stages, busNotes } = useGraphSignal()
  const allEdges      = useSignalStore((s) => s.edges)
  const node          = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const incomingEdges = useMemo(() => allEdges.filter((e) => e.target === id), [allEdges, id])
  const { t, fmt }    = useTranslation()

  const typeKey = (data.typeKey as string) ?? 'master-bus'
  const isAux   = typeKey === 'aux-bus'
  const stereo  = node ? isNodeStereo(node) : !isAux
  const result  = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const note    = busNotes[id]
  const domain  = (result as { domain?: string }).domain ?? 'analog'
  const unit    = domain === 'digital' ? 'dBFS' : 'dBu'
  const domainWarning = (result as { warning?: string }).warning === 'domainMixedBus'

  const defaultLabel = isAux
    ? (t.nodes['aux-bus']?.label ?? 'Aux Bus')
    : (t.nodes.master.label ?? 'Master Bus')

  const n = incomingEdges.length

  return (
    <NodeWrapper
      nodeId={id}
      typeKey={typeKey}
      icon={<Merge size={16} />}
      label={data.label ?? defaultLabel}
      style={{ minWidth: 200 }}
    >
      {stereo ? (
        <>
          <ChannelRow ch="L" db={result.outL ?? result.out} />
          <ChannelRow ch="R" db={result.outR ?? result.out} />
        </>
      ) : (
        <>
          <SignalMeter db={result.out} health={result.health} showValue={false} />
          <div style={{ fontSize: 12, fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-fg-muted)', textAlign: 'right' }}>
            <StableText reserve={[LEVEL_SAMPLE]} align="end">{isFinite(result.out) ? result.out.toFixed(1) : '−∞'}</StableText> {unit}
          </div>
        </>
      )}

      <span className="lsc-wrap-text" style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--lsc-fg-muted)' }}>
        {n > 0
          ? fmt(t.nodes['aux-bus']?.channels ?? '{n} wire{s} in', { n: String(n), s: n > 1 ? 's' : '' })
          : (t.nodes['aux-bus']?.noChannels ?? 'Nothing connected yet')}
      </span>

      {note?.foldedStereo && <BusHint text={t.stereo.foldedStereo} />}
      {note?.monoOnStereo && <BusHint text={t.stereo.monoOnStereo} />}

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
          {t.warnings?.domainMixedBus ?? 'Cannot mix analog and digital signals'}
        </div>
      )}
    </NodeWrapper>
  )
}
