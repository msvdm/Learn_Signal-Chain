import { Handle, Position } from '@xyflow/react'
import { Mic } from 'lucide-react'
import { NodeWrapper, ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { levels } from '../../data/levels'

export function MicrophoneNode() {
  const { mic } = useSignalChain()
  const level = useSignalStore((s) => s.level)
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateNodeState = useSignalStore((s) => s.updateNodeState)
  const levelConfig = levels[level]
  const canAdjustMic = levelConfig.interactiveNodes.includes('mic')
  const { t } = useTranslation()

  return (
    <NodeWrapper nodeId="mic" icon={<Mic size={14} />} label={t.nodes.mic.label}>
      <div className="space-y-2">
        <SignalMeter db={mic.out} health={mic.health} label={t.meters.output} />
        {canAdjustMic && (
          <ControlSlider
            value={nodeState.micSensitivityDb}
            min={-70}
            max={-40}
            label={t.nodes.mic.sensitivity}
            formatValue={(v) => `${v} dBu`}
            onChange={(v) => updateNodeState({ micSensitivityDb: v })}
          />
        )}
        {!canAdjustMic && (
          <p className="text-[10px] text-slate-400 leading-relaxed">
            {t.nodes.mic.micInfo}
          </p>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </NodeWrapper>
  )
}
