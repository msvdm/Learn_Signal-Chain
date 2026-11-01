import type { ReactNode } from 'react'
import { FLIPS } from '../../data/nodeRegistry'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useStage } from '../../hooks/useGraphSignal'
import { useDetailShown } from '../../hooks/useDetailShown'
import { useTranslation } from '../../i18n/useTranslation'
import { reachIn } from '../../graph/reach'
import type { Verdict } from '../../graph/reach'
import type { StageCondition } from '../../signal/process'
import { BareMeter } from './BareMeter'
import { BESIDE_W, FACE, Frameless } from './Frameless'
import type { FramelessIcon, FramelessNote } from './Frameless'
import { conditionNote } from './conditionText'
import { noteSize } from './noteLayout'
import { VERDICT_FAR, VERDICT_TONE, fitFont, verdictText } from './verdicts'

/** The frameless outputs (D28) */
export type BareOutputType = 'speaker' | 'headphones' | 'active-speaker' | 'studio-monitor'

/** What an icon takes: lucide's icons, or one drawn in their style (a blown speaker) */
export type OutputIcon = FramelessIcon

/** The icon it shows and its colour (a condition's: crossed out, blown) */
export interface OutputLook {
  Icon: OutputIcon
  color?: string
}

/**
 * An output with no card around it (D28), like the amps (D27): its icon — selected, its own lines
 * turn the accent colour with a soft glow around them — with, from Intermediate, what is `beside`
 * it (the Active Speaker's Volume knob: before it, on its input's side), its name, and its meter in
 * dB SPL under them with its Peak, RMS, Noise and health word (BareMeter: from Intermediate). The
 * same at every zoom. Under the icon what it gets: at Beginner its verdict (graph/reach.ts: sound,
 * or why not); from Intermediate a condition's words (conditionText.tsx), a bad sound or a hum —
 * the element grows downward to make room for it, the icon keeps its size. `look` picks the icon
 * for each case (a speaker crossed out, blown).
 */
export function BareOutput({ id, typeKey, look, beside }: {
  id: string
  typeKey: BareOutputType
  look: (at: { condition?: StageCondition; verdict?: Verdict }) => OutputLook
  /** Beside the icon from Intermediate, a control (its Volume knob) */
  beside?: ReactNode
}) {
  const { t }    = useTranslation()
  const detailed = useDetailShown()
  const overview = useSignalStore((s) => s.overview)
  const p        = useParams(id, typeKey)
  const flipped  = (FLIPS[typeKey]?.includes('h') ?? false) && p('flipH') === true
  // At Beginner what it gets (no engine there — D20); from Intermediate the engine's stage
  const verdict  = useSignalStore((s) => detailed ? undefined : reachIn(s).verdicts.get(id) ?? 'not-connected')
  const stage    = useStage(id)

  const condition = detailed ? stage?.condition : undefined
  const near      = noteSize({ w: FACE })
  let note: FramelessNote | undefined
  if (verdict) {
    const text = verdictText(t, typeKey, verdict, overview)
    note = { text, color: VERDICT_TONE[verdict], size: overview ? fitFont(text, FACE, VERDICT_FAR, 700) : near }
  } else if (condition) {
    note = { ...conditionNote(t, condition, typeKey), size: near }
  } else if (stage?.distorted) {
    // Something before it clips: its meter may be green, but you hear it
    note = { text: t.nodes.speaker.distorted, color: 'var(--signal-clipping-text)', size: near }
  } else if (stage?.hum !== undefined) {
    note = { text: t.nodes.speaker.hum, color: 'var(--signal-clipping-text)', size: near }
  }

  const { Icon, color } = look({ condition, verdict })
  const side = detailed && beside ? { node: beside, width: BESIDE_W } : undefined
  return (
    <Frameless
      id={id} typeKey={typeKey} Icon={Icon} color={color} flipped={flipped} note={note} before={side}
      footer={(width) => <BareMeter nodeId={id} typeKey={typeKey} width={width} readings />}
    />
  )
}
