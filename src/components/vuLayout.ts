// A VU meter's dial (VuMeter.tsx): its drawing's size, and how much room the meters take in a face.

/** The dial's drawing (its viewBox) */
export const DIAL_W = 160
export const DIAL_H = 92

/** A dial's widest (px), the gap between two, and the height of the number under each (with its gap) */
export const DIAL_MAX_W = 170
export const DIAL_GAP   = 12
const NUMBER_H          = 24

/** How tall the VU meters are in a face `width` px wide: one dial, or two side by side (`stereo`). */
export function vuMeterHeight(width: number, stereo: boolean): number {
  const dial = Math.min(DIAL_MAX_W, stereo ? (width - DIAL_GAP) / 2 : width)
  return Math.ceil((dial * DIAL_H) / DIAL_W) + NUMBER_H
}
