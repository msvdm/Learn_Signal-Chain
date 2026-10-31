import type { CardProps } from './cardProps'
import type { TypeKey } from '../../data/nodeRegistry'
import { NODE_LOOK } from './nodeLook'
import { useSignalStore } from '../../store/signalStore'
import { useStage } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'
import type { Translations } from '../../i18n/translations'
import { unwiredSource } from '../../graph/queries'
import type { StageCondition } from '../../signal/process'
import { FACE, Frameless } from './Frameless'
import { KeyboardOctaveIcon } from './icons'
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

/** Under a source's name: nothing — a source has no meter (D34: its level is read at the Preamp) */
const NO_FOOTER = () => null

/**
 * The Drum Kit, the Acoustic Instrument, the Hi-Z Instrument and the Keyboard, from Intermediate
 * (their Beginner face: BeginnerInput): no card around them, as the Passive Speaker (D28) — their
 * icon and their name, no meter (D34). The same at every zoom. Nothing wired to it, "Not connected"
 * is said under its icon (D11).
 */
export function BareSource({ id, type }: CardProps) {
  const typeKey      = type as BareSourceType
  const { t }        = useTranslation()
  const notConnected = useSignalStore((s) => unwiredSource(id, s))
  const condition    = useStage(id)?.condition
  return (
    <Frameless
      // The Keyboard: a whole octave, twice as wide as the others' pictures
      id={id} typeKey={typeKey}
      {...(typeKey === 'keyboard' ? { Icon: KeyboardOctaveIcon, faceWidth: 2 * FACE } : { Icon: NODE_LOOK[typeKey].icon })}
      note={sourceNote(t, typeKey, notConnected, condition)}
      footer={NO_FOOTER}
    />
  )
}

/** The Computer, from Intermediate (its Beginner face: BeginnerInput): its icon and name, no meter (D34). */
export function ComputerNode({ id }: CardProps) {
  const { t }        = useTranslation()
  const notConnected = useSignalStore((s) => unwiredSource(id, s))
  const condition    = useStage(id)?.condition
  return <Frameless id={id} typeKey="pc" Icon={NODE_LOOK.pc.icon} note={sourceNote(t, 'pc', notConnected, condition)} footer={NO_FOOTER} />
}
