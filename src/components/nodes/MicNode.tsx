import { Drum, Music, Speech } from 'lucide-react'
import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import type { Character, TypeKey } from '../../data/nodeRegistry'
import { CHARACTERS_OF, CHARACTER_LEVEL } from '../../data/nodeRegistry'
import { atLeast } from '../../data/levels'
import { NodeWrapper } from './NodeWrapper'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { MeterSides } from './MeterSides'
import { unwiredSource } from '../../graph/queries'
import { SPL_DB } from '../../signal/levels'
import { FaceNote, WithNote } from './FaceNote'
import { DullToneIcon } from './icons'
import { ChoiceButtons } from '../controls/ChoiceButtons'
import type { Choice } from '../controls/ChoiceButtons'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useStage } from '../../hooks/useGraphSignal'
import { useTranslation } from '../../i18n/useTranslation'

// A Microphone's body without buttons (Beginner, or hearing a Guitar Amp): its icon
const MIC_ICON = 96
// Its Speech / Singing / Drums buttons, stacked
const MIC_BUTTONS_H = 132

/**
 * Microphone, Line Input and Instrument. The Instrument shows only its face, at every zoom: a big
 * icon (its meter beside it — D13), "Not connected" under it until something is wired to its
 * output (NodeWrapper). Microphone and Line Input are cards of one size, their meter on the right
 * (hidden, its place kept, until something is wired to their output — D11); zoomed out their icon
 * over a horizontal level bar, no numbers. From Intermediate up they pick what they pick up — a Microphone Speech, Singing or Drums
 * (whose hits reach far above their average), a Line Input Music or Drums. A Microphone's buttons
 * sit beside its meter (dB SPL — D13), its icon in their place at Beginner or while it hears a
 * Guitar Amp (it picks up the amp, not a sound of its own). An Instrument going into the desk without
 * a DI Box says so (condition 'needsDi': a dull-tone curve and a note).
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
  // No connection, no signal (D11): its meter keeps its place, unseen
  const notConnected = useSignalStore((s) => typeKey !== 'instrument' && unwiredSource(id, s))

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
    return <OverviewIcon icon={<Icon />} box={box} />
  }

  if (typeKey === 'mic') {
    return (
      <NodeWrapper nodeId={id} typeKey={typeKey} label={label} overviewArt={art} overviewBarOnly>
        <MeterSides nodeId={id} input={false} spl={SPL_DB.mic} hideOutput={notConnected}>
          {choosing
            ? <CharacterButtons nodeId={id} typeKey={typeKey} columns={1} height={MIC_BUTTONS_H} />
            : <div style={{ display: 'flex', justifyContent: 'center' }}><OverviewIcon icon={<Icon />} box={{ w: MIC_ICON, h: MIC_ICON }} /></div>}
        </MeterSides>
      </NodeWrapper>
    )
  }

  if (typeKey !== 'line-in') {
    return <NodeWrapper nodeId={id} typeKey={typeKey} label={label} overviewArt={art} faceOnly />
  }

  return (
    <NodeWrapper nodeId={id} typeKey={typeKey} label={label} overviewArt={art} overviewBarOnly>
      <MeterSides nodeId={id} input={false} outputLabel={t.meters.input} hideOutput={notConnected}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
            {levelDb} dBu
          </span>
          {choosing && <CharacterButtons nodeId={id} typeKey={typeKey} columns={2} height={64} />}
        </div>
      </MeterSides>
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
