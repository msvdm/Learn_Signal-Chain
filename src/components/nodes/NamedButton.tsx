import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { TypeKey } from '../../data/nodeRegistry'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { SquareButton, SQUARE_BORDER, SQUARE_LETTER_SPACING } from '../controls/SquareButton'
import { fitText, cssVar } from '../../utils/fitText'

// A free-standing button, big enough to read zoomed out — the On Off Switch's size
const BUTTON     = 110
const BUTTON_PAD = 4      // inside the button, around its word
const WORD_MAX   = 32     // the On Off Switch's word size

/**
 * A desk's push button (the Pad, 48V, the HPF below Advanced): a bare square button with its name
 * under it (D11), the same at every zoom — its word lit while it is on, greyed out (or another word)
 * when not. One size for both words, so pressing it never changes the word's size.
 */
export function NamedButton({ id, typeKey, on, words, onToggle, value }: {
  id: string
  typeKey: TypeKey
  on: boolean
  words: { on: string; off: string }
  onToggle: () => void
  /** Under its name (the HPF's fixed cutoff) */
  value?: ReactNode
}) {
  const fontSize = useMemo(() => {
    const room = BUTTON - 2 * (SQUARE_BORDER + BUTTON_PAD)
    return Math.min(...[words.on, words.off].map((word) => fitText(word, room, room, {
      family: cssVar('--lsc-font-sans'), weight: 800, letterSpacing: SQUARE_LETTER_SPACING, lineHeight: 1, maxSize: WORD_MAX,
    }).fontSize))
  }, [words.on, words.off])

  return (
    <FreeControl nodeId={id} typeKey={typeKey} label={useNodeName(id, typeKey)} value={value} portLine={BUTTON / 2}>
      <SquareButton on={on} tone="hot" size={BUTTON} fontSize={fontSize} onClick={onToggle}>
        {on ? words.on : words.off}
      </SquareButton>
    </FreeControl>
  )
}
