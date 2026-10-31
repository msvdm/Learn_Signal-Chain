import type { CardProps } from './cardProps'
import { useStage } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'
import { FACE } from './Frameless'
import type { FramelessNote } from './Frameless'
import { UprightFace } from './UprightFace'
import { conditionNote } from './conditionText'
import { noteSize } from './noteLayout'

/**
 * Stream / Broadcast, from Intermediate (its Beginner face: BeginnerOutput): no card around it (D30)
 * — its icon with its upright meter of what arrives before it, on its input's
 * side, in dBu (dBFS after an Encoder, at Advanced), its name, and the Peak, RMS, Noise and health
 * word under it. The same at every zoom. Under the icon what is wrong with what it sends: a
 * condition's words, a signal clipped on its way here ("Bad sound": the listeners hear the
 * distortion, however green its meter), a hum.
 */
export function BroadcastNode({ id }: CardProps) {
  const { t }  = useTranslation()
  const stage  = useStage(id)
  const size   = noteSize({ w: FACE })
  const bad    = 'var(--signal-clipping-text)'
  const note: FramelessNote | undefined = stage?.condition ? { ...conditionNote(t, stage.condition, 'broadcast'), size }
    : stage?.distorted ? { text: t.nodes.speaker.distorted, color: bad, size }
    : stage?.hum !== undefined ? { text: t.nodes.speaker.hum, color: bad, size }
    : undefined
  return <UprightFace id={id} typeKey="broadcast" at="in" note={note} />
}
