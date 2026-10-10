import type { ReactNode } from 'react'

/** Letter spacing of the button's word (em) — measure the word with it (fitText) */
export const SQUARE_LETTER_SPACING = 0.04
/** Its border (px): the word has the button less this on each side */
export const SQUARE_BORDER = 3

/** The colours a button is lit in while on: its rim, its fill, its word. */
const TONES = {
  good:     { rim: 'var(--signal-good)',     fill: 'var(--signal-good-bg)',     word: 'var(--signal-good-text)' },
  hot:      { rim: 'var(--signal-hot)',      fill: 'var(--signal-hot-bg)',      word: 'var(--signal-hot-text)' },
  clipping: { rim: 'var(--signal-clipping)', fill: 'var(--signal-clipping-bg)', word: 'var(--signal-clipping-text)' },
  // Violet, as the Pan's knob; its word a shade towards the text colour, readable on both themes
  accent:   { rim: 'var(--lsc-accent)',      fill: 'var(--lsc-accent-bg)',      word: 'color-mix(in srgb, var(--lsc-accent) 75%, var(--lsc-fg))' },
} as const

export type ButtonTone = keyof typeof TONES

/**
 * The big square On / Off button of a free-standing switch: its word, lit while on — green for the
 * On Off Switch, the hot colour for the Pad's −20 dB, red for 48V, violet for the HPF.
 */
export function SquareButton({ on, tone, size, fontSize, onClick, children }: {
  on: boolean
  /** The colour it is lit in while on */
  tone: ButtonTone
  /** Its side (px) */
  size: number
  fontSize: number
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      className="nodrag nopan"
      aria-pressed={on}
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: 24, padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize, fontWeight: 800, letterSpacing: `${SQUARE_LETTER_SPACING}em`, whiteSpace: 'nowrap',
        background: on ? TONES[tone].fill : 'var(--lsc-sunken)',
        border: `${SQUARE_BORDER}px solid ${on ? TONES[tone].rim : 'var(--lsc-border)'}`,
        color: on ? TONES[tone].word : 'var(--lsc-fg-muted)',
        boxShadow: 'var(--lsc-shadow-node)',
        cursor: 'pointer',
        transition: 'background 0.1s, border-color 0.1s, color 0.1s',
      }}
    >
      {children}
    </button>
  )
}
