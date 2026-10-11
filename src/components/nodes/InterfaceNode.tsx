import type { ReactNode } from 'react'
import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { useStage, useWire } from '../../hooks/useGraphSignal'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { PLAYBACK_PORT } from '../../data/nodeRegistry'
import { outputKey } from '../../graph/graph'
import { levelOf } from '../../signal/engine'
import { PORT_GAP, PORT_TOP } from '../../utils/layoutHelpers'
import { FaceCard } from './FaceCard'
import { NODE_LOOK } from './nodeLook'
import { OverviewIcon } from './OverviewFace'
import { PAD } from './overviewLayout'

// Record and play back (D22): the Audio Interface and the DAW, two face cards — a big icon and an
// upright meter reading what they record (the Interface in dBu, the DAW in dBFS). Zoomed in, a line
// across the face on each port line names what goes in and out there, each name lit while sound
// passes; an arrow joins them where one is the other's way on (the Interface's two paths).

/** A path line's height (px): centred on its port line */
const LINE_H = 20

/** Where port line `row` is in a face's art box (it starts PAD below the card's top) */
const lineTop = (row: number) => PORT_TOP + row * PORT_GAP - PAD - LINE_H / 2

const shade = (lit: boolean) => (lit ? 'var(--lsc-accent)' : 'var(--lsc-fg-muted)')

/**
 * One port line across the face: the input's name on the left, the output's on the right, each lit
 * while sound passes there; `arrow`: the sound goes from one to the other.
 */
function PortLine({ row, from, to, lit, arrow }: {
  row: number
  from: string
  to: string
  lit: readonly [from: boolean, to: boolean]
  arrow: boolean
}) {
  return (
    <div
      style={{
        position: 'absolute', left: 0, right: 0, top: lineTop(row), height: LINE_H,
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 'var(--node-text-xs)', fontWeight: 600, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: shade(lit[0]) }}>{from}</span>
      <svg height="10" viewBox="0 0 100 10" preserveAspectRatio="none" style={{ flex: 1, minWidth: 16, color: shade(lit[0] && lit[1]), visibility: arrow ? 'visible' : 'hidden' }}>
        <path d="M0 5H98M92 1L98 5L92 9" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <span style={{ color: shade(lit[1]) }}>{to}</span>
    </div>
  )
}

/** The face: the port lines on top (zoomed in), the icon under them. */
function Face({ box, lines, icon }: { box: { w: number; h: number }; lines: ReactNode; icon: ReactNode }) {
  const overview = useSignalStore((s) => s.overview)
  // Zoomed out the icon alone, as big as it fits
  if (overview) return <OverviewIcon icon={icon} box={box} />
  const below = lineTop(2) + LINE_H
  return (
    <div style={{ position: 'relative', width: box.w, height: box.h }}>
      {lines}
      <div style={{ position: 'absolute', left: 0, right: 0, top: below, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <OverviewIcon icon={icon} box={{ w: box.w, h: box.h - below }} />
      </div>
    </div>
  )
}

/**
 * Audio Interface: Line in → To computer (what it records, its meter in dBu), From computer → Line
 * out L / R (what the computer plays back) — two paths that never meet (NodeTypeDef `routes`).
 */
export function InterfaceNode({ id }: CardProps) {
  const { t }     = useTranslation()
  const text      = t.nodes.interface
  const Icon      = NODE_LOOK.interface.icon
  const recording = isFinite(levelOf(useStage(id)?.in))
  // The DAW plays into From computer: both line outputs carry it
  const playing   = isFinite(levelOf(useWire(outputKey(id, 'out-l'))))
  return (
    <FaceCard
      nodeId={id} typeKey="interface" label={useNodeName(id, 'interface')} meterAt="in"
      art={(box) => (
        <Face
          box={box} icon={<Icon />}
          lines={<>
            <PortLine row={0} from={text.lineIn} to={text.toComputer} lit={[recording, recording]} arrow />
            <PortLine row={1} from={text.fromComputer} to={text.lineOut} lit={[playing, playing]} arrow />
          </>}
        />
      )}
    />
  )
}

/** DAW: it records what arrives (its meter in dBFS) and, apart from that, plays back a song of its own. */
export function DawNode({ id }: CardProps) {
  const { t }     = useTranslation()
  const text      = t.nodes.daw
  const Icon      = NODE_LOOK.daw.icon
  const recording = isFinite(levelOf(useStage(id)?.in))
  const playing   = useSignalStore((s) => s.edges.some((e) => e.source === id && e.sourceHandle === PLAYBACK_PORT))
  return (
    <FaceCard
      nodeId={id} typeKey="daw" label={useNodeName(id, 'daw')} meterAt="in"
      art={(box) => (
        <Face
          box={box} icon={<Icon />}
          lines={<PortLine row={0} from={text.records} to={text.playsBack} lit={[recording, playing]} arrow={false} />}
        />
      )}
    />
  )
}
