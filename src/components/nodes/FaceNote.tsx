import type { ReactNode } from 'react'
import { NOTE_ICON_GAP, NOTE_ICON_W, NOTE_LINE, noteHeight, noteSize } from './noteLayout'

// A note on a face-only card (sources, speakers, the Guitar Amp): under its icon, sized from the
// card's width — what its condition says (conditions.tsx), a hum, a bad sound, "Not connected".

/**
 * The note itself, in a signal colour (`var(--signal-*-text)`). `icon` draws a small picture at the
 * start of its text, given its size (about one and a half lines of text).
 */
export function FaceNote({ box, color, icon, children }: {
  box: { w: number }
  color: string
  icon?: (size: number) => ReactNode
  children: ReactNode
}) {
  const size = noteSize(box)
  return (
    <span
      style={{
        fontSize: size, fontWeight: 700, lineHeight: NOTE_LINE, textAlign: 'center',
        color, maxWidth: box.w,
      }}
    >
      {icon && (
        <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: `${NOTE_ICON_GAP}em` }}>
          {icon(Math.round(size * NOTE_ICON_W))}
        </span>
      )}
      {children}
    </span>
  )
}

/**
 * A face with a note under it: the face gets the height the note leaves (`face(h)`), so the card
 * keeps its size whether the note shows or not.
 */
export function WithNote({ box, lines, note, face }: {
  box: { w: number; h: number }
  lines: number
  note: ReactNode
  face: (h: number) => ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {face(box.h - noteHeight(box, lines))}
      {note}
    </div>
  )
}
