import type { CSSProperties, ReactNode } from 'react'

interface StableTextProps {
  children: ReactNode
  /** Every text this spot can show, or a sample as wide as the widest one (e.g. "−000.0"). */
  reserve: string[]
  /** Where the text sits inside the reserved width. */
  align?: 'start' | 'center' | 'end'
  className?: string
  style?: CSSProperties
}

/**
 * Text that always takes the width of its widest possible value, so a reading that
 * changes ("−∞" → "−18.4", "Good" → "Clipping!") never resizes the card around it.
 * The reserved texts sit invisibly in the same grid cell as the real one.
 */
export function StableText({ children, reserve, align = 'start', className, style }: StableTextProps) {
  return (
    <span
      className={className}
      style={{ display: 'inline-grid', justifyItems: align, whiteSpace: 'nowrap', ...style }}
    >
      <span style={{ gridArea: '1 / 1' }}>{children}</span>
      {reserve.map((text) => (
        <span key={text} aria-hidden style={{ gridArea: '1 / 1', visibility: 'hidden' }}>{text}</span>
      ))}
    </span>
  )
}
