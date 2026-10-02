import type { NodeProps, Node } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { getHealthStyle } from '../../hooks/useGainStaging'

interface GraphRelayData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function RelayNode({ id, data }: NodeProps<Node<GraphRelayData>>) {
  const { stages, portSignal } = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const allEdges         = useSignalStore((s) => s.edges)
  const { t }            = useTranslation()

  const selected = (node?.params.selectedInput as string) ?? 'a'
  const result   = stages[id]

  // Find the signal level coming into each input handle
  const incomingA = allEdges.find((e) => e.target === id && e.targetHandle === 'in-a')
  const incomingB = allEdges.find((e) => e.target === id && e.targetHandle === 'in-b')
  const sigA = incomingA ? (portSignal.get(`${incomingA.source}:${incomingA.sourceHandle}`) ?? -Infinity) : -Infinity
  const sigB = incomingB ? (portSignal.get(`${incomingB.source}:${incomingB.sourceHandle}`) ?? -Infinity) : -Infinity

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="relay"
      icon={<GitBranch size={16} />}
      label={data.label ?? t.nodes.relay?.label ?? 'Relay'}
    >
      {/* A / B input selector */}
      <div style={{ display: 'flex', gap: 4 }}>
        {(['a', 'b'] as const).map((ch) => (
          <button
            key={ch}
            className="nodrag nopan"
            onClick={() => updateNodeParams(id, { selectedInput: ch })}
            style={{
              flex: 1, padding: '4px 0',
              fontSize: 'var(--node-text-xs)', fontWeight: 700, textTransform: 'uppercase',
              borderRadius: 'var(--lsc-radius-sm)',
              border: `1px solid ${selected === ch ? 'var(--signal-good)' : 'var(--lsc-border)'}`,
              background: selected === ch ? 'var(--signal-good-bg)' : 'transparent',
              color: selected === ch ? 'var(--signal-good)' : 'var(--lsc-fg-muted)',
              cursor: 'pointer',
            }}
          >
            {ch.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Input level readouts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {(['a', 'b'] as const).map((ch) => {
          const sig    = ch === 'a' ? sigA : sigB
          const active = selected === ch
          return (
            <div key={ch} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 'var(--node-text-sm)', fontWeight: 700, color: active ? 'var(--signal-good)' : 'var(--lsc-fg-dim)' }}>
                In {ch.toUpperCase()}
              </span>
              <span style={{
                fontSize: 'var(--node-text-sm)', fontFamily: 'var(--lsc-font-mono)',
                color: active ? getHealthStyle(result?.health ?? 'too-quiet').color : 'var(--lsc-fg-dim)',
              }}>
                {isFinite(sig) ? sig.toFixed(1) : '−∞'}
              </span>
            </div>
          )
        })}
      </div>
    </NodeWrapper>
  )
}
