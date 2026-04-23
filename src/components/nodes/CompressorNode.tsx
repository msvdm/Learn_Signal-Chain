import { Handle, Position } from '@xyflow/react'
import { Minimize2 } from 'lucide-react'
import { NodeWrapper, ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { motion } from 'framer-motion'

const RATIOS = [2, 4, 8, 100] as const
const RATIO_LABELS: Record<number, string> = { 2: '2:1', 4: '4:1', 8: '8:1', 100: '∞:1' }

export function CompressorNode() {
  const { eq, comp } = useSignalChain()
  const nodeState = useSignalStore((s) => s.nodeState)
  const updateNodeState = useSignalStore((s) => s.updateNodeState)
  const { t } = useTranslation()

  const grPct = Math.min(100, (comp.gainReductionDb / 20) * 100)

  return (
    <NodeWrapper nodeId="comp" icon={<Minimize2 size={14} />} label={t.nodes.comp.label}>
      <div className="space-y-2">
        <SignalMeter db={eq.out} health={eq.health} label={t.meters.input} />

        <ControlSlider
          value={nodeState.compThresholdDb}
          min={-60}
          max={0}
          label={t.nodes.comp.threshold}
          formatValue={(v) => `${v} dBu`}
          onChange={(v) => updateNodeState({ compThresholdDb: v })}
        />

        {/* Ratio selector */}
        <div className="nodrag space-y-1">
          <span className="text-[10px] text-slate-500">{t.nodes.comp.ratio}</span>
          <div className="flex gap-1">
            {RATIOS.map((r) => (
              <button
                key={r}
                onClick={() => updateNodeState({ compRatio: r })}
                className={`flex-1 rounded text-[10px] py-1 font-semibold transition-colors ${
                  nodeState.compRatio === r
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {RATIO_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        <ControlSlider
          value={nodeState.compMakeupGainDb}
          min={0}
          max={20}
          label={t.nodes.comp.makeupGain}
          formatValue={(v) => `+${v} dB`}
          onChange={(v) => updateNodeState({ compMakeupGainDb: v })}
        />

        {/* Gain reduction indicator */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">{t.nodes.comp.gainReduction}</span>
            <span className="text-[10px] font-mono font-semibold text-slate-700">
              -{comp.gainReductionDb.toFixed(1)} dB
            </span>
          </div>
          <div className="relative h-1.5 w-full rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
            <motion.div
              className="absolute right-0 top-0 h-full rounded-full bg-violet-400"
              animate={{ width: `${grPct}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>
        </div>

        <SignalMeter db={comp.out} health={comp.health} label={t.meters.output} />
      </div>
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="source" position={Position.Right} id="out" />
    </NodeWrapper>
  )
}
