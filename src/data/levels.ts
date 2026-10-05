// The complexity levels. They change which elements the palette shows (and how a few of them look),
// never what is on the canvas: every level starts from a blank canvas.

export type ComplexityLevel = 'beginner' | 'intermediate' | 'advanced'

/** The levels from easiest to hardest */
export const LEVELS: ComplexityLevel[] = ['beginner', 'intermediate', 'advanced']

/** Is `level` at least as hard as `min`? */
export function atLeast(level: ComplexityLevel, min: ComplexityLevel): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(min)
}
