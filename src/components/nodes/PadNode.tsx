import { useMemo } from 'react'
import type { CardProps } from './cardProps'
import { useTranslation } from '../../i18n/useTranslation'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { SquareButton, SQUARE_BORDER, SQUARE_LETTER_SPACING } from '../controls/SquareButton'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { fitText, cssVar } from '../../utils/fitText'

// A free-standing button, big enough to read zoomed out — the On Off Switch's size
const BUTTON     = 110
const BUTTON_PAD = 4      // inside the button, around its word
const WORD_MAX   = 32     // the On Off Switch's word size

/**
 * Pad: turns the signal down by 20 dB while it is on (a passive circuit: no hiss of its own), for a
 * microphone too loud for the Preamp. One of the buttons (decision D11): a bare square button, no
 * card — "−20 dB" lit while on, "OFF" when not — with its name under it, the same at every zoom.
 */
export function PadNode({ id }: CardProps) {
  const p                = useParams(id, 'pad')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const engaged = p('engaged')
  const { on, off } = t.nodes.pad

  // One size for both words, so pressing it never changes the word's size
  const fontSize = useMemo(() => {
    const room = BUTTON - 2 * (SQUARE_BORDER + BUTTON_PAD)
    return Math.min(...[on, off].map((word) => fitText(word, room, room, {
      family: cssVar('--lsc-font-sans'), weight: 800, letterSpacing: SQUARE_LETTER_SPACING, lineHeight: 1, maxSize: WORD_MAX,
    }).fontSize))
  }, [on, off])

  return (
    <FreeControl nodeId={id} typeKey="pad" label={useNodeName(id, 'pad')} portLine={BUTTON / 2}>
      <SquareButton on={engaged} tone="hot" size={BUTTON} fontSize={fontSize} onClick={() => updateNodeParams(id, { engaged: !engaged })}>
        {engaged ? on : off}
      </SquareButton>
    </FreeControl>
  )
}
