import type { CardProps } from './cardProps'
import type { TypeKey } from '../../data/nodeRegistry'
import { useNodeName } from '../../hooks/useNodeName'
import { FaceCard } from './FaceCard'
import { CharacterButtons, FaceWithChoices } from './SourceParts'

/**
 * The Vocal, a sound in the air (D21): only its face, at every zoom, no meter (D34: its level is
 * read at the Preamp); "Not connected" under it until a microphone hears it (FaceCard). Its Sound output reaches
 * only a microphone (a wire of sound waves). From Intermediate up its Speech | Singing buttons
 * beside its icon. Zoomed out no card around it. (The Drum Kit and the Acoustic Instrument have no
 * card at all: BareSource.)
 */
export function SoundSourceNode({ id, type }: CardProps) {
  const typeKey = type as TypeKey
  return (
    <FaceCard
      nodeId={id} typeKey={typeKey} label={useNodeName(id, typeKey)} bare meter={false}
      art={(box) => <FaceWithChoices nodeId={id} typeKey={typeKey} box={box} buttons={<CharacterButtons nodeId={id} />} />}
    />
  )
}
