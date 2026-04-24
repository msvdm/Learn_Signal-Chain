import { Handle, Position } from '@xyflow/react'
import { Mic } from 'lucide-react'
import { NodeWrapper, ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

export function MicrophoneNode({ id }: { id: string }) {
  const { stages } = useSignalChain()
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateNodeState = useSignalStore((s) => s.updateNodeState)
  const { t } = useTranslation()

  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  return (
    <NodeWrapper nodeId={id} icon={<Mic size={14} />} label={t.nodes.mic.label}>
      <div className="space-y-2">
        <SignalMeter db={result.out} health={result.health} label={t.meters.output} />
        <ControlSlider
          value={nodeState.micSensitivityDb}
          min={-70}
          max={-40}
          label={t.nodes.mic.sensitivity}
          formatValue={(v) => `${v} dBu`}
          onChange={(v) => updateNodeState({ micSensitivityDb: v })}
        />
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--lsc-fg-dim)' }}>
          {t.nodes.mic.micInfo}
        </p>
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </NodeWrapper>
  )
}
