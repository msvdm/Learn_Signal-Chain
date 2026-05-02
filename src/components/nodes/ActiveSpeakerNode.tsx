import type { NodeProps, Node } from '@xyflow/react'
import { Volume2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { NodeWrapper } from './NodeWrapper'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { getHealthStyle } from '../../hooks/useGainStaging'

interface GraphActiveSpeakerData extends Record<string, unknown> {
  color?: string
  label?: string
}

function buildWavePath(amplitude: number): string {
  const a = amplitude
  return `M 0 12 Q 7.5 ${12 - a * 0.5} 15 12 Q 22.5 ${12 + a * 0.5} 30 12 Q 37.5 ${12 - a * 0.5} 45 12 Q 52.5 ${12 + a * 0.5} 60 12`
}

export function ActiveSpeakerNode({ id, data }: NodeProps<Node<GraphActiveSpeakerData>>) {
  const { stages, inputDb } = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)

  const params     = node?.params ?? {}
  const input      = inputDb[id] ?? -Infinity
  const result     = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const volumeDb   = (params.volumeDb as number) ?? 0
  const healthStyle = getHealthStyle(result.health)

  const amplitude  = Math.max(2, Math.min(18, ((result.out + 60) / 80) * 24))
  const isClipping = result.health === 'clipping'

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="active-speaker"
      icon={<Volume2 size={14} />}
      label={data.label ?? 'Active Speaker'}
      accentColor={data.color}
    >
      <div className="space-y-3">
        <SignalMeter db={input} health={getHealth(input)} label="Input" />

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <KnobControl
            value={volumeDb}
            min={-20}
            max={10}
            step={0.5}
            label="Volume"
            formatValue={(v) => `${v >= 0 ? '+' : ''}${v} dB`}
            onChange={(v) => updateNodeParams(id, { volumeDb: v })}
            color="var(--signal-good)"
            size={48}
          />
        </div>

        <motion.svg
          viewBox="0 0 60 24"
          style={{ width: '100%', height: 24 }}
          animate={isClipping ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
          transition={isClipping ? { duration: 0.5, repeat: Infinity } : {}}
        >
          <motion.path
            animate={{ d: buildWavePath(amplitude) }}
            fill="none"
            stroke={healthStyle.color}
            strokeWidth="2"
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          />
        </motion.svg>

        <SignalMeter db={result.out} health={result.health} label="Output" />
      </div>
    </NodeWrapper>
  )
}
