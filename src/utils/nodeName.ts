import type { SignalNode } from '../data/nodeRegistry'
import { helpKeyOf } from '../data/nodeRegistry'
import type { Translations } from '../i18n/translations'
import type { StageResult } from '../hooks/useSignalChain'

/** A node's display name: its own label, else its palette name (a Pan fed stereo reads "Balance"). */
export function nodeName(t: Translations, node: SignalNode | undefined, stage?: StageResult): string {
  if (!node) return '?'
  if (node.label) return node.label
  const key = helpKeyOf(node, stage)
  const fromNodes = (t.nodes as Record<string, { label?: string } | undefined>)[key]?.label
  return t.palette.items[key] ?? fromNodes ?? key
}

/** 'L' / 'R' for a wire that carries one side of a stereo mix, null otherwise. */
export function sideLetter(kind: string | undefined): 'L' | 'R' | null {
  return kind === 'left' ? 'L' : kind === 'right' ? 'R' : null
}
