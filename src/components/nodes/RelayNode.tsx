import type { CardProps } from './cardProps'
import { useTranslation } from '../../i18n/useTranslation'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { fitText, cssVar } from '../../utils/fitText'

const GAP        = 12     // between the buttons
const BORDER     = 3      // a button's border
const BUTTON_PAD = 8      // inside a button, around its word
const WORD_MAX   = 48

/**
 * Pre / Post switch (type `relay`): the button by an aux send that picks where the send takes its
 * copy of the channel — PRE (top input, `a`) from before the fader, POST (lower input, `b`) from
 * after it. Two inputs, one output: the chosen input goes out, the other is cut off. One look at
 * every zoom: the PRE / POST buttons fill the card, big enough to click zoomed out; the name
 * shows on hover.
 */
export function RelayNode({ id }: CardProps) {
  const p                = useParams(id, 'relay')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()
  const selected         = p('selectedInput')

  const choices = [
    { input: 'a', word: t.nodes.relay.pre },
    { input: 'b', word: t.nodes.relay.post },
  ] as const

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="relay"
      label={useNodeName(id, 'relay')}
      faceOnly
      overviewLevel={false}
      overviewArt={(box) => {
        const innerW = (box.w - GAP) / 2 - 2 * (BORDER + BUTTON_PAD)
        const innerH = box.h - 2 * (BORDER + BUTTON_PAD)
        // One size for both words, so the two buttons match
        const wordSize = Math.min(...choices.map((c) => fitText(c.word, innerW, innerH, {
          family: cssVar('--lsc-font-sans'), weight: 800, lineHeight: 1, maxSize: WORD_MAX,
        }).fontSize))

        return (
          // The face ignores the pointer; the buttons take it back
          <div className="nodrag nopan" style={{ pointerEvents: 'auto', width: box.w, height: box.h, display: 'flex', gap: GAP }}>
            {choices.map((c) => {
              const on = selected === c.input
              return (
                <button
                  key={c.input}
                  aria-pressed={on}
                  onClick={() => updateNodeParams(id, { selectedInput: c.input })}
                  style={{
                    flex: 1, minWidth: 0, height: '100%', padding: BUTTON_PAD,
                    fontSize: wordSize, fontWeight: 800, lineHeight: 1, whiteSpace: 'nowrap',
                    borderRadius: 'var(--lsc-radius-lg)',
                    border: `${BORDER}px solid ${on ? 'var(--signal-good)' : 'var(--lsc-border)'}`,
                    background: on ? 'var(--signal-good-bg)' : 'var(--lsc-sunken)',
                    color: on ? 'var(--signal-good-text)' : 'var(--lsc-fg-muted)',
                    cursor: on ? 'default' : 'pointer',
                    transition: 'background 0.1s, border-color 0.1s, color 0.1s',
                  }}
                >
                  {c.word}
                </button>
              )
            })}
          </div>
        )
      }}
    />
  )
}
