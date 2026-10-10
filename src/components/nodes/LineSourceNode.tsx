import type { CardProps } from './cardProps'
import type { TypeKey } from '../../data/nodeRegistry'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { MeterSides } from './MeterSides'
import { SourceArt } from './SourceParts'
import { unwiredSource } from '../../graph/queries'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useTranslation } from '../../i18n/useTranslation'

/**
 * Keyboard: a line-level source, always stereo (Left and Right on one wire). A card of one
 * size — its level, and its meter on the right (hidden, its place kept, until something is wired
 * to its output — D11); zoomed out its icon over a horizontal level bar, no numbers, and no card
 * around it — like the Gain knob.
 */
export function LineSourceNode({ id, type }: CardProps) {
  const typeKey = type as TypeKey
  const p       = useParams(id, typeKey)
  const { t }   = useTranslation()
  // No connection, no signal (D11): its meter keeps its place, unseen
  const notConnected = useSignalStore((s) => unwiredSource(id, s))

  return (
    <NodeWrapper
      nodeId={id} typeKey={typeKey} label={useNodeName(id, typeKey)}
      overviewArt={(box) => <SourceArt nodeId={id} typeKey={typeKey} box={box} />} overviewBare
    >
      <MeterSides nodeId={id} input={false} outputLabel={t.meters.input} hideOutput={notConnected}>
        <span style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
          {p('levelDb')} dBu
        </span>
      </MeterSides>
    </NodeWrapper>
  )
}
