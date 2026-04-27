import type { NodeProps, Node } from '@xyflow/react'
import { Split } from 'lucide-react'
import { GraphNodeWrapper } from './GraphNodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'

interface GraphSplitterData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function GraphSplitterNode({ id, data }: NodeProps<Node<GraphSplitterData>>) {
  const { stages, inputDb } = useGraphSignal()
  const node                = useSignalStore((s) => s.nodes.find((n) => n.id === id))

  const input  = inputDb[id] ?? -Infinity
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  // Suppress unused var warning — node read only to trigger reactivity
  void node

  return (
    <GraphNodeWrapper
      nodeId={id}
      typeKey="splitter"
      icon={<Split size={14} />}
      label={data.label ?? 'Splitter'}
      accentColor={data.color}
    >
      <div className="space-y-2">
        <SignalMeter db={input} health={getHealth(input)} label="Input" />

        <div
          className="rounded-lg px-2 py-1.5 text-center text-[10px] leading-relaxed"
          style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)', color: 'var(--lsc-text)' }}
        >
          Signal copied to both outputs — same level on Out A and Out B
        </div>

        <SignalMeter db={result.out} health={result.health} label="Out A / Out B" />
      </div>
    </GraphNodeWrapper>
  )
}
