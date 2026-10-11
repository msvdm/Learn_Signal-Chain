import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FaceCard } from './FaceCard'
import { FaceOverChoices, MicTypeButtons } from './SourceParts'

/**
 * Microphone: it turns the sound before it (a Vocal, a Drum Kit … on its Sound input) into a weak
 * signal (D21). Only its face, at every zoom, half a face's size each way, and no meter — the sound
 * it hears has one; "Not connected" under it while it hears nothing (D11). From Intermediate up its
 * Dynamic | Condenser buttons under the icon; zoomed out the icon alone, no card around it.
 */
export function MicNode({ id }: CardProps) {
  return (
    <FaceCard
      nodeId={id} typeKey="mic" label={useNodeName(id, 'mic')} bare meter={false}
      art={(box) => <FaceOverChoices nodeId={id} typeKey="mic" box={box} buttons={<MicTypeButtons nodeId={id} />} />}
    />
  )
}
