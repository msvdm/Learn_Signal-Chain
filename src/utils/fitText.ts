/**
 * Text measuring for the overview cards (zoomed out): the largest font size that fits a box.
 * Measured with one cached canvas, so no DOM is touched and the result never depends on layout.
 */

export interface FitOptions {
  /** CSS font-family, already resolved (canvas cannot read CSS variables). */
  family: string
  weight: number
  /** em, e.g. -0.02 */
  letterSpacing?: number
  lineHeight: number
  maxSize: number
  /** Allow a second line, broken at a space, when it gives a larger font. */
  maxLines?: 1 | 2
}

export interface FitResult {
  fontSize: number
  lines: string[]
}

// Canvas widths can differ from the DOM's by a pixel or so — keep a little room
const SAFETY = 0.96
const REF_SIZE = 100

let ctx: CanvasRenderingContext2D | null = null
const widthCache = new Map<string, number>()

/** Width of `text` at font size 1 (multiply by the font size for real pixels). */
export function textWidth(text: string, family: string, weight: number, letterSpacing = 0): number {
  const key = `${weight}|${family}|${letterSpacing}|${text}`
  const cached = widthCache.get(key)
  if (cached !== undefined) return cached
  ctx ??= document.createElement('canvas').getContext('2d')
  if (!ctx) return text.length * 0.6
  ctx.font = `${weight} ${REF_SIZE}px ${family}`
  // Letter spacing sits between the characters
  const w = (ctx.measureText(text).width + letterSpacing * REF_SIZE * Math.max(0, [...text].length - 1)) / REF_SIZE
  widthCache.set(key, w)
  return w
}

/** The largest font size (whole pixels) at which `text` fits `maxW` × `maxH`, on one line or two. */
export function fitText(text: string, maxW: number, maxH: number, o: FitOptions): FitResult {
  const measure = (s: string) => textWidth(s, o.family, o.weight, o.letterSpacing)
  const sizeFor = (lines: string[]) => Math.floor(Math.min(
    (maxW * SAFETY) / Math.max(...lines.map(measure)),
    maxH / (lines.length * o.lineHeight),
    o.maxSize,
  ))

  let best: FitResult = { fontSize: sizeFor([text]), lines: [text] }
  if (o.maxLines === 2) {
    const words = text.split(' ')
    for (let i = 1; i < words.length; i++) {
      const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')]
      const fontSize = sizeFor(lines)
      if (fontSize > best.fontSize) best = { fontSize, lines }
    }
  }
  return { ...best, fontSize: Math.max(1, best.fontSize) }
}

/** A CSS variable's value (a font stack) for canvas measuring. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
