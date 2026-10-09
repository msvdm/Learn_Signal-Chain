import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { CHARACTER_LEVEL } from '../../data/nodeRegistry'
import { atLeast } from '../../data/levels'
import { NodeWrapper } from './NodeWrapper'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { MeterSides } from './MeterSides'
import { CharacterButtons, SourceArt } from './SourceParts'
import { unwiredSource } from '../../graph/queries'
import { SPL_DB } from '../../signal/levels'
import { useSignalStore } from '../../store/signalStore'

// Its body without buttons (Beginner, or hearing a Guitar Amp): its icon
const MIC_ICON = 96
// Its Speech / Singing / Drums buttons, stacked
const MIC_BUTTONS_H = 132

const Icon = NODE_LOOK.mic.icon

/**
 * Microphone: a card of one size with the Line Input, its meter on the right (dB SPL — D13; hidden,
 * its place kept, until something is wired to its output — D11); zoomed out its icon over a
 * horizontal level bar, no numbers, and no card around it — like the Gain knob. From Intermediate
 * up it picks what it picks up — Speech, Singing or Drums (whose hits reach far above their
 * average) —, its buttons beside its meter; its icon in their place at Beginner or while it hears
 * a Guitar Amp (it picks up the amp, not a sound of its own).
 */
export function MicNode({ id }: CardProps) {
  // In front of a Guitar Amp (something wired to its input) it hears the amp: no choice
  const choosing = useSignalStore((s) => atLeast(s.complexityLevel, CHARACTER_LEVEL) && !s.edges.some((e) => e.target === id))
  // No connection, no signal (D11): its meter keeps its place, unseen
  const notConnected = useSignalStore((s) => unwiredSource(id, s))

  return (
    <NodeWrapper
      nodeId={id} typeKey="mic" label={useNodeName(id, 'mic')}
      overviewArt={(box) => <SourceArt nodeId={id} typeKey="mic" box={box} />} overviewBare
    >
      <MeterSides nodeId={id} input={false} spl={SPL_DB.mic} hideOutput={notConnected}>
        {choosing
          ? <CharacterButtons nodeId={id} typeKey="mic" columns={1} height={MIC_BUTTONS_H} />
          : <div style={{ display: 'flex', justifyContent: 'center' }}><OverviewIcon icon={<Icon />} box={{ w: MIC_ICON, h: MIC_ICON }} /></div>}
      </MeterSides>
    </NodeWrapper>
  )
}
