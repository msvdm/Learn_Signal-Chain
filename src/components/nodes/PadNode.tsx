import { useMemo } from 'react'
import type { CardProps } from './cardProps'
import type { TypeKey } from '../../data/nodeRegistry'
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
 * A bare square button with its name under it (D11), the same at every zoom: its word lit while
 * it is on, greyed out (or another word) when not — one size for both words, so pressing it never
 * changes the word's size.
 */
function NamedButton({ id, typeKey, on, words, onToggle }: {
  id: string
  typeKey: TypeKey
  on: boolean
  words: { on: string; off: string }
  onToggle: () => void
}) {
  const fontSize = useMemo(() => {
    const room = BUTTON - 2 * (SQUARE_BORDER + BUTTON_PAD)
    return Math.min(...[words.on, words.off].map((word) => fitText(word, room, room, {
      family: cssVar('--lsc-font-sans'), weight: 800, letterSpacing: SQUARE_LETTER_SPACING, lineHeight: 1, maxSize: WORD_MAX,
    }).fontSize))
  }, [words.on, words.off])

  return (
    <FreeControl nodeId={id} typeKey={typeKey} label={useNodeName(id, typeKey)} portLine={BUTTON / 2}>
      <SquareButton on={on} tone="hot" size={BUTTON} fontSize={fontSize} onClick={onToggle}>
        {on ? words.on : words.off}
      </SquareButton>
    </FreeControl>
  )
}

/**
 * Pad: turns the signal down by 20 dB while it is on (a passive circuit: no hiss of its own), for a
 * microphone too loud for the Preamp — "−20 dB" lit while on.
 */
export function PadNode({ id }: CardProps) {
  const p                = useParams(id, 'pad')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()
  const engaged = p('engaged')
  return <NamedButton id={id} typeKey="pad" on={engaged} words={t.nodes.pad} onToggle={() => updateNodeParams(id, { engaged: !engaged })} />
}

/**
 * Phantom power: "48V", lit while on, greyed out when off. It passes the signal on unchanged; a
 * condenser microphone before it (ahead of the Preamp) gets its power from it — without, it sends
 * nothing (D21).
 */
export function PhantomNode({ id }: CardProps) {
  const p                = useParams(id, 'phantom')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()
  const on   = p('on')
  const word = t.nodes.phantom.button
  return <NamedButton id={id} typeKey="phantom" on={on} words={{ on: word, off: word }} onToggle={() => updateNodeParams(id, { on: !on })} />
}
