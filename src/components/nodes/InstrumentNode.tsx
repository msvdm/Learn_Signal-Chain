import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FaceCard } from './FaceCard'
import { SourceArt } from './SourceParts'

/**
 * The Decoder: only its face, at every zoom — a big icon, its stereo meter beside it in dBFS, "Not
 * connected" under it until something is wired to its output (FaceCard); zoomed out no card around
 * it.
 */
export function InstrumentNode({ id, type }: CardProps) {
  const typeKey = type as 'decoder'
  return (
    <FaceCard
      nodeId={id} typeKey={typeKey} label={useNodeName(id, typeKey)}
      art={(box) => <SourceArt nodeId={id} typeKey={typeKey} box={box} />} bare
    />
  )
}
