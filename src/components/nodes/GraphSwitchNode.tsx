import type { NodeProps, Node } from '@xyflow/react'
import { ToggleLeft, ToggleRight } from 'lucide-react'
import { GraphNodeWrapper } from './GraphNodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'

interface GraphSwitchData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function GraphSwitchNode({ id, data }: NodeProps<Node<GraphSwitchData>>) {
  const { stages, inputDb } = useGraphSignal()
  const node                = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams    = useSignalStore((s) => s.updateNodeParams)

  const params = node?.params ?? {}
  const input  = inputDb[id] ?? -Infinity
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const isOn   = (params.on as boolean) !== false

  return (
    <GraphNodeWrapper
      nodeId={id}
      typeKey="switch"
      icon={isOn ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
      label={data.label ?? 'Switch'}
      accentColor={data.color}
    >
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label="Input" />

        {/* Toggle button */}
        <button
          className="nodrag nopan w-full rounded-lg py-2 text-xs font-semibold transition-colors"
          style={{
            background: isOn ? 'var(--signal-good-bg)' : 'var(--lsc-sunken)',
            border: `1px solid ${isOn ? 'var(--signal-good)' : 'var(--lsc-border)'}`,
            color: isOn ? 'var(--signal-good)' : 'var(--lsc-text)',
            cursor: 'pointer',
          }}
          onClick={() => updateNodeParams(id, { on: !isOn })}
        >
          {isOn ? 'ON — signal passing' : 'OFF — signal cut'}
        </button>

        <SignalMeter db={result.out} health={result.health} label="Output" />
      </div>
    </GraphNodeWrapper>
  )
}
