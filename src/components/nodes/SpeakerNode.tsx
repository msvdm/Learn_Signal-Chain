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
      ? 'var(--signal-clipping)'
      : master.health === 'hot'
      ? 'var(--signal-hot)'
      : master.health === 'good'
      ? 'var(--signal-good)'
      : 'var(--signal-too-quiet)'

  const amplitude = Math.max(2, Math.min(18, ((master.out + 60) / 80) * 24))
  const isClipping = master.health === 'clipping'

  return (
    <NodeWrapper nodeId="speaker" icon={<Volume2 size={14} />} label={t.nodes.speaker.label}>
      <div className="space-y-2">
        <SignalMeter db={master.out} health={master.health} label={t.nodes.speaker.signalIn} />

        {/* Waveform animation */}
        <div
          className="flex items-center justify-center h-12 rounded-lg"
          style={{ background: '#0d0f13', border: '1px solid #1e2128' }}
        >
          <motion.svg
            viewBox="0 0 100 40"
            className="w-full"
            style={{ height: 40 }}
            animate={isClipping ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
            transition={isClipping ? { duration: 0.5, repeat: Infinity } : {}}
          >
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
            color: waveColor,
          }}
        >
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
