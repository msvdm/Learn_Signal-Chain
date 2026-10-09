import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { SourceArt } from './SourceParts'

/**
 * Instrument (a guitar): only its face, at every zoom — a big icon, its meter beside it (D13),
 * "Not connected" under it until something is wired to its output (NodeWrapper); zoomed out no card
 * around it. Going into the desk without a DI Box, it says so (SourceArt).
 */
export function InstrumentNode({ id }: CardProps) {
  return (
    <NodeWrapper
      nodeId={id} typeKey="instrument" label={useNodeName(id, 'instrument')}
      overviewArt={(box) => <SourceArt nodeId={id} typeKey="instrument" box={box} />} faceOnly overviewBare
    />
  )
}
