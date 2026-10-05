import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { ControlSlider } from './ControlSlider'
import { SignalMeter } from '../SignalMeter'
import { GAIN_OFF_DB } from '../../signal/process'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useParams } from '../../hooks/useParams'
import { twoColumnCard, twoColumns } from '../../utils/twoColumns'

// The amp only turns down: line level is already loud, so full (0 dB) passes it on unchanged
const formatLevel = (v: number) => (v <= GAIN_OFF_DB ? '−∞' : `${v} dB`)

export function AmpNode({ id }: CardProps) {
  const p                   = useParams(id, 'amp')
  const updateNodeParams    = useSignalStore((s) => s.updateNodeParams)
  const { t }               = useTranslation()

  const levels = useStereoLevels(id)
  const gainDb  = Math.min(p('gainDb'), 0)
  const gainDbR = Math.min(p('gainDbR') ?? gainDb, 0)
  // Fed a stereo wire it is a two-channel amp: a Volume knob for each side
  const stereo  = levels.stereo

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="amp"
      label={useNodeName(id, 'amp')}
      style={twoColumnCard}
    >
      {/* Landscape: In | Out meters side by side, the Volume slider(s) under them */}
      <div style={twoColumns}>
        <SignalMeter {...levels.input} label={t.meters.input} />
        <SignalMeter {...levels.output} label={t.meters.output} />

        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        </div>
      </div>
    </NodeWrapper>
  )
}
