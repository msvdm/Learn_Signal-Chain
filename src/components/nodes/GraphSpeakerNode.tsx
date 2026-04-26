import type { NodeProps, Node } from '@xyflow/react'
import { Volume2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { GraphNodeWrapper } from './GraphNodeWrapper'
import { ControlSlider } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { getHealthStyle } from '../../hooks/useGainStaging'

interface GraphSpeakerData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function GraphSpeakerNode({ id, data }: NodeProps<Node<GraphSpeakerData>>) {
  const { stages, inputDb } = useGraphSignal()
  const node                = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams    = useSignalStore((s) => s.updateNodeParams)
  const { t }               = useTranslation()

  const params      = node?.params ?? {}
  const input       = inputDb[id] ?? -Infinity
  const result      = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const healthStyle = getHealthStyle(result.health)
  const trimDb      = (params.outputTrimDb as number) ?? 0

  const amplitude = Math.max(2, Math.min(18, ((result.out + 60) / 80) * 24))
  const isClipping = result.health === 'clipping'

  return (
    <GraphNodeWrapper
      nodeId={id}
      typeKey="speaker"
      icon={<Volume2 size={14} />}
      label={data.label ?? t.nodes.speaker.label}
      accentColor={data.color}
    >
      <div className="space-y-2">
        <SignalMeter db={input} health={getHealth(input)} label={t.meters.input} />

        <ControlSlider
          value={trimDb}
          min={-12}
          max={6}
          step={0.5}
          label="Output trim"
          formatValue={(v) => `${v >= 0 ? '+' : ''}${v} dB`}
          onChange={(v) => updateNodeParams(id, { outputTrimDb: v })}
        />

        {/* Waveform animation */}
        <div
          className="flex items-center justify-center h-10 rounded-lg"
          style={{ background: 'var(--lsc-sunken)', border: '1px solid var(--lsc-border)' }}
        >
          <motion.svg
            viewBox="0 0 100 40"
            className="w-full"
            style={{ height: 36 }}
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

        <SignalMeter db={result.out} health={result.health} label={t.nodes.speaker.signalIn} />

        <div
          className="rounded-lg px-2 py-1.5 text-center text-[10px] font-semibold"
          style={{
            background: healthStyle.bg,
            border: `1px solid ${healthStyle.border}`,
            color: healthStyle.color,
          }}
        >
          {result.health === 'good'      && t.nodes.speaker.statusGood}
          {result.health === 'hot'       && t.nodes.speaker.statusHot}
          {result.health === 'clipping'  && t.nodes.speaker.statusClipping}
          {result.health === 'too-quiet' && t.nodes.speaker.statusQuiet}
        </div>
      </div>
    </GraphNodeWrapper>
  )
}
