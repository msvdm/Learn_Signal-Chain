import type en from './locales/en.json'
import type { ComplexityLevel } from '../data/levels'
import type { TypeKey } from '../data/nodeRegistry'

export type Lang = string

/** The text of one language: exactly the keys of en.json (other locales are checked against it). */
export type LocaleStrings = typeof en

export interface TheoryEntry {
  what: string
  why: string
  tip: string
  /**
   * What this card's readings show and what to watch in them (peaks, room before clipping, hiss):
   * shown only where the cards show readings (`READINGS_LEVEL`). Types without readings, or with
   * nothing to add, leave it out.
   */
  readings?: string
}

/**
 * All UI text, typed from en.json — add a key there (and to every other locale) and it is typed.
 * The tables looked up by node type are records: every type must have a palette name and a help
 * text (a new type without them does not compile), and any key can be looked up (help texts also
 * exist for roles: Preamp, Main Fader, Balance).
 */
export type Translations = Omit<LocaleStrings, 'palette' | 'theory' | 'levelNames'> & {
  palette: Omit<LocaleStrings['palette'], 'items'> & { items: Record<TypeKey, string> & Record<string, string> }
  theory: Record<TypeKey, TheoryEntry> & Record<string, TheoryEntry>
  /**
   * Names that change with the level, by node type: a card that is simpler on a lower level is
   * named for it (Intermediate's three-knob "Equalizer"). Replaces its palette name and card label.
   */
  levelNames: Partial<Record<ComplexityLevel, Record<string, string>>>
}

/** `t` with the names of this level applied (see `levelNames`). */
export function withLevelNames(t: Translations, level: ComplexityLevel): Translations {
  const names = t.levelNames[level]
  if (!names) return t
  const nodes: Record<string, unknown> = { ...t.nodes }
  for (const [key, name] of Object.entries(names)) {
    const entry = nodes[key]
    if (entry && typeof entry === 'object') nodes[key] = { ...entry, label: name }
  }
  return {
    ...t,
    nodes:   nodes as Translations['nodes'],
    palette: { ...t.palette, items: { ...t.palette.items, ...names } },
  }
}

export function fmt(str: string, params: Record<string, string>): string {
  return str.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`)
}
