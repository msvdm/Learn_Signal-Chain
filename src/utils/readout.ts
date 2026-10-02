/** Widest possible signal level reading, e.g. "−140.0" (mono font: every digit is the same width). */
export const LEVEL_SAMPLE = '−000.0'

/**
 * The longest text `format` gives for the values a control can take (min → max on its step,
 * sampled at most 120 times). Readouts use a mono font, so the longest text is the widest.
 */
export function widestFormat(min: number, max: number, step: number, format: (v: number) => string): string {
  const count = Math.min(120, Math.max(1, Math.round((max - min) / step)))
  let widest = ''
  for (let i = 0; i <= count; i++) {
    const v    = Math.round((min + ((max - min) * i) / count) / step) * step
    const text = format(parseFloat(v.toFixed(10)))
    if (text.length > widest.length) widest = text
  }
  return widest
}
