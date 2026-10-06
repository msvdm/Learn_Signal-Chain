import type { ReactNode } from 'react'

/** Letter spacing of the button's word (em) — measure the word with it (fitText) */
export const SQUARE_LETTER_SPACING = 0.04
/** Its border (px): the word has the button less this on each side */
export const SQUARE_BORDER = 3

/**
 * The big square On / Off button of a free-standing switch (the On Off Switch, the Pad): its word,
 * lit in a signal colour while on — green for the Switch, the hot colour for the Pad's −20 dB.
 */
export function SquareButton({ on, tone, size, fontSize, onClick, children }: {
  on: boolean
  /** The signal colour it is lit in while on */
  tone: 'good' | 'hot'
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
        background: on ? `var(--signal-${tone}-bg)` : 'var(--lsc-sunken)',
        border: `${SQUARE_BORDER}px solid ${on ? `var(--signal-${tone})` : 'var(--lsc-border)'}`,
        color: on ? `var(--signal-${tone}-text)` : 'var(--lsc-fg-muted)',
        boxShadow: 'var(--lsc-shadow-node)',
        cursor: 'pointer',
        transition: 'background 0.1s, border-color 0.1s, color 0.1s',
      }}
    >
      {children}
    </button>
  )
}
