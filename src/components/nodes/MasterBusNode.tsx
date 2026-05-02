import { useMemo } from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import { Merge } from 'lucide-react'
import { Handle, Position } from '@xyflow/react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

interface MasterBusData extends Record<string, unknown> {
  color?: string
  label?: string
  typeKey?: string
}

export function MasterBusNode({ id, data }: NodeProps<Node<MasterBusData>>) {
  const { stages }     = useGraphSignal()
  const allEdges       = useSignalStore((s) => s.edges)
  const sourceNodes    = useSignalStore((s) => s.nodes)
  const incomingEdges  = useMemo(() => allEdges.filter((e) => e.target === id), [allEdges, id])
  const { t }          = useTranslation()

  const result          = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const resolvedTypeKey = (data.typeKey as string) ?? 'master-bus'
  const defaultLabel    = resolvedTypeKey === 'bus' ? 'Bus / Aux' : 'Master Bus'
  const domain          = (result as { domain?: string }).domain ?? 'analog'
  const unit            = domain === 'digital' ? 'dBFS' : 'dBu'
  const domainWarning   = (result as { warning?: string }).warning === 'domainMixedBus'

  // L/R output levels — always present since the bus always has out-l and out-r ports
  const outL = result.outL ?? result.out
  const outR = result.outR ?? result.out

  // Dynamic input handles: one per connected channel + one empty slot for the next connection
  const totalHandles = incomingEdges.length + 1
  const channelHandles = Array.from({ length: totalHandles }, (_, i) => {
    const edge     = incomingEdges[i]
    const srcNode  = edge ? sourceNodes.find((n) => n.id === edge.source) : undefined
    const handleId = edge ? (edge.targetHandle ?? `in-${i + 1}`) : `in-${i + 1}`
    const top      = totalHandles === 1 ? '50%' : `${((i + 1) / (totalHandles + 1)) * 100}%`
    return (
      <Handle
        key={handleId}
        id={handleId}
        type="target"
        position={Position.Left}
        style={{
          top,
          width: 10, height: 10,
          background: srcNode?.color ?? 'var(--lsc-border)',
          border: '2px solid var(--lsc-node-bg)',
          borderRadius: '50%',
          cursor: 'crosshair',
        }}
      />
    )
  })

  return (
    // NodeWrapper renders the two output handles (out-l / out-r) from NODE_REGISTRY.
    // We override the input handles manually above.
    <NodeWrapper
      nodeId={id}
      typeKey={resolvedTypeKey}
      icon={<Merge size={14} />}
      label={data.label ?? defaultLabel}
    >
      {/* Dynamic input handles */}
      {channelHandles}

      <div className="space-y-2">
        {/* Channel count */}
        <div className="text-[10px] leading-relaxed" style={{ color: 'var(--lsc-text)' }}>
          {incomingEdges.length > 0
            ? `${incomingEdges.length} channel${incomingEdges.length > 1 ? 's' : ''} mixed`
            : 'No channels connected'}
        </div>

        {/* Domain mismatch warning */}
        {domainWarning && (
          <div
            style={{
              fontSize: 9, fontWeight: 600, color: 'var(--signal-clipping)',
              padding: '3px 6px', borderRadius: 'var(--lsc-radius-sm)',
              border: '1px solid var(--signal-clipping)',
              background: 'var(--signal-clipping-bg)',
            }}
          >
            {t.warnings?.domainMixedBus ?? 'Cannot mix analog and digital signals'}
          </div>
        )}

        {/* Stereo L/R output meters — always shown; both equal when no pan nodes connected */}
        <div className="space-y-1">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                fontSize: 8, fontWeight: 800, letterSpacing: '0.04em',
                color: 'var(--lsc-accent)', minWidth: 8,
              }}
            >
              L
            </span>
            <div style={{ flex: 1 }}>
              <SignalMeter db={outL} health={result.health} label={unit} showValue={false} />
            </div>
            <span style={{ fontSize: 8, fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-text)', minWidth: 36, textAlign: 'right' }}>
              {isFinite(outL) ? `${outL.toFixed(1)}` : '−∞'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                fontSize: 8, fontWeight: 800, letterSpacing: '0.04em',
                color: 'var(--lsc-accent)', minWidth: 8,
              }}
            >
              R
            </span>
            <div style={{ flex: 1 }}>
              <SignalMeter db={outR} health={result.health} label={unit} showValue={false} />
            </div>
            <span style={{ fontSize: 8, fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-text)', minWidth: 36, textAlign: 'right' }}>
              {isFinite(outR) ? `${outR.toFixed(1)}` : '−∞'}
            </span>
          </div>
        </div>

        {/* Output port labels — helps users see which handle is L and which is R */}
        <div
          style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 8, color: 'var(--lsc-text)', opacity: 0.5,
            paddingTop: 2,
          }}
        >
          <span>↑ L out (top) · R out (bottom) ↓</span>
        </div>
      </div>
    </NodeWrapper>
  )
}
