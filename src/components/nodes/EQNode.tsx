import { Handle, Position } from '@xyflow/react'
import { Activity } from 'lucide-react'
import { NodeWrapper, ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { KnobControl } from '../controls/KnobControl'
import { EQInlineGraph } from '../controls/EQInlineGraph'
import { useSignalChain } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'

const BAND_COLORS = ['#6366f1', '#f59e0b', '#10b981']

export function EQNode() {
  const { preamp, eq } = useSignalChain()
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateNodeState = useSignalStore((s) => s.updateNodeState)
  const updateEQBand = useSignalStore((s) => s.updateEQBand)
  const { t } = useTranslation()

  return (
    <NodeWrapper nodeId="eq" icon={<Activity size={14} />} label={t.nodes.eq.label}>
      <div className="space-y-3">
        <SignalMeter db={preamp.out} health={preamp.health} label={t.meters.input} />

        {/* Inline EQ graph */}
        <EQInlineGraph
          bands={nodeState.eqBands}
          hpfHz={nodeState.eqHpfHz}
          onBandChange={updateEQBand}
          height={80}
        />

        {/* HPF slider */}
        <ControlSlider
          value={nodeState.eqHpfHz}
          min={20}
          max={500}
          label={t.nodes.eq.highPass}
          formatValue={(v) => `${v} Hz`}
          onChange={(v) => updateNodeState({ eqHpfHz: v })}
        />

        {/* Band gain knobs */}
        <div className="flex justify-around py-1">
          {nodeState.eqBands.map((band, i) => (
            <KnobControl
              key={i}
              value={band.gainDb}
              min={-12}
              max={12}
              step={0.5}
              label={`${band.freqHz >= 1000 ? `${band.freqHz / 1000}k` : band.freqHz}Hz`}
              formatValue={(v) => `${v >= 0 ? '+' : ''}${v}dB`}
              onChange={(v) => updateEQBand(i, { gainDb: v })}
              color={BAND_COLORS[i]}
              size={44}
            />
          ))}
        </div>

        <SignalMeter db={eq.out} health={eq.health} label={t.meters.output} />
      </div>
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />
    </NodeWrapper>
  )
}
