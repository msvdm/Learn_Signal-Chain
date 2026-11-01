import type { ReactNode } from 'react'
import type { TypeKey } from '../../data/nodeRegistry'
import type { StageCondition } from '../../signal/process'
import type { Translations } from '../../i18n/translations'
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
export const CONDITIONS: Record<StageCondition, ConditionText> = {
  domainMixedBus:      { look: 'label', tone: 'clipping', text: (t) => t.warnings.domainMixedBus },
  // An amplifier, a speaker, headphones or a Guitar Amp fed a digital signal: one text for them all
  digitalToAmp:        { look: 'label', tone: 'clipping', text: (t) => t.warnings.digitalSignal },
  digitalToSpeaker:    { look: 'note',  tone: 'clipping', text: (t) => t.warnings.digitalSignal },
  adcExpectsAnalog:    { look: 'caps',  tone: 'clipping', text: (t) => t.warnings.adcExpectsAnalog },
  dacExpectsDigital:   { look: 'caps',  tone: 'clipping', text: (t) => t.warnings.dacExpectsDigital },
  needsAmp:            { look: 'note',  tone: 'hot',      text: (t) => t.nodes.speaker.needsAmp },
  needsGain:           { look: 'note',  tone: 'hot',      text: (t) => t.nodes.headphones.needsGain },
  blown:               { look: 'note',  tone: 'clipping', text: (t, typeKey) => t.nodes[typeKey === 'headphones' ? 'headphones' : 'active-speaker'].blown },
  needsDi:             { look: 'note',  tone: 'hot',      text: (t) => t.nodes.instrument.needsDi, icon: (size) => <DullToneIcon size={size} /> },
  noPhantom:           { look: 'note',  tone: 'clipping', text: (t) => t.nodes.mic.noPhantom },
  codecNeedsDigital:   { look: 'label', tone: 'clipping', text: (t) => t.warnings.codecNeedsDigital },
  otherCodec:          { look: 'label', tone: 'clipping', text: (t) => t.warnings.otherCodec },
  dawNeedsDigital:     { look: 'note',  tone: 'clipping', text: (t) => t.warnings.dawNeedsDigital },
  // (An amp's own face shows it by its switch and dark light: this is for a card that says it in words)
  switchedOff:         { look: 'note',  tone: 'hot',      text: (t) => t.warnings.switchedOff },
  // A Digital Interface's cable (D40): what is wrong, in its body. The clocks: it works, but is heard
  interfaceNeedsDigital: { look: 'label', tone: 'clipping', text: (t) => t.warnings.interfaceNeedsDigital },
  noRoom:              { look: 'label', tone: 'clipping', text: (t) => t.warnings.noRoom },
  mixedRates:          { look: 'label', tone: 'clipping', text: (t) => t.warnings.mixedRates },
  otherProtocol:       { look: 'label', tone: 'clipping', text: (t) => t.warnings.otherProtocol },
  twoClocks:           { look: 'label', tone: 'hot',      text: (t) => t.warnings.twoClocks },
  noClock:             { look: 'label', tone: 'hot',      text: (t) => t.warnings.noClock },
}

/** A condition's words, their colour (a signal's text colour) and the small picture at their start, if any. */
export function conditionNote(t: Translations, condition: StageCondition, typeKey: TypeKey) {
  const c = CONDITIONS[condition]
  return { text: c.text(t, typeKey), color: `var(--signal-${c.tone}-text)`, icon: c.icon }
}
