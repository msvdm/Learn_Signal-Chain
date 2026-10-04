import type { NodeProps, Node } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { StableText } from '../controls/StableText'
import { LEVEL_SAMPLE } from '../../utils/readout'
import { useGraphSignal } from '../../hooks/useGraphSignal'
import { useParams } from '../../hooks/useParams'
import { levelOf } from '../../signal/engine'
import { healthColor } from '../../signal/levels'

interface GraphRelayData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function RelayNode({ id, data }: NodeProps<Node<GraphRelayData>>) {
  const { stages, wires } = useGraphSignal()
  const p                = useParams(id, 'relay')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const allEdges         = useSignalStore((s) => s.edges)
  const { t }            = useTranslation()

  const selected = p('selectedInput')
  const result   = stages[id]

  // Signal level coming into each input (the louder side of a stereo wire)
  const levelOn = (port: string) => {
    const dbs = allEdges
      .filter((e) => e.target === id && e.targetHandle === port)
      .map((e) => levelOf(wires.get(`${e.source}:${e.sourceHandle}`)))
    return dbs.length > 0 ? Math.max(...dbs) : -Infinity
  }
  const sigA = levelOn('in-a')
  const sigB = levelOn('in-b')

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="relay"
      icon={<GitBranch size={16} />}
      label={data.label ?? t.nodes.relay.label}
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
              <StableText reserve={[LEVEL_SAMPLE]} align="end" style={{
                fontSize: 'var(--node-text-sm)', fontFamily: 'var(--lsc-font-mono)',
                color: active ? healthColor(result?.health ?? 'too-quiet') : 'var(--lsc-fg-dim)',
              }}>
                {isFinite(sig) ? sig.toFixed(1) : '−∞'}
              </StableText>
            </div>
          )
        })}
      </div>
    </NodeWrapper>
  )
}
