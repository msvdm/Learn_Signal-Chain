import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FaceCard } from './FaceCard'
import { SourceArt } from './SourceParts'

/**
 * Instrument (a guitar), the Computer and the Decoder: only its face, at every zoom — a big icon,
 * its meter beside it (the Computer's and the Decoder's in stereo, the Decoder's in dBFS), "Not
 * connected" under it until something is wired to its output (FaceCard); zoomed out no card around
 * it. An Instrument going into the desk without a DI Box says so (SourceArt).
 */
export function InstrumentNode({ id, type }: CardProps) {
  const typeKey = type as 'instrument' | 'pc' | 'decoder'
  return (
    <FaceCard
      nodeId={id} typeKey={typeKey} label={useNodeName(id, typeKey)}
      art={(box) => <SourceArt nodeId={id} typeKey={typeKey} box={box} />} bare
    />
  )
}
