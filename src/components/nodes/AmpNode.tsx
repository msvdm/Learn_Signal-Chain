import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { ControlSlider } from './ControlSlider'
import { SignalMeter } from '../SignalMeter'
import { useGraphSignal } from '../../hooks/useGraphSignal'
import { getHealth } from '../../signal/levels'
import { GAIN_OFF_DB } from '../../signal/process'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useParams } from '../../hooks/useParams'

// The amp only turns down: line level is already loud, so full (0 dB) passes it on unchanged
const formatLevel = (v: number) => (v <= GAIN_OFF_DB ? '−∞' : `${v} dB`)

export function AmpNode({ id }: CardProps) {
  const { stages }          = useGraphSignal()
  const p                   = useParams(id, 'amp')
  const updateNodeParams    = useSignalStore((s) => s.updateNodeParams)
  const { t }               = useTranslation()

  const levels = useStereoLevels(id)
  const result = stages[id]
  const gainDb  = Math.min(p('gainDb'), 0)
  const gainDbR = Math.min(p('gainDbR') ?? gainDb, 0)
  // Fed a stereo wire it is a two-channel amp: a Volume knob for each side
  const stereo  = levels.stereo

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="amp"
      label={useNodeName(id, 'amp')}
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

        <SignalMeter db={levels.out} dbR={levels.outR} domain={levels.outDomain} health={result?.health ?? 'too-quiet'} label={t.meters.output} />
      </div>
    </NodeWrapper>
  )
}
