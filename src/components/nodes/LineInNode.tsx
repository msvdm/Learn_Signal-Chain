import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { CHARACTER_LEVEL } from '../../data/nodeRegistry'
import { atLeast } from '../../data/levels'
import { NodeWrapper } from './NodeWrapper'
import { MeterSides } from './MeterSides'
import { CharacterButtons, SourceArt } from './SourceParts'
import { unwiredSource } from '../../graph/queries'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useTranslation } from '../../i18n/useTranslation'

/**
 * Line Input: a card of one size with the Microphone — its level, and its meter on the right
 * (hidden, its place kept, until something is wired to its output — D11); zoomed out its icon over
 * a horizontal level bar, no numbers, and no card around it — like the Gain knob. From
 * Intermediate up it picks what it plays: Music or Drums.
 */
export function LineInNode({ id }: CardProps) {
  const p        = useParams(id, 'line-in')
  const { t }    = useTranslation()
  const choosing = useSignalStore((s) => atLeast(s.complexityLevel, CHARACTER_LEVEL))
  // No connection, no signal (D11): its meter keeps its place, unseen
  const notConnected = useSignalStore((s) => unwiredSource(id, s))

  return (
    <NodeWrapper
      nodeId={id} typeKey="line-in" label={useNodeName(id, 'line-in')}
      overviewArt={(box) => <SourceArt nodeId={id} typeKey="line-in" box={box} />} overviewBare
    >
      <MeterSides nodeId={id} input={false} outputLabel={t.meters.input} hideOutput={notConnected}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
            {p('levelDb')} dBu
          </span>
          {choosing && <CharacterButtons nodeId={id} typeKey="line-in" columns={2} height={64} />}
        </div>
      </MeterSides>
    </NodeWrapper>
  )
}
