import type { CSSProperties } from 'react'

/**
 * Two-column body shared by the dynamics cards (Compressor, Limiter, Noise Gate, De-esser), and used
 * by the DI Box and the Intermediate Equalizer to stay landscape:
 * row 1 = Input meter | Output meter (the signal comes in on the left and leaves on the right),
 * row 2 = knobs stacked on the left | graph and reading on the right (components in DynamicsLayout.tsx).
 */
export const COLUMN_W = 170

/** A two-column card is 398px wide: at least this tall, so it is never wider than 3:2 (pass as NodeWrapper's style). */
export const twoColumnCard: CSSProperties = { minHeight: 266 }

export const twoColumns: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `${COLUMN_W}px ${COLUMN_W}px`,
  columnGap: 16,
  rowGap: 12,
  alignItems: 'start',
}
