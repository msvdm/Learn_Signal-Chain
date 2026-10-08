import type { CSSProperties, ReactNode } from 'react'

export interface Choice<T extends string> {
  value: T
  /** Its word on the button */
  label: string
  /** A small picture before (or over) the word */
  icon: ReactNode
}

interface ChoiceButtonsProps<T extends string> {
  choices: readonly Choice<T>[]
  value: T
  onChange: (value: T) => void
  /** What is being chosen (read out by screen readers) */
  label: string
  /** Buttons per row: 1 stacks them */
  columns: number
  /** 'column': the picture over the word · 'row': beside it */
  item?: 'row' | 'column'
  fontSize?: number
  style?: CSSProperties
}

/**
 * A few buttons, one of them chosen — the Generator's Sound, a Microphone's or Line Input's
 * Melodic / Percussive. The chosen one is lit like the Relay Switch's A / B. The buttons share the
 * grid's space evenly, so choosing never resizes the card.
 */
export function ChoiceButtons<T extends string>({
  choices, value, onChange, label, columns, item = 'column', fontSize = 12, style,
}: ChoiceButtonsProps<T>) {
  return (
    <div
      className="nodrag nopan"
      role="radiogroup"
      aria-label={label}
      // Given a height, the rows share it
      style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: 'minmax(0, 1fr)', gap: 6, ...style }}
    >
      {choices.map((c) => {
        const on = c.value === value
        return (
          <button
            key={c.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(c.value)}
            style={{
              display: 'flex', flexDirection: item, alignItems: 'center', justifyContent: 'center',
              gap: item === 'row' ? 6 : 3,
              minWidth: 0, padding: '5px 6px',
              borderRadius: 'var(--lsc-radius-md)',
              border: `2px solid ${on ? 'var(--signal-good)' : 'var(--lsc-border)'}`,
              background: on ? 'var(--signal-good-bg)' : 'var(--lsc-sunken)',
              color: on ? 'var(--signal-good-text)' : 'var(--lsc-fg-muted)',
              fontSize, fontWeight: 700, lineHeight: 1.15,
              cursor: on ? 'default' : 'pointer',
              transition: 'background 0.1s, border-color 0.1s, color 0.1s',
            }}
          >
            <span aria-hidden style={{ display: 'flex', flexShrink: 0 }}>{c.icon}</span>
            <span style={{ whiteSpace: 'nowrap' }}>{c.label}</span>
          </button>
        )
      })}
    </div>
  )
}
