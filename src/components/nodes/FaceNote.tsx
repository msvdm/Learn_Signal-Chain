import type { ReactNode } from 'react'

// A note on a face-only card (sources, speakers, the Guitar Amp): under its icon, sized from the
// card's width — a speaker with no amplifier, a blown one, a guitar without a DI Box, a hum.

const NOTE_LINE = 1.25

/** The note's font size for a face this wide. */
function noteSize(box: { w: number }): number {
  return Math.max(13, Math.min(18, Math.round(box.w * 0.065)))
}

/** Height a note of `lines` lines takes under the icon (with its gap). */
function noteHeight(box: { w: number }, lines: number): number {
  return noteSize(box) * NOTE_LINE * lines + 6
}

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
        <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: '0.35em' }}>
          {icon(Math.round(size * 1.6))}
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
