import type { NodeProps, Node } from '@xyflow/react'
import { Volume2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { InlineNode } from './InlineNode'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { getHealthStyle } from '../../hooks/useGainStaging'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphSpeakerData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function SpeakerNode({ id, data }: NodeProps<Node<GraphSpeakerData>>) {
  const { stages }  = useGraphSignal()
  const result      = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const healthStyle = getHealthStyle(result.health)
  const { t }       = useTranslation()

  const amplitude  = Math.max(2, Math.min(18, ((result.out + 60) / 80) * 24))
  const isClipping = result.health === 'clipping'

  return (
    <InlineNode
      nodeId={id}
      typeKey="speaker"
      icon={<Volume2 size={20} />}
      label={data.label ?? t.nodes.speaker.label}
      accentColor={data.color}
    >
      <motion.svg
        viewBox="0 0 60 24"
        style={{ width: 60, height: 24 }}
        animate={isClipping ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
        transition={isClipping ? { duration: 0.5, repeat: Infinity } : {}}
      >
        <motion.path
          animate={{
            d: `M 0 12 Q 7.5 ${12 - amplitude * 0.5} 15 12 Q 22.5 ${12 + amplitude * 0.5} 30 12 Q 37.5 ${12 - amplitude * 0.5} 45 12 Q 52.5 ${12 + amplitude * 0.5} 60 12`,
          }}
          fill="none"
          stroke={healthStyle.color}
          strokeWidth="2"
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        />
      </motion.svg>
    </InlineNode>
  )
}
