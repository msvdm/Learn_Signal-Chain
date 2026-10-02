import type { NodeProps, Node } from '@xyflow/react'
import { Zap } from 'lucide-react'
import { InlineNode } from './InlineNode'
import { KnobControl } from '../controls/KnobControl'
import { useSignalStore } from '../../store/signalStore'
import { useGraphSignal, GAIN_OFF_DB } from '../../hooks/useSignalChain'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphGainData extends Record<string, unknown> {
  color?: string
  label?: string
}

/**
 * Right after a microphone (effects such as a Pad may sit in between) this is the Preamp:
 * 0…+60 dB to lift mic level up to line level. Anywhere else it is a plain gain stage:
 * −∞…+20 dB, turning any signal up or down. Each mode keeps its own setting.
 */
export function GainNode({ id, data }: NodeProps<Node<GraphGainData>>) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { stages }       = useGraphSignal()
  const { t }            = useTranslation()

  const preamp = stages[id]?.preamp ?? false
  const label  = data.label ?? (preamp ? t.nodes.preamp.label : t.palette.items.gain)

  return (
    <InlineNode
      nodeId={id}
      typeKey="gain"
      icon={<Zap size={20} />}
      label={label}
      accentColor={data.color}
    >
      {preamp ? (
        <KnobControl
          key="preamp"
          value={(node?.params.preampDb as number) ?? 40}
          min={0}
          max={60}
          label={t.nodes.preamp.gain}
          formatValue={(v) => `+${v} dB`}
          onChange={(v) => updateNodeParams(id, { preampDb: v })}
          color="var(--signal-good)"
          size={56}
        />
      ) : (
        <KnobControl
          key="gain"
          value={(node?.params.gainDb as number) ?? 0}
          min={GAIN_OFF_DB}
          max={20}
          label={t.nodes.preamp.gain}
          formatValue={(v) => (v <= GAIN_OFF_DB ? '−∞' : `${v > 0 ? '+' : ''}${v} dB`)}
          onChange={(v) => updateNodeParams(id, { gainDb: v })}
          color="var(--signal-good)"
          size={56}
        />
      )}
    </InlineNode>
  )
}
