import { Handle, Position } from '@xyflow/react'
import { Volume2 } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain } from '../../hooks/useSignalChain'
import { useTranslation } from '../../i18n/useTranslation'
import { motion } from 'framer-motion'

export function SpeakerNode() {
  const { master } = useSignalChain()
  const { t } = useTranslation()

  const waveColor =
    master.health === 'clipping'
      ? '#ef4444'
      : master.health === 'hot'
      ? '#eab308'
      : master.health === 'good'
      ? '#22c55e'
      : '#3b82f6'

  const amplitude = Math.max(2, Math.min(18, ((master.out + 60) / 80) * 24))
  const isClipping = master.health === 'clipping'

  return (
    <NodeWrapper nodeId="speaker" icon={<Volume2 size={14} />} label={t.nodes.speaker.label}>
      <div className="space-y-2">
        <SignalMeter db={master.out} health={master.health} label={t.nodes.speaker.signalIn} />

        {/* Waveform animation */}
        <div className="flex items-center justify-center h-12 bg-slate-50 rounded-lg border border-slate-100">
          <motion.svg
            viewBox="0 0 100 40"
            className="w-full"
            style={{ height: 40 }}
            animate={isClipping ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
            transition={isClipping ? { duration: 0.5, repeat: Infinity } : {}}
          >
            {/* Sine wave approximation */}
            <motion.path
              animate={{
                d: `M 0 20 Q 12.5 ${20 - amplitude} 25 20 Q 37.5 ${20 + amplitude} 50 20 Q 62.5 ${20 - amplitude} 75 20 Q 87.5 ${20 + amplitude} 100 20`,
              }}
              fill="none"
              stroke={waveColor}
              strokeWidth="2"
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            />
          </motion.svg>
        </div>

        <div className={`rounded-lg px-2 py-1.5 text-center text-[10px] font-semibold ${
          master.health === 'good'
            ? 'bg-green-50 text-green-700'
            : master.health === 'clipping'
            ? 'bg-red-50 text-red-700'
            : master.health === 'hot'
            ? 'bg-yellow-50 text-yellow-700'
            : 'bg-blue-50 text-blue-700'
        }`}>
          {master.health === 'good' && t.nodes.speaker.statusGood}
          {master.health === 'hot' && t.nodes.speaker.statusHot}
          {master.health === 'clipping' && t.nodes.speaker.statusClipping}
          {master.health === 'too-quiet' && t.nodes.speaker.statusQuiet}
        </div>
      </div>
      <Handle type="target" position={Position.Left} id="in" />
    </NodeWrapper>
  )
}
