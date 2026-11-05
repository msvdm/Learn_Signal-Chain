import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { useNodeChrome } from '../../hooks/useNodeChrome'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { NODE_REGISTRY, TO_PC_PORT, portRows } from '../../data/nodeRegistry'
import { PORT_GAP, PORT_TOP } from '../../utils/layoutHelpers'
import { CardFrame } from './CardFrame'
import { NodeWrapper } from './NodeWrapper'
import { NODE_LOOK } from './nodeLook'
import { LINE_H, lineTop } from './portLines'

// Record and play back (D22): the Audio Interface — a plain card, the USB sign and its outputs'
// names — and the DAW, a bus's face (D39). Their Look inside (D22) is in the right-click menu at
// Intermediate (NodeMenu, LookInside.tsx). PortLine is Beginner's Interface face's (BeginnerFaces).

const shade = (lit: boolean) => (lit ? 'var(--lsc-accent)' : 'var(--lsc-fg-muted)')

/**
 * One port line across the face: the input's name on the left, the output's on the right, each lit
 * while sound passes there; `arrow`: the sound goes from one to the other.
 */
export function PortLine({ row, from, to, lit, arrow }: {
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

/**
 * The USB sign's size (px) — the gap between the two names' lines, so a long name (Bulgarian's
 * "Към компютъра") runs over it, never into it — and its room from the card's left edge (the input
 * rings reach 14px in)
 */
const USB_ICON = 80
const USB_LEFT = 30
/** The outputs' names: as big as a bus's Output label (24px), clear of the output rings */
const OUT_TEXT  = 24
const OUT_RIGHT = 26

/**
 * Audio Interface, from Intermediate (D22): a plain card, the same at every zoom — the USB sign on
 * its left, its inputs one port per wire as a bus's (what it records, over the USB wire into the
 * computer), its two outputs named beside their rings: To computer, and three lines down Line out
 * (the computer's sound, back along the same USB wire — no port on the left for it). Nothing else:
 * no meter; Look inside is in its right-click menu (NodeMenu). Beginner has its own face (BeginnerInterface).
 */
export function InterfaceNode({ id }: CardProps) {
  const { t }   = useTranslation()
  const text    = t.nodes.interface
  const chrome  = useNodeChrome(id, 'interface')
  const label   = useNodeName(id, 'interface')
  const Icon    = NODE_LOOK.interface.icon
  const rows    = portRows(chrome.ports.outputs)
  const rowOf   = (match: (portId: string) => boolean) => rows[chrome.ports.outputs.findIndex((p) => match(p.id))] ?? 0
  const toPc    = rowOf((p) => p === TO_PC_PORT)
  // Line out: its whole output, or its L while it feeds speakers (D43)
  const lineOut = rowOf((p) => p === 'out' || p === 'out-l')
  const size    = NODE_REGISTRY.interface.freeSize!
  const lastRow = Math.max(0, ...portRows(chrome.ports.inputs), ...rows)
  const height  = Math.max(size.h, PORT_TOP + lastRow * PORT_GAP + 24)
  const name = (row: number, words: string) => (
    <span
      style={{
        position: 'absolute', right: OUT_RIGHT, top: PORT_TOP + row * PORT_GAP, transform: 'translateY(-50%)',
        fontSize: OUT_TEXT, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap', color: 'var(--lsc-fg)',
      }}
    >
      {words}
    </span>
  )
  return (
    <CardFrame nodeId={id} label={label} chrome={chrome} size={{ w: size.w, h: height }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <span
          aria-hidden
          style={{ position: 'absolute', left: USB_LEFT, top: PORT_TOP + ((toPc + lineOut) / 2) * PORT_GAP - USB_ICON / 2, display: 'flex' }}
        >
          <Icon size={USB_ICON} />
        </span>
        {name(toPc, text.toComputer)}
        {name(lineOut, text.lineOut)}
      </div>
    </CardFrame>
  )
}

/**
 * DAW (D39): the Master Bus's face, at every zoom — no zoomed-in form: its icon over its name and
 * the health word (what is wrong instead: fed an analog signal at Advanced it records nothing), on
 * the right its meter of what it adds up (what it records; at Advanced its mix: a digital summing
 * bus, D23) with its Peak, RMS and Noise beside it. At Intermediate its *Look inside*
 * button over the icon (D22).
 */
export function DawNode({ id }: CardProps) {
  const advanced = useSignalStore((s) => s.complexityLevel === 'advanced')
  const { t, fmt } = useTranslation()
  // At Advanced: what it records into, a file per track (D40) — each wire into it a track
  const tracks   = useSignalStore((s) => s.edges.reduce((n, e) => n + (e.target === id && e.targetHandle === 'in' ? 1 : 0), 0))
  const under    = advanced && tracks > 0
    ? fmt(tracks === 1 ? t.files.recordsTrack : t.files.recordsTracks, { n: String(tracks) })
    : undefined
  return (
    <NodeWrapper
      nodeId={id} typeKey="daw" label={useNodeName(id, 'daw')} overviewSides="output" faceOnly
      face={{ reads: advanced ? 'out' : 'in', Icon: NODE_LOOK.daw.icon, under }}
    />
  )
}
