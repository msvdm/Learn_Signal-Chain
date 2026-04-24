import { Handle, Position } from '@xyflow/react'
import { Volume2 } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain } from '../../hooks/useSignalChain'
import { useTranslation } from '../../i18n/useTranslation'
import { getHealthStyle } from '../../hooks/useGainStaging'
import { motion } from 'framer-motion'

export function SpeakerNode({ id }: { id: string }) {
  const { stages } = useSignalChain()
  const { t } = useTranslation()

  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const healthStyle = getHealthStyle(result.health)

  const amplitude = Math.max(2, Math.min(18, ((result.out + 60) / 80) * 24))
  const isClipping = result.health === 'clipping'

  return (
    <NodeWrapper nodeId={id} icon={<Volume2 size={14} />} label={t.nodes.speaker.label}>
      <div className="space-y-2">
        <SignalMeter db={result.out} health={result.health} label={t.nodes.speaker.signalIn} />

        {/* Waveform animation */}
        <div
          className="flex items-center justify-center h-12 rounded-lg"
          style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}
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
              stroke={healthStyle.color}
              strokeWidth="2"
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            />
          </motion.svg>
        </div>

        <div
          className="rounded-lg px-2 py-1.5 text-center text-[10px] font-semibold"
          style={{
            background: healthStyle.bg,
            border: `1px solid ${healthStyle.border}`,
            color: healthStyle.color,
          }}
        >
          {result.health === 'good' && t.nodes.speaker.statusGood}
          {result.health === 'hot' && t.nodes.speaker.statusHot}
          {result.health === 'clipping' && t.nodes.speaker.statusClipping}
          {result.health === 'too-quiet' && t.nodes.speaker.statusQuiet}
        </div>
      </div>
      <Handle type="target" position={Position.Left} id="in" />
    </NodeWrapper>
  )
}
