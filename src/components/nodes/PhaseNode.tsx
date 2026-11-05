import type { CardProps } from './cardProps'
import { useTranslation } from '../../i18n/useTranslation'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { SquareButton } from '../controls/SquareButton'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'

// The On Off Switch's button: the same size
const BUTTON = 110

/**
 * The Phase switch (from Intermediate): pressed, the signal leaves upside down — lit light blue, as the
 * Parametric equalizer's first band. Drawn as the On Off Switch is, one big square button, the
 * polarity sign Ø on it instead of On / Off. Alone it changes nothing you hear; added on a bus to
 * the same signal the right way up, the two cancel out (real sound shows it — the render).
 */
export function PhaseNode({ id }: CardProps) {
  const p                = useParams(id, 'phase')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()
  const name             = useNodeName(id, 'phase')

  const inverted = p('inverted')

  return (
    <FreeControl nodeId={id} typeKey="phase" label={name} showName={false} portLine={BUTTON / 2}>
      <SquareButton on={inverted} tone="phase" size={BUTTON} fontSize={56} onClick={() => updateNodeParams(id, { inverted: !inverted })}>
        <span role="img" aria-label={inverted ? t.nodes.phase.invert : name} style={{ lineHeight: 1 }}>Ø</span>
      </SquareButton>
    </FreeControl>
  )
}
