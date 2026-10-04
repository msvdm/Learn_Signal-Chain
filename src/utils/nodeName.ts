import type { SignalNode } from '../data/nodeRegistry'
import type { Translations } from '../i18n/translations'
import type { StageResult } from '../signal/engine'
import type { WireKind } from '../graph/queries'

/**
 * Which help text a node opens: its role in the chain if it has one (a Pan fed a stereo wire is a
 * Balance knob, a Fader on a bus's Mix output is the Main Fader, a Gain after a microphone is a
 * Preamp), else its type.
 */
export function helpKeyOf(node: Pick<SignalNode, 'typeKey'>, stage?: Pick<StageResult, 'role'>): string {
  return stage?.role ?? node.typeKey
}

/**
 * The name of a role or type as a card shows it: its card name (`nodes.<key>.label`: "HPF",
 * "Pad"), else its palette name ("Line Input", "Switch / Mute").
 */
export function titleOf(t: Translations, key: string): string {
  return (t.nodes as Record<string, { label?: string } | undefined>)[key]?.label ?? t.palette.items[key] ?? key
}

/**
 * An element's name, everywhere it is shown — its card, the help popover, the unplug list, a
 * Matrix Bus row: a name of its own (from a saved chain), else the name of its role (Preamp,
 * Main Fader, Balance) or type.
 */
export function nodeName(
  t: Translations,
  node: Pick<SignalNode, 'typeKey' | 'label'> | undefined,
  stage?: Pick<StageResult, 'role'>,
): string {
  if (!node) return '?'
  return node.label ?? titleOf(t, helpKeyOf(node, stage))
}

/** 'L' / 'R' for a wire that carries one side of a stereo mix, null otherwise. */
export function sideLetter(kind: WireKind | undefined): 'L' | 'R' | null {
  return kind === 'left' ? 'L' : kind === 'right' ? 'R' : null
}
