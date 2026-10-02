import { useMemo } from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import { Merge } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { ChannelRow, SignalMeter } from '../SignalMeter'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { StableText } from '../controls/StableText'
import { LEVEL_SAMPLE } from '../../utils/readout'

interface BusData extends Record<string, unknown> {
  color?: string
  label?: string
  typeKey?: string
}

/**
 * Master Bus (always stereo) and Aux Bus (mono or stereo).
 * One input that accepts any number of wires; they are added together.
 * Master / stereo Aux send the mix out on two wires, Left and Right; a mono Aux on one.
 */
export function MasterBusNode({ id, data }: NodeProps<Node<BusData>>) {
  const { stages } = useGraphSignal()
  const allEdges      = useSignalStore((s) => s.edges)
  const incomingEdges = useMemo(() => allEdges.filter((e) => e.target === id), [allEdges, id])
  const { t, fmt }    = useTranslation()

  const typeKey = (data.typeKey as string) ?? 'master-bus'
  const isAux   = typeKey === 'aux-bus'
  const result  = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const stereo  = stages[id]?.stereoOut ?? !isAux
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
