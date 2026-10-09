import { cssVar, textWidth } from '../../utils/fitText'

// The size of a note under a face-only card's icon (FaceNote.tsx), from the face's width.

/** A note's line height */
export const NOTE_LINE = 1.25
/** A note's picture at the start of its text, in ems: its width and the gap after it */
export const NOTE_ICON_W   = 1.6
export const NOTE_ICON_GAP = 0.35
export const NOTE_ICON_EM  = NOTE_ICON_W + NOTE_ICON_GAP
// Canvas widths can differ from the DOM's by a pixel or so — keep a little room
const SAFETY = 0.97

/** The note's font size for a face this wide. */
export function noteSize(box: { w: number }): number {
  return Math.max(13, Math.min(18, Math.round(box.w * 0.065)))
}

/** Height a note of `lines` lines takes under the icon (with its gap). */
export function noteHeight(box: { w: number }, lines: number): number {
  return noteSize(box) * NOTE_LINE * lines + 6
}

/**
 * How many lines a note's text takes under a face this wide (broken at spaces, as the page breaks
 * it); `iconEm`: a picture at its start. Its words and the font decide it, in every language.
 */
export function noteLines(text: string, box: { w: number }, iconEm = 0): number {
  const size   = noteSize(box)
  const family = cssVar('--lsc-font-sans')
  const width  = (s: string) => textWidth(s, family, 700) * size
  const room   = box.w * SAFETY
  const space  = width(' ')
  let lines = 1
  let line  = iconEm * size
  for (const word of text.split(' ')) {
    const w = width(word)
    if (line > 0 && line + space + w > room) {
      lines++
      line = w
    } else {
      line += (line > 0 ? space : 0) + w
    }
  }
  return lines
}
