import { Drum, Music, Speech } from 'lucide-react'
import type { Character } from '../../data/nodeRegistry'
import { CHARACTERS_OF } from '../../data/nodeRegistry'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { ConditionNote } from './conditions'
import { ChoiceButtons } from '../controls/ChoiceButtons'
import type { Choice } from '../controls/ChoiceButtons'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useStage } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'

// What the Microphone, Line Input and Instrument cards share: their face and their sound buttons.

type Source = 'mic' | 'line-in' | 'instrument'

/**
 * A source's face — its icon, as big as the box allows (zoomed out; the Instrument at every zoom).
 * An Instrument going into the desk without a DI Box says so under it (condition 'needsDi': a
 * dull-tone curve and a note — conditions.tsx).
 */
export function SourceArt({ nodeId, typeKey, box }: { nodeId: string; typeKey: Source; box: { w: number; h: number } }) {
  const condition = useStage(nodeId)?.condition
  const Icon      = NODE_LOOK[typeKey].icon
  return condition
    ? <ConditionNote condition={condition} typeKey={typeKey} box={box} face={(h) => <OverviewIcon icon={<Icon />} box={{ w: box.w, h }} />} />
    : <OverviewIcon icon={<Icon />} box={box} />
}

const CHARACTER_ICONS: Record<Character, typeof Music> = { speech: Speech, singing: Music, music: Music, drums: Drum }

/** What a Microphone picks up (Speech | Singing | Drums) or a Line Input plays (Music | Drums). */
export function CharacterButtons({ nodeId, typeKey, columns, height }: {
  nodeId: string
  typeKey: 'mic' | 'line-in'
  columns: number
  /** The buttons share this height (beside a Microphone's icon) */
  height?: number
}) {
  const p                = useParams(nodeId, typeKey)
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const choices: Choice<Character>[] = CHARACTERS_OF[typeKey].map((value) => {
    const CharacterIcon = CHARACTER_ICONS[value]
    return { value, label: t.character[value], icon: <CharacterIcon size={16} /> }
  })

  return (
    <ChoiceButtons
      choices={choices}
      value={p('character')}
      onChange={(character) => updateNodeParams(nodeId, { character })}
      label={t.character.label}
      columns={columns}
      item="row"
      fontSize={height ? 13 : 12}
      style={{ width: '100%', height }}
    />
  )
}
