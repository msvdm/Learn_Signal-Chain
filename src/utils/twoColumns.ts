import type { CSSProperties } from 'react'

/**
 * The controls of a dynamics card (Compressor, Limiter, Noise Gate, De-esser), between its In and
 * Out meters (components/nodes/MeterSides.tsx): knobs stacked on the left | the transfer curve and
 * the turning-down reading on the right (components in DynamicsLayout.tsx), then the time knobs.
 */
export const COLUMN_W = 190

const COLUMN_GAP = 16

export const twoColumns: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `${COLUMN_W}px ${COLUMN_W}px`,
  columnGap: COLUMN_GAP,
  rowGap: 12,
  alignItems: 'start',
}
