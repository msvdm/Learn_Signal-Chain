import type { ReactNode } from 'react'
import { Music, Speech } from 'lucide-react'
import type { Character, MicType, TypeKey } from '../../data/nodeRegistry'
import { CHARACTERS, CHOICE_LEVEL, MIC_TYPES } from '../../data/nodeRegistry'
import { atLeast } from '../../data/levels'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { ConditionNote } from './conditions'
import { ChoiceButtons } from '../controls/ChoiceButtons'
import type { Choice } from '../controls/ChoiceButtons'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useStage } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'

// What the sources' cards and the Microphone's share: their face and their choice buttons.

/**
 * A face's icon, as big as the box allows. A card in a condition says so under it (an Instrument
 * going into the desk without a DI Box: a dull-tone curve and a note — conditions.tsx).
 */
export function SourceArt({ nodeId, typeKey, box }: { nodeId: string; typeKey: TypeKey; box: { w: number; h: number } }) {
  const condition = useStage(nodeId)?.condition
  const Icon      = NODE_LOOK[typeKey].icon
  return condition
    ? <ConditionNote condition={condition} typeKey={typeKey} box={box} face={(h) => <OverviewIcon icon={<Icon />} box={{ w: box.w, h }} />} />
    : <OverviewIcon icon={<Icon />} box={box} />
}

// The choice buttons beside a face's icon: their column's width, and the gap before it
const BUTTONS_W   = 132
const BUTTONS_GAP = 16
// Two buttons, stacked
const BUTTONS_H   = 96

/**
 * A face's icon with its choice buttons beside it (a Vocal's Speech | Singing) — from Intermediate
 * (CHOICE_LEVEL), zoomed in; otherwise the icon alone. A condition's note goes under both, across
 * the face.
 */
export function FaceWithChoices({ nodeId, typeKey, box, buttons }: {
  nodeId: string
  typeKey: TypeKey
  box: { w: number; h: number }
  buttons: ReactNode
}) {
  const choosing  = useSignalStore((s) => atLeast(s.complexityLevel, CHOICE_LEVEL) && !s.overview)
  const condition = useStage(nodeId)?.condition
  if (!choosing) return <SourceArt nodeId={nodeId} typeKey={typeKey} box={box} />
  const Icon = NODE_LOOK[typeKey].icon
  const row  = (h: number) => {
    const icon = Math.max(0, Math.min(h, box.w - BUTTONS_W - BUTTONS_GAP))
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: BUTTONS_GAP }}>
        <OverviewIcon icon={<Icon />} box={{ w: icon, h: icon }} />
        {/* The face ignores the pointer; the buttons take it back */}
        <div style={{ width: BUTTONS_W, pointerEvents: 'auto' }}>{buttons}</div>
      </div>
    )
  }
  return condition ? <ConditionNote condition={condition} typeKey={typeKey} box={box} face={row} /> : row(box.h)
}

// A small face's choice buttons, stacked under its icon: their height, and the gap above them
const UNDER_H   = 62
const UNDER_GAP = 6

/**
 * A small face's icon with its choice buttons under it (the Microphone's Dynamic | Condenser: half
 * a face each way, no room beside the icon) — from Intermediate (CHOICE_LEVEL), zoomed in; otherwise
 * the icon alone. A condition's note goes under the icon, above the buttons (a condenser without
 * its 48V), the icon taking what height it leaves.
 */
export function FaceOverChoices({ nodeId, typeKey, box, buttons }: {
  nodeId: string
  typeKey: TypeKey
  box: { w: number; h: number }
  buttons: ReactNode
}) {
  const choosing  = useSignalStore((s) => atLeast(s.complexityLevel, CHOICE_LEVEL) && !s.overview)
  if (!choosing) return <SourceArt nodeId={nodeId} typeKey={typeKey} box={box} />
  return (
    <div style={{ width: box.w, height: box.h, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: UNDER_GAP }}>
      <SourceArt nodeId={nodeId} typeKey={typeKey} box={{ w: box.w, h: box.h - UNDER_H - UNDER_GAP }} />
      {/* The face ignores the pointer; the buttons take it back */}
      <div style={{ width: '100%', height: UNDER_H, pointerEvents: 'auto' }}>{buttons}</div>
    </div>
  )
}

const CHARACTER_ICONS: Record<Character, typeof Music> = { speech: Speech, singing: Music }

/** What a Vocal does: Speech | Singing. */
export function CharacterButtons({ nodeId }: { nodeId: string }) {
  const p                = useParams(nodeId, 'vocal')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const choices: Choice<Character>[] = CHARACTERS.map((value) => {
    const CharacterIcon = CHARACTER_ICONS[value]
    return { value, label: t.character[value], icon: <CharacterIcon size={16} /> }
  })

  return (
    <ChoiceButtons
      choices={choices}
      value={p('character')}
      onChange={(character) => updateNodeParams(nodeId, { character })}
      label={t.character.label}
      columns={1}
      item="row"
      fontSize={13}
      style={{ width: '100%', height: BUTTONS_H }}
    />
  )
}

/** What a Microphone is: Dynamic | Condenser, stacked under its icon (FaceOverChoices). */
export function MicTypeButtons({ nodeId }: { nodeId: string }) {
  const p                = useParams(nodeId, 'mic')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const choices: Choice<MicType>[] = MIC_TYPES.map((value) => ({ value, label: t.nodes.mic[value], icon: null }))

  return (
    <ChoiceButtons
      choices={choices}
      value={p('micType')}
      onChange={(micType) => updateNodeParams(nodeId, { micType })}
      label={t.nodes.mic.type}
      columns={1}
      item="row"
      fontSize={12}
      style={{ width: '100%', height: '100%' }}
    />
  )
}
