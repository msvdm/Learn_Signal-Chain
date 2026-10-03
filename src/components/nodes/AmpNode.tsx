import type { NodeProps, Node } from '@xyflow/react'
import { Radio } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { ControlSlider } from './ControlSlider'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal, getHealth, GAIN_OFF_DB } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useStereoLevels } from '../../hooks/useStereoLevels'

interface GraphAmpData extends Record<string, unknown> {
  color?: string
  label?: string
}

// The amp only turns down: line level is already loud, so full (0 dB) passes it on unchanged
const formatLevel = (v: number) => (v <= GAIN_OFF_DB ? '−∞' : `${v} dB`)

export function AmpNode({ id, data }: NodeProps<Node<GraphAmpData>>) {
  const { stages }          = useGraphSignal()
  const node                = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams    = useSignalStore((s) => s.updateNodeParams)
  const { t }               = useTranslation()

  const params = node?.params ?? {}
  const levels = useStereoLevels(id)
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const gainDb  = Math.min((params.gainDb as number) ?? 0, 0)
  const gainDbR = Math.min((params.gainDbR as number) ?? gainDb, 0)
  // Fed a stereo wire it is a two-channel amp: a Volume knob for each side
  const stereo  = levels.stereo

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="amp"
      icon={<Radio size={16} />}
      label={data.label ?? t.palette.items['amp']}
      accentColor={data.color}
    >
      <div className="space-y-3">
        <SignalMeter db={levels.in} dbR={levels.inR} health={getHealth(levels.inPeak, levels.inDomain)} domain={levels.inDomain} label={t.meters.input} />

        <ControlSlider
          value={gainDb}
          min={GAIN_OFF_DB}
          max={0}
          label={stereo ? t.nodes.amp.levelL : t.nodes.amp.level}
          formatValue={formatLevel}
          onChange={(v) => updateNodeParams(id, { gainDb: v })}
        />
        {stereo && (
          <ControlSlider
            value={gainDbR}
            min={GAIN_OFF_DB}
            max={0}
            label={t.nodes.amp.levelR}
            formatValue={formatLevel}
            onChange={(v) => updateNodeParams(id, { gainDbR: v })}
          />
        )}

        <SignalMeter db={levels.out} dbR={levels.outR} domain={levels.outDomain} health={result.health} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
