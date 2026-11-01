// A knob's cap in the logo's proportions (KnobFace): how thick its outline is.

/** The outline, as a share of the cap's radius (the logo's) */
const OUTLINE = 0.094

/** How thick the outline is round a cap of radius `r` (px), at least 1.5 */
export const knobOutline = (r: number) => Math.max(1.5, r * OUTLINE)

/** The cap's radius in a `size` px box, its outline inside the box */
export function capRadius(size: number): number {
  return size / 2 - knobOutline(size / 2 / (1 + OUTLINE))
}
