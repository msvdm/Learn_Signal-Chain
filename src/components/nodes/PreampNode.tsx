import { Handle, Position } from '@xyflow/react'
import { Zap } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

export function PreampNode() {
  const { mic, preamp } = useSignalChain()
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateNodeState = useSignalStore((s) => s.updateNodeState)
  const { t } = useTranslation()

  return (
    <NodeWrapper nodeId="preamp" icon={<Zap size={14} />} label={t.nodes.preamp.label}>
      <div className="space-y-3">
        <SignalMeter db={mic.out} health={mic.health} label={t.meters.input} />

        <div className="flex justify-center py-1">
          <KnobControl
            value={nodeState.preampGainDb}
            min={0}
            max={60}
            label={t.nodes.preamp.gain}
            formatValue={(v) => `+${v} dB`}
            onChange={(v) => updateNodeState({ preampGainDb: v })}
            color="var(--signal-good)"
            size={56}
          />
        </div>

        <SignalMeter db={preamp.out} health={preamp.health} label={t.meters.output} />
      </div>
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />
    </NodeWrapper>
  )
}
