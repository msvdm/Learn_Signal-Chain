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
}

export function MasterBusNode({ id, data }: NodeProps<Node<MasterBusData>>) {
  const { stages }  = useGraphSignal()
  const allEdges    = useSignalStore((s) => s.edges)
  const sourceNodes = useSignalStore((s) => s.nodes)
  const incomingEdges = useMemo(() => allEdges.filter((e) => e.target === id), [allEdges, id])
  const { t }         = useTranslation()

  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  // Render one input handle per connected channel, spaced vertically
  const channelHandles = incomingEdges.map((e, i) => {
    const srcNode = sourceNodes.find((n) => n.id === e.source)
    const top = incomingEdges.length === 1
      ? '50%'
      : `${((i + 1) / (incomingEdges.length + 1)) * 100}%`
    return (
      <Handle
        key={e.targetHandle ?? e.id}
        id={e.targetHandle ?? 'in'}
        type="target"
        position={Position.Left}
        style={{
          top,
          width: 10, height: 10,
          background: srcNode?.color ?? 'var(--lsc-border)',
          border: '2px solid var(--lsc-node-bg)',
          borderRadius: '50%',
        }}
      />
    )
  })

  // If no channels connected yet, show a generic input placeholder
  const placeholderHandle = incomingEdges.length === 0 && (
    <Handle
      id="in-1"
      type="target"
      position={Position.Left}
      style={{
        top: '50%',
        width: 10, height: 10,
        background: 'var(--lsc-border)',
        border: '2px solid var(--lsc-node-bg)',
        borderRadius: '50%',
      }}
    />
  )

  return (
    // NodeWrapper renders output handle from NODE_REGISTRY; we override inputs manually above
    <NodeWrapper
      nodeId={id}
      typeKey="master-bus"
      icon={<Merge size={14} />}
      label={data.label ?? 'Master Bus'}
    >
      {/* Dynamic input handles rendered outside the wrapper's handle loop */}
      {channelHandles}
      {placeholderHandle}

      <div className="space-y-2">
        <div className="text-[10px] leading-relaxed" style={{ color: 'var(--lsc-text)' }}>
          {incomingEdges.length > 0
            ? `${incomingEdges.length} channel${incomingEdges.length > 1 ? 's' : ''} mixed`
            : 'No channels connected'}
        </div>
        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
