import { Handle, Position } from '@xyflow/react'
import { Layers } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

export function MasterBusNode() {
  const { fader, master } = useSignalChain()
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateNodeState = useSignalStore((s) => s.updateNodeState)
  const { t } = useTranslation()

  return (
    <NodeWrapper nodeId="master" icon={<Layers size={14} />} label={t.nodes.master.label}>
      <div className="space-y-3">
        <SignalMeter db={fader.out} health={fader.health} label={t.meters.input} />

        <div className="flex justify-center py-1">
          <KnobControl
            value={nodeState.masterTrimDb}
            min={-12}
            max={12}
            step={0.5}
            label={t.nodes.master.outputTrim}
            formatValue={(v) => `${v >= 0 ? '+' : ''}${v}dB`}
            onChange={(v) => updateNodeState({ masterTrimDb: v })}
            color="#818cf8"
            size={52}
          />
        </div>

        <SignalMeter db={master.out} health={master.health} label={t.meters.output} />

        <div
          className="rounded-lg px-2 py-1.5 text-center text-[10px] font-semibold"
          style={{
            background:
              master.health === 'good' ? 'rgba(74,222,128,0.1)'
              : master.health === 'clipping' ? 'rgba(248,113,113,0.1)'
              : master.health === 'hot' ? 'rgba(250,204,21,0.1)'
              : 'rgba(96,165,250,0.1)',
            border: `1px solid ${
              master.health === 'good' ? 'rgba(74,222,128,0.2)'
              : master.health === 'clipping' ? 'rgba(248,113,113,0.2)'
              : master.health === 'hot' ? 'rgba(250,204,21,0.2)'
              : 'rgba(96,165,250,0.2)'
            }`,
            color:
              master.health === 'good' ? 'var(--signal-good)'
              : master.health === 'clipping' ? 'var(--signal-clipping)'
              : master.health === 'hot' ? 'var(--signal-hot)'
              : 'var(--signal-too-quiet)',
          }}
        >
          {master.health === 'good' && t.nodes.master.statusGood}
          {master.health === 'hot' && t.nodes.master.statusHot}
          {master.health === 'clipping' && t.nodes.master.statusClipping}
          {master.health === 'too-quiet' && t.nodes.master.statusQuiet}
        </div>
      </div>
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />
    </NodeWrapper>
  )
}
