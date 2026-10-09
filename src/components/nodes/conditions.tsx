import type { ReactNode } from 'react'
import type { TypeKey } from '../../data/nodeRegistry'
import type { StageCondition } from '../../signal/process'
import type { Translations } from '../../i18n/translations'
import { useTranslation } from '../../i18n/useTranslation'
import { FaceNote, WithNote } from './FaceNote'
import { NOTE_ICON_EM, noteLines } from './noteLayout'
import { DullToneIcon } from './icons'

/** Where a condition's text shows on its card. */
type ConditionLook =
  /** Under a face-only card's icon, which takes the height the note leaves (FaceNote) */
  | 'note'
  /** A red label in a card's body (the Amplifier, a bus) */
  | 'label'
  /** A converter's line, in capitals */
  | 'caps'

interface ConditionText {
  text: (t: Translations, typeKey: TypeKey) => string
  /** Red: broken or silent. Yellow (hot): it works, but something is missing */
  tone: 'clipping' | 'hot'
  look: ConditionLook
  /** A small picture at the start of a note */
  icon?: (size: number) => ReactNode
}

/**
 * What a card says when it is in a condition (signal/process.ts StageCondition), and how — every
 * condition has one (a new one does not compile without). Each card draws its own face (a speaker's
 * icon crossed out, a blown one); the words, their colour and their place come from here.
 */
const CONDITIONS: Record<StageCondition, ConditionText> = {
  domainMixedBus:    { look: 'label', tone: 'clipping', text: (t) => t.warnings.domainMixedBus },
  // An amplifier, a speaker, headphones or a Guitar Amp fed a digital signal: one text for them all
  digitalToAmp:      { look: 'label', tone: 'clipping', text: (t) => t.warnings.digitalSignal },
  digitalToSpeaker:  { look: 'note',  tone: 'clipping', text: (t) => t.warnings.digitalSignal },
  adcExpectsAnalog:  { look: 'caps',  tone: 'clipping', text: (t) => t.warnings.adcExpectsAnalog },
  dacExpectsDigital: { look: 'caps',  tone: 'clipping', text: (t) => t.warnings.dacExpectsDigital },
  needsAmp:          { look: 'note',  tone: 'hot',      text: (t) => t.nodes.speaker.needsAmp },
  blown:             { look: 'note',  tone: 'clipping', text: (t, typeKey) => t.nodes[typeKey === 'headphones' ? 'headphones' : 'active-speaker'].blown },
  needsDi:           { look: 'note',  tone: 'hot',      text: (t) => t.nodes.instrument.needsDi, icon: (size) => <DullToneIcon size={size} /> },
}

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
