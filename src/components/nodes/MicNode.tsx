import { Drum, Music, Speech } from 'lucide-react'
import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import type { Character, TypeKey } from '../../data/nodeRegistry'
import { CHARACTERS_OF, CHARACTER_LEVEL } from '../../data/nodeRegistry'
import { atLeast } from '../../data/levels'
import { NodeWrapper } from './NodeWrapper'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { FaceNote, WithNote } from './FaceNote'
import { DullToneIcon } from './icons'
import { ChoiceButtons } from '../controls/ChoiceButtons'
import type { Choice } from '../controls/ChoiceButtons'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useStage } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'

// A Microphone's face: its icon, then the Speech / Singing / Drums buttons beside it
const GAP       = 16
const BUTTONS_W = 124
const MAX_BUTTONS_H = 104

/**
 * Microphone, Line Input and Instrument. Microphone and Instrument show only their face, at every
 * zoom: a big icon (its meter beside it — D13: a Microphone's in dB SPL), "Not connected" under it until something is wired to their
 * output (NodeWrapper). From Intermediate up a Microphone and a Line Input
 * also pick what they pick up — a Microphone Speech, Singing or Drums (whose hits reach far above
 * their average), a Line Input Music or Drums; a Microphone shows the buttons beside its icon —
 * not while it hears a Guitar Amp (it picks up the amp, not a sound of its own). An Instrument going into
 * the desk without a DI Box says so (condition 'needsDi': a dull-tone curve and a note). Line
 * Input keeps a full card: it has a Mono / Stereo switch.
 */
export function MicNode({ id, type }: CardProps) {

  const typeKey  = type as TypeKey
  const p        = useParams(id, typeKey)
  const stage    = useStage(id)
  const { t }    = useTranslation()
  // A Microphone in front of a Guitar Amp (something wired to its input) hears the amp: no choice
  const choosing = useSignalStore((s) => typeKey !== 'instrument' && atLeast(s.complexityLevel, CHARACTER_LEVEL)
    && !(typeKey === 'mic' && s.edges.some((e) => e.target === id)))
  const levelDb  = typeKey === 'mic' ? p('sensitivityDb') : p('levelDb')
  const needsDi  = stage?.condition === 'needsDi'
  const Icon     = NODE_LOOK[typeKey].icon
  const label    = useNodeName(id, typeKey)

  const art = (box: { w: number; h: number }) => {
    if (needsDi) {
      return (
        <WithNote
          box={box} lines={2}
          face={(h) => <OverviewIcon icon={<Icon />} box={{ w: box.w, h }} />}
          note={
            <FaceNote box={box} color="var(--signal-hot-text)" icon={(size) => <DullToneIcon size={size} />}>
              {t.nodes.instrument.needsDi}
            </FaceNote>
          }
        />
      )
    }
    // Only a Microphone's face holds the buttons (a Line Input has them in its body)
    if (!choosing || typeKey !== 'mic') return <OverviewIcon icon={<Icon />} box={box} />
    const buttonsW = Math.min(BUTTONS_W, Math.round(box.w * 0.55))
    const icon     = Math.min(box.h, box.w - buttonsW - GAP)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: GAP }}>
        <OverviewIcon icon={<Icon />} box={{ w: icon, h: icon }} />
        {/* The face ignores the pointer; the buttons take it back */}
        <div style={{ pointerEvents: 'auto', width: buttonsW }}>
          <CharacterButtons nodeId={id} typeKey={typeKey} columns={1} height={Math.min(icon, MAX_BUTTONS_H)} />
        </div>
      </div>
    )
  }

  if (typeKey !== 'line-in') {
    return <NodeWrapper nodeId={id} typeKey={typeKey} label={label} overviewArt={art} faceOnly />
  }

  return (
    <NodeWrapper nodeId={id} typeKey={typeKey} label={label} align="start" overviewArt={art}>
      <span style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
        {levelDb} dBu
      </span>
      {/* Taller buttons: the room the readings had */}
      {choosing && <div style={{ alignSelf: 'stretch' }}><CharacterButtons nodeId={id} typeKey={typeKey} columns={2} height={64} /></div>}
    </NodeWrapper>
  )
}

const CHARACTER_ICONS: Record<Character, typeof Music> = { speech: Speech, singing: Music, music: Music, drums: Drum }

/** What a Microphone picks up (Speech | Singing | Drums) or a Line Input plays (Music | Drums). */
function CharacterButtons({ nodeId, typeKey, columns, height }: {
  nodeId: string
  typeKey: TypeKey
  columns: number
  /** The buttons share this height (beside a Microphone's icon) */
  height?: number
}) {
  const p                = useParams(nodeId, typeKey)
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const choices: Choice<Character>[] = CHARACTERS_OF[typeKey === 'mic' ? 'mic' : 'line-in'].map((value) => {
    const CharacterIcon = CHARACTER_ICONS[value]
    return { value, label: t.character[value], hint: t.character.hints[value], icon: <CharacterIcon size={16} /> }
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
