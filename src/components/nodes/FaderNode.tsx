import type { NodeProps, Node } from '@xyflow/react'
import { SlidersHorizontal } from 'lucide-react'
import { InlineNode } from './InlineNode'
import { VerticalFader } from '../controls/VerticalFader'
import { SignalMeter } from '../SignalMeter'
import { useSignalStore } from '../../store/signalStore'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useTranslation } from '../../i18n/useTranslation'

interface GraphFaderData extends Record<string, unknown> {
  color?: string
  label?: string
}

/**
 * A plain fader, or — wired straight after a stereo bus — the Main Fader: one handle for
 * the whole mix, with the bus's Left and Right outputs moved onto it.
 */
export function FaderNode({ id, data }: NodeProps<Node<GraphFaderData>>) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { stages }       = useGraphSignal()
  const levels           = useStereoLevels(id)
  const { t }            = useTranslation()

  const faderDb = (node?.params.faderDb as number) ?? 0
  const main    = stages[id]?.mainFader ?? false

  return (
    <InlineNode
      nodeId={id}
      typeKey="fader"
      icon={<SlidersHorizontal size={16} />}
      label={data.label ?? (main ? t.nodes['main-fader'].label : t.nodes.fader.label)}
      accentColor={data.color}
    >
      <VerticalFader
        value={faderDb}
        min={-80}
        max={10}
        step={1}
        formatValue={(v) => (v <= -80 ? '−∞' : `${v > 0 ? '+' : ''}${v} dB`)}
        onChange={(v) => updateNodeParams(id, { faderDb: v })}
        unityLabel={t.nodes.fader.unity.toLowerCase()}
      />
      {main && (
        <div style={{ alignSelf: 'stretch' }}>
          <SignalMeter
            db={levels.out} dbR={levels.outR}
            health={getHealth(Math.max(levels.out, levels.outR ?? -Infinity))}
            label={t.meters.output} showValue={false}
          />
        </div>
      )}
    </InlineNode>
  )
}
