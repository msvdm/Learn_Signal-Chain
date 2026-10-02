import { useMemo } from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import { Merge } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { BusInputPorts } from './NodePort'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { getHealthStyle, dbToPercent } from '../../hooks/useGainStaging'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { StableText } from '../controls/StableText'
import { LEVEL_SAMPLE } from '../../utils/readout'

interface MasterBusData extends Record<string, unknown> {
  color?: string
  label?: string
  typeKey?: string
}

function ChannelRow({ ch, db }: { ch: string; db: number }) {
  const color = isFinite(db) ? getHealthStyle(getHealth(db)).color : 'var(--lsc-border)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ fontWeight: 700, width: 10 }}>{ch}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 9999, background: 'var(--lsc-sunken)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${isFinite(db) ? dbToPercent(db) : 0}%`, height: '100%', borderRadius: 9999,
            background: color, transition: 'width 0.15s ease-out',
          }}
        />
      </div>
      <StableText reserve={[LEVEL_SAMPLE]} align="end" style={{ fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-fg-muted)' }}>
        {isFinite(db) ? db.toFixed(1) : '−∞'}
      </StableText>
    </div>
  )
}

export function MasterBusNode({ id, data }: NodeProps<Node<MasterBusData>>) {
  const { stages }    = useGraphSignal()
  const allEdges      = useSignalStore((s) => s.edges)
  const incomingEdges = useMemo(() => allEdges.filter((e) => e.target === id), [allEdges, id])
  const { t, fmt }    = useTranslation()

  const result          = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const resolvedTypeKey = (data.typeKey as string) ?? 'master-bus'
  const defaultLabel    =
    resolvedTypeKey === 'stereo-bus'
      ? (t.nodes['stereo-bus']?.label ?? 'Stereo Bus / Aux')
      : (t.nodes.master.label ?? 'Master Bus')
  const domainWarning = (result as { warning?: string }).warning === 'domainMixedBus'

  // L/R output levels — always present since the bus always has out-l and out-r ports
  const outL = result.outL ?? result.out
  const outR = result.outR ?? result.out

  return (
    // NodeWrapper renders the two output ports (out-l / out-r) from NODE_REGISTRY.
    <NodeWrapper
      nodeId={id}
      typeKey={resolvedTypeKey}
      icon={<Merge size={16} />}
      label={data.label ?? defaultLabel}
      customInputs={<BusInputPorts nodeId={id} connectedHandles={incomingEdges.map((e) => e.targetHandle)} />}
      customInputCount={incomingEdges.length + 1}
    >
      <ChannelRow ch="L" db={outL} />
      <ChannelRow ch="R" db={outR} />

      <span className="lsc-wrap-text" style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--lsc-fg-muted)' }}>
        {incomingEdges.length > 0
          ? fmt(t.nodes['mono-bus']?.channels ?? '{n} channel{s} mixed', { n: String(incomingEdges.length), s: incomingEdges.length > 1 ? 's' : '' })
          : (t.nodes['mono-bus']?.noChannels ?? 'No channels connected')}
      </span>

      {/* Domain mismatch warning */}
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
