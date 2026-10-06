import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { ControlSlider } from './ControlSlider'
import { MeterSides } from './MeterSides'
import { GAIN_OFF_DB } from '../../signal/process'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useParams } from '../../hooks/useParams'
import { COLUMN_W } from '../../utils/twoColumns'

// The amp only turns down: line level is already loud, so full (0 dB) passes it on unchanged
const formatLevel = (v: number) => (v <= GAIN_OFF_DB ? '−∞' : `${v} dB`)

export function AmpNode({ id }: CardProps) {
  const p                   = useParams(id, 'amp')
  const updateNodeParams    = useSignalStore((s) => s.updateNodeParams)
  const { t }               = useTranslation()

  const levels = useStereoLevels(id)
  const gainDb  = Math.min(p('gainDb'), 0)
  const gainDbR = Math.min(p('gainDbR') ?? gainDb, 0)
  // Fed a stereo wire it is a two-channel amp: channel A takes the left side, B the right, each
  // with its own Volume. Until B is turned it follows A, so A's first turn keeps B where it is.
  const stereo  = levels.stereo
  const setA    = (v: number) =>
    updateNodeParams(id, stereo && p('gainDbR') === undefined ? { gainDb: v, gainDbR: gainDb } : { gainDb: v })

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="amp"
      label={useNodeName(id, 'amp')}
    >
      {/* In | the Volume slider(s) | Out */}
      <MeterSides nodeId={id}>
        <div style={{ width: COLUMN_W, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ControlSlider
            value={gainDb}
            min={GAIN_OFF_DB}
            max={0}
            label={stereo ? t.nodes.amp.levelA : t.nodes.amp.level}
            formatValue={formatLevel}
            onChange={setA}
          />
          {stereo && (
            <ControlSlider
              value={gainDbR}
              min={GAIN_OFF_DB}
              max={0}
              label={t.nodes.amp.levelB}
              formatValue={formatLevel}
              onChange={(v) => updateNodeParams(id, { gainDbR: v })}
            />
          )}
        </div>
      </MeterSides>
    </NodeWrapper>
  )
}
