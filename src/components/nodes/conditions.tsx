import type { ReactNode } from 'react'
import type { TypeKey } from '../../data/nodeRegistry'
import type { StageCondition } from '../../signal/process'
import { useTranslation } from '../../i18n/useTranslation'
import { FaceNote, WithNote } from './FaceNote'
import { NOTE_ICON_EM, noteLines } from './noteLayout'
import { CONDITIONS } from './conditionText'

/**
 * A face-only card's face with its condition's note under it, in the box it is given: the face
 * gets the height the note's lines leave, so the card keeps its size.
 */
export function ConditionNote({ condition, typeKey, box, face }: {
  condition: StageCondition
  typeKey: TypeKey
  box: { w: number; h: number }
  face: (h: number) => ReactNode
}) {
  const { t } = useTranslation()
  const c     = CONDITIONS[condition]
  const text  = c.text(t, typeKey)
  return (
    <WithNote
      box={box} lines={noteLines(text, box, c.icon ? NOTE_ICON_EM : 0)} face={face}
      note={<FaceNote box={box} color={`var(--signal-${c.tone}-text)`} icon={c.icon}>{text}</FaceNote>}
    />
  )
}

/** A condition said in a card's body: a red label, or a converter's line in capitals. */
export function ConditionLabel({ condition, typeKey }: { condition: StageCondition; typeKey: TypeKey }) {
  const { t } = useTranslation()
  const c     = CONDITIONS[condition]
  const color = `var(--signal-${c.tone})`
  if (c.look === 'caps') {
    return (
      <div
        className="lsc-wrap-text"
        style={{ fontSize: 13, fontWeight: 700, color, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em' }}
      >
        {c.text(t, typeKey)}
      </div>
    )
  }
  return (
    <div
      className="lsc-wrap-text"
      style={{
        fontSize: 12, fontWeight: 600, color,
        padding: '4px 8px', borderRadius: 'var(--lsc-radius-sm)',
        border: `1px solid var(--signal-${c.tone}-border)`,
        background: `var(--signal-${c.tone}-bg)`,
      }}
    >
      {c.text(t, typeKey)}
    </div>
  )
}
