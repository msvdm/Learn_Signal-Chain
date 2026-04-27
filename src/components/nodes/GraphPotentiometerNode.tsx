import type { NodeProps, Node } from '@xyflow/react'
import { Gauge } from 'lucide-react'
import { GraphNodeWrapper } from './GraphNodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { KnobControl } from '../controls/KnobControl'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'

interface GraphPotentiometerData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function GraphPotentiometerNode({ id, data }: NodeProps<Node<GraphPotentiometerData>>) {
  const { stages, inputDb } = useGraphSignal()
  const node                = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams    = useSignalStore((s) => s.updateNodeParams)

  const params        = node?.params ?? {}
  const input         = inputDb[id] ?? -Infinity
  const result        = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const attenuationDb = (params.attenuationDb as number) ?? 0

  return (
    <GraphNodeWrapper
      nodeId={id}
      typeKey="potentiometer"
      icon={<Gauge size={14} />}
      label={data.label ?? 'Potentiometer'}
      accentColor={data.color}
    >
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label="Input" />

        <div className="flex justify-center py-1">
          <KnobControl
            value={attenuationDb}
            min={0}
            max={80}
            label="Attenuation"
            formatValue={(v) => v === 0 ? '0 dB' : `−${v} dB`}
            onChange={(v) => updateNodeParams(id, { attenuationDb: v })}
            color="var(--lsc-accent)"
            size={56}
          />
        </div>

        <div
          className="text-center text-[10px] leading-relaxed"
          style={{ color: 'var(--lsc-text)' }}
        >
          {attenuationDb === 0
            ? 'Full volume — no cut'
            : attenuationDb >= 60
              ? `−${attenuationDb} dB — almost silent`
              : `−${attenuationDb} dB — reduced level`}
        </div>

        <SignalMeter db={result.out} health={result.health} label="Output" />
      </div>
    </GraphNodeWrapper>
  )
}
