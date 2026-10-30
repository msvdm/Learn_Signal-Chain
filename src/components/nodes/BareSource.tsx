import type { CardProps } from './cardProps'
import type { TypeKey } from '../../data/nodeRegistry'
import { NODE_LOOK } from './nodeLook'
import { useSignalStore } from '../../store/signalStore'
import { useStage } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'
import type { Translations } from '../../i18n/translations'
import { unwiredSource } from '../../graph/queries'
import type { StageCondition } from '../../signal/process'
import { BareMeter } from './BareMeter'
import { UprightFace } from './UprightFace'
import { FACE, Frameless } from './Frameless'
import type { FramelessNote } from './Frameless'
import { conditionNote } from './conditionText'
import { noteSize } from './noteLayout'

/** The sources drawn with no card around them (BareSource) */
export type BareSourceType = 'drum-kit' | 'acoustic' | 'instrument' | 'keyboard'

/**
 * What is said under a source's icon: "Not connected" while nothing is wired to it (D11; a sound in
 * the air: until a microphone hears it), else a condition's words (an Instrument into the desk
 * without a DI Box — conditionText.tsx).
 */
function sourceNote(t: Translations, typeKey: TypeKey, notConnected: boolean, condition: StageCondition | undefined): FramelessNote | undefined {
  const size = noteSize({ w: FACE })
  if (notConnected) return { text: t.status.notConnected, color: 'var(--lsc-fg-muted)', size }
  if (condition) return { ...conditionNote(t, condition, typeKey), size }
  return undefined
}

/**
 * The Drum Kit, the Acoustic Instrument, the Hi-Z Instrument and the Keyboard, from Intermediate
 * (their Beginner face: BeginnerInput): no card around them, as the Passive Speaker (D28) — their
 * icon, their name, and under it their meter: a horizontal bar in dB SPL for a sound in the air
 * (D13), in dBu for a guitar or a keyboard (a bar for each side: the Keyboard is always stereo),
 * with its Peak, RMS, Noise and health word (BareMeter). The same at every zoom. Nothing wired to
 * it, its meter keeps its room, unseen (D11), and "Not connected" is said under its icon.
 */
export function BareSource({ id, type }: CardProps) {
  const typeKey      = type as BareSourceType
  const { t }        = useTranslation()
  const notConnected = useSignalStore((s) => unwiredSource(id, s))
  const condition    = useStage(id)?.condition
  return (
    <Frameless
      id={id} typeKey={typeKey} Icon={NODE_LOOK[typeKey].icon}
      note={sourceNote(t, typeKey, notConnected, condition)}
      footer={(width) => <BareMeter nodeId={id} typeKey={typeKey} width={width} readings hidden={notConnected} />}
    />
  )
}

/** The Computer, from Intermediate (its Beginner face: BeginnerInput): its icon with its upright meter after it (UprightFace, D30). */
export function ComputerNode({ id }: CardProps) {
  const { t }        = useTranslation()
  const notConnected = useSignalStore((s) => unwiredSource(id, s))
  const condition    = useStage(id)?.condition
  return <UprightFace id={id} typeKey="pc" at="out" hidden={notConnected} note={sourceNote(t, 'pc', notConnected, condition)} />
}
