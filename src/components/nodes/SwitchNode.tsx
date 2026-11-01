import type { CardProps } from './cardProps'
import { useTranslation } from '../../i18n/useTranslation'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { SquareButton } from '../controls/SquareButton'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useStage } from '../../hooks/useGraphSignal'

// A free-standing button, big enough to read zoomed out
const BUTTON = 110

/**
 * On = the signal passes, Off = silence. Drawn as one big square On / Off button (no card, no name:
 * the button says it all). Wired into a PFL Bus it is that channel's PFL button (role 'pfl'): "PFL"
 * on or off, lit solid yellow — it works the same.
 */
export function SwitchNode({ id }: CardProps) {
  const p                = useParams(id, 'switch')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()
  const pfl              = useStage(id)?.role === 'pfl'

  const isOn = p('on')

  return (
    <FreeControl nodeId={id} typeKey="switch" label={useNodeName(id, 'switch')} showName={false} portLine={BUTTON / 2}>
      <SquareButton on={isOn} tone={pfl ? 'pfl' : 'good'} size={BUTTON} fontSize={32} onClick={() => updateNodeParams(id, { on: !isOn })}>
        {pfl ? t.nodes.pfl.label : isOn ? t.nodeControls.on : t.nodeControls.off}
      </SquareButton>
    </FreeControl>
  )
}
