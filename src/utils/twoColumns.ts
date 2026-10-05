import type { CSSProperties } from 'react'

/**
 * Two-column body shared by the dynamics cards (Compressor, Limiter, Noise Gate, De-esser), and used
 * by the DI Box, the Intermediate Equalizer and the Amplifier to stay landscape:
 * row 1 = Input meter | Output meter (the signal comes in on the left and leaves on the right),
 * row 2 = knobs stacked on the left | graph and reading on the right (components in DynamicsLayout.tsx).
 * 190px columns: with the readings under the card (from Intermediate up) the Compressor and the
 * Noise Gate still come out wider than tall.
 */
export const COLUMN_W = 190

const COLUMN_GAP = 16
/** The card around two columns: the body's side padding (20 each side) and the border */
const CARD_W = 2 * COLUMN_W + COLUMN_GAP + 40 + 2

/** A two-column card is 438px wide: at least this tall, so it is never wider than 3:2 (pass as NodeWrapper's style). */
export const twoColumnCard: CSSProperties = { minHeight: Math.ceil(CARD_W / 1.5) }

export const twoColumns: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `${COLUMN_W}px ${COLUMN_W}px`,
  columnGap: COLUMN_GAP,
  rowGap: 12,
  alignItems: 'start',
}
