import { Handle, Position } from '@xyflow/react'
import { Layers } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { getHealthStyle } from '../../hooks/useGainStaging'

export function MasterBusNode({ id }: { id: string }) {
  const { stages, inputDb } = useSignalChain()
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateNodeState = useSignalStore((s) => s.updateNodeState)
  const { t } = useTranslation()

  const input = inputDb[id] ?? -Infinity
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const healthStyle = getHealthStyle(result.health)

  return (
    <NodeWrapper nodeId={id} icon={<Layers size={14} />} label={t.nodes.master.label}>
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        <div className="flex justify-center py-1">
          <KnobControl
            value={nodeState.masterTrimDb}
            min={-12}
            max={12}
            step={0.5}
            label={t.nodes.master.outputTrim}
            formatValue={(v) => `${v >= 0 ? '+' : ''}${v}dB`}
            onChange={(v) => updateNodeState({ masterTrimDb: v })}
            color="var(--lsc-accent)"
            size={52}
          />
        </div>

        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />

        <div
          className="rounded-lg px-2 py-1.5 text-center text-[10px] font-semibold"
          style={{
            background: healthStyle.bg,
            border: `1px solid ${healthStyle.border}`,
            color: healthStyle.color,
          }}
        >
          {result.health === 'good' && t.nodes.master.statusGood}
          {result.health === 'hot' && t.nodes.master.statusHot}
          {result.health === 'clipping' && t.nodes.master.statusClipping}
          {result.health === 'too-quiet' && t.nodes.master.statusQuiet}
        </div>
      </div>
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />
    </NodeWrapper>
  )
}
