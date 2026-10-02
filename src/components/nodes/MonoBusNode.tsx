import { useMemo } from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import { Merge } from 'lucide-react'
import { BusInputPorts } from './NodePort'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface MonoBusData extends Record<string, unknown> {
  color?: string
  label?: string
  typeKey?: string
}

export function MonoBusNode({ id, data }: NodeProps<Node<MonoBusData>>) {
  const { stages }    = useGraphSignal()
  const allEdges      = useSignalStore((s) => s.edges)
  const { t, fmt }    = useTranslation()
  const incomingEdges = useMemo(() => allEdges.filter((e) => e.target === id), [allEdges, id])

  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const domain = (result as { domain?: string }).domain ?? 'analog'
  const unit   = domain === 'digital' ? 'dBFS' : 'dBu'

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="mono-bus"
      icon={<Merge size={16} />}
      label={data.label ?? t.nodes['mono-bus']?.label ?? 'Mono Bus / Aux'}
      customInputs={<BusInputPorts nodeId={id} connectedHandles={incomingEdges.map((e) => e.targetHandle)} />}
      customInputCount={incomingEdges.length + 1}
    >
      <div className="space-y-2">
        <div className="lsc-wrap-text text-[var(--node-text-sm)] leading-relaxed" style={{ color: 'var(--lsc-fg-muted)' }}>
          {incomingEdges.length > 0
            ? fmt(t.nodes['mono-bus']?.channels ?? '{n} channel{s} mixed', { n: String(incomingEdges.length), s: incomingEdges.length > 1 ? 's' : '' })
            : (t.nodes['mono-bus']?.noChannels ?? 'No channels connected')}
        </div>

        <SignalMeter db={result.out} health={result.health} label={unit} showValue={false} />

        <div style={{ fontSize: 'var(--node-text-2xs)', fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-fg)', textAlign: 'right' }}>
          {isFinite(result.out) ? `${result.out.toFixed(1)}` : '−∞'} {unit}
        </div>
      </div>
    </NodeWrapper>
  )
}
