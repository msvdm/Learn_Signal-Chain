// The complexity levels. They change which elements the palette shows (and how a few of them look),
// never what is on the canvas: every level starts from a blank canvas.

export type ComplexityLevel = 'beginner' | 'intermediate' | 'advanced'

/** The levels from easiest to hardest */
export const LEVELS: ComplexityLevel[] = ['beginner', 'intermediate', 'advanced']

/** Is `level` at least as hard as `min`? */
export function atLeast(level: ComplexityLevel, min: ComplexityLevel): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(min)
}

/**
 * The easiest level whose meters show the peaks and the noise, with the readings under each card
 * (peaks above the average, room before clipping, hiss) and the hiss note. Beginner shows only
 * the average, as before (decision D3, TODO.md).
 */
export const READINGS_LEVEL: ComplexityLevel = 'intermediate'
