import { useMemo } from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import { Merge } from 'lucide-react'
import { Handle, Position } from '@xyflow/react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'

interface MonoBusData extends Record<string, unknown> {
  color?: string
  label?: string
  typeKey?: string
}

export function MonoBusNode({ id, data }: NodeProps<Node<MonoBusData>>) {
  const { stages }    = useGraphSignal()
  const allEdges      = useSignalStore((s) => s.edges)
  const sourceNodes   = useSignalStore((s) => s.nodes)
  const incomingEdges = useMemo(() => allEdges.filter((e) => e.target === id), [allEdges, id])

  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const domain = (result as { domain?: string }).domain ?? 'analog'
  const unit   = domain === 'digital' ? 'dBFS' : 'dBu'

  const totalHandles = incomingEdges.length + 1
  const channelHandles = Array.from({ length: totalHandles }, (_, i) => {
    const edge    = incomingEdges[i]
    const srcNode = edge ? sourceNodes.find((n) => n.id === edge.source) : undefined
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
    <NodeWrapper
      nodeId={id}
      typeKey="mono-bus"
      icon={<Merge size={14} />}
      label={data.label ?? 'Mono Bus / Aux'}
    >
      {channelHandles}

      <div className="space-y-2">
        <div className="text-[10px] leading-relaxed" style={{ color: 'var(--lsc-text)' }}>
          {incomingEdges.length > 0
            ? `${incomingEdges.length} channel${incomingEdges.length > 1 ? 's' : ''} mixed`
            : 'No channels connected'}
        </div>

        <SignalMeter db={result.out} health={result.health} label={unit} showValue={false} />

        <div style={{ fontSize: 8, fontFamily: 'var(--lsc-font-mono)', color: 'var(--lsc-text)', textAlign: 'right' }}>
          {isFinite(result.out) ? `${result.out.toFixed(1)}` : '−∞'} {unit}
        </div>
      </div>
    </NodeWrapper>
  )
}
