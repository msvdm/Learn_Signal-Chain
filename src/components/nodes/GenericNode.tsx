import type { NodeProps, Node } from '@xyflow/react'
import { Box } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { ControlSlider } from './ControlSlider'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { NODE_REGISTRY } from '../../data/nodeRegistry'

interface GraphGenericData extends Record<string, unknown> {
  typeKey?: string
  color?: string
  label?: string
}

export function GenericNode({ id, data }: NodeProps<Node<GraphGenericData>>) {
  const { stages, inputDb } = useGraphSignal()
  const node                = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams    = useSignalStore((s) => s.updateNodeParams)

  const typeKey = node?.typeKey ?? data.typeKey ?? 'unknown'
  const def     = NODE_REGISTRY[typeKey]
  const params  = node?.params ?? {}
  const input   = inputDb[id] ?? -Infinity
  const result  = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  // Show numeric sliders for each param in defaultParams
  const paramEntries = Object.entries(def?.defaultParams ?? {}).filter(
    ([, v]) => typeof v === 'number'
  ) as [string, number][]

  return (
    <NodeWrapper
      nodeId={id}
      typeKey={typeKey}
      icon={<Box size={14} />}
      label={data.label ?? def?.label ?? typeKey}
      accentColor={data.color}
    >
      <div className="space-y-2">
        {def?.inputs && def.inputs.length > 0 && (
          <SignalMeter db={input} health={getHealth(input)} label="Input" />
        )}

        {paramEntries.map(([key, defaultVal]) => {
          const current = (params[key] as number) ?? defaultVal
          const absMax = Math.max(Math.abs(defaultVal) * 3 || 100, 100)
          return (
            <ControlSlider
              key={key}
              value={current}
              min={-absMax}
              max={absMax}
              label={key}
              formatValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
              onChange={(v) => updateNodeParams(id, { [key]: v })}
            />
          )
        })}

        <SignalMeter db={result.out} health={result.health} label="Output" />
      </div>
    </NodeWrapper>
  )
}
