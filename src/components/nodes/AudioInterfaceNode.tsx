import { useMemo } from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import { Cpu } from 'lucide-react'
import { BusInputPorts } from './NodePort'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface AudioInterfaceData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function AudioInterfaceNode({ id, data }: NodeProps<Node<AudioInterfaceData>>) {
  const { stages }    = useGraphSignal()
  const allEdges      = useSignalStore((s) => s.edges)
  const { t }         = useTranslation()

  const incomingEdges = useMemo(() => allEdges.filter((e) => e.target === id), [allEdges, id])
  const result        = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const domain        = (result as { domain?: string }).domain ?? 'analog'
  const unit          = domain === 'digital' ? 'dBFS' : 'dBu'

  // Domain mismatch warning
  const domainWarning = (result as { warning?: string }).warning === 'domainMixedBus'

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="audio-interface"
      icon={<Cpu size={16} />}
      label={data.label ?? t.nodes['audio-interface']?.label ?? 'Audio Interface'}
      customInputs={<BusInputPorts nodeId={id} connectedHandles={incomingEdges.map((e) => e.targetHandle)} />}
      customInputCount={incomingEdges.length + 1}
    >
      <div className="space-y-2">
        <div className="lsc-wrap-text text-[var(--node-text-sm)] leading-relaxed" style={{ color: 'var(--lsc-fg-muted)' }}>
          {incomingEdges.length > 0
            ? `${incomingEdges.length} channel${incomingEdges.length > 1 ? 's' : ''} received`
            : t.nodes['audio-interface']?.noChannels ?? 'No channels connected'}
        </div>

        {domainWarning && (
          <div
            className="lsc-wrap-text"
            style={{
              fontSize: 'var(--node-text-xs)', fontWeight: 600, color: 'var(--signal-clipping)',
              padding: '3px 6px', borderRadius: 'var(--lsc-radius-sm)',
              border: '1px solid var(--signal-clipping)',
              background: 'var(--signal-clipping-bg)',
            }}
          >
            {t.warnings?.domainMixedBus ?? 'Cannot mix analog and digital signals'}
          </div>
        )}

        {/* L/R stereo meters or mono meter */}
        {(result.outL !== undefined && result.outR !== undefined) ? (
          <div className="space-y-1">
            <SignalMeter db={result.outL} health={result.health} label={`L ${unit}`} domain={domain === 'digital' ? 'digital' : 'analog'} />
            <SignalMeter db={result.outR} health={result.health} label={`R ${unit}`} domain={domain === 'digital' ? 'digital' : 'analog'} />
          </div>
        ) : (
          <SignalMeter db={result.out} health={result.health} label={`${t.meters.output} (${unit})`} domain={domain === 'digital' ? 'digital' : 'analog'} />
        )}

        <div
          className="lsc-wrap-text"
          style={{
            fontSize: 'var(--node-text-sm)', fontWeight: 600, letterSpacing: '0.06em',
            color: 'var(--lsc-accent)', textTransform: 'uppercase',
            opacity: 0.7,
          }}
        >
          {domain === 'digital'
            ? (t.nodes['audio-interface']?.digitalIn ?? '↓ Digital — End of chain')
            : (t.nodes['audio-interface']?.analogIn ?? '↓ Analog — End of chain')}
        </div>
      </div>
    </NodeWrapper>
  )
}
