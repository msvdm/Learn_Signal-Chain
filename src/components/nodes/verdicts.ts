import type { TypeKey } from '../../data/nodeRegistry'
import type { Translations } from '../../i18n/translations'
import type { Verdict } from '../../graph/reach'
import { cssVar, textWidth } from '../../utils/fitText'

// What an end point says at Beginner (D20, graph/reach.ts): its words, their colour and size —
// Beginner's output faces (BeginnerFaces.tsx) and the frameless outputs (BareOutput.tsx).

/** An output's verdict zoomed out: "Sound" or "No sound", this big */
export const VERDICT_FAR = 44

/** The biggest font size (at most `max`) at which `text` fits `width` on one line. */
export function fitFont(text: string, width: number, max: number, weight = 600): number {
  const w = textWidth(text, cssVar('--lsc-font-sans'), weight)
  return Math.max(10, Math.min(max, Math.floor((width * 0.97) / w)))
}

/** The colour of what an end point gets. */
export const VERDICT_TONE: Record<Verdict, string> = {
  sound:           'var(--signal-good-text)',
  'not-connected': 'var(--lsc-fg-muted)',
  'no-source':     'var(--lsc-fg-muted)',
  'needs-amp':     'var(--signal-hot-text)',
  'switched-off':  'var(--signal-hot-text)',
}

/** What an end point says it gets: zoomed in why there is no sound, zoomed out only whether there is. */
export function verdictText(t: Translations, typeKey: TypeKey, verdict: Verdict, far: boolean): string {
  if (verdict === 'sound') return typeKey === 'recorder' ? t.beginner.recording : typeKey === 'broadcast' ? t.beginner.onAir : t.beginner.sound
  if (far) return t.beginner.noSound
  return verdict === 'needs-amp' ? t.nodes.speaker.needsAmp
    : verdict === 'switched-off' ? t.beginner.switchedOff
    : verdict === 'no-source' ? t.beginner.noSource : t.beginner.notConnected
}
