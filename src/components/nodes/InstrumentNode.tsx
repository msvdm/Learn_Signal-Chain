import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FaceCard } from './FaceCard'
import { SourceArt } from './SourceParts'

/**
 * Instrument (a guitar): only its face, at every zoom — a big icon, its meter beside it (D13),
 * "Not connected" under it until something is wired to its output (FaceCard); zoomed out no card
 * around it. Going into the desk without a DI Box, it says so (SourceArt).
 */
export function InstrumentNode({ id }: CardProps) {
  return (
    <FaceCard
      nodeId={id} typeKey="instrument" label={useNodeName(id, 'instrument')}
      art={(box) => <SourceArt nodeId={id} typeKey="instrument" box={box} />} bare
    />
  )
}
