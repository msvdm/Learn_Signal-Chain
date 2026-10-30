import { useContext } from 'react'
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import type { TypeKey } from '../../data/nodeRegistry'
import { useSignalStore } from '../../store/signalStore'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { MirroredIcons } from './mirroredIcons'
import { NOTE_ICON_GAP, NOTE_ICON_W, NOTE_LINE } from './noteLayout'

// An element with no card around it, drawn the same at every zoom (D28): the speakers and the
// Headphones (BareOutput), the sources played on a line or in the air (BareSource), the Computer.

/** Its icon's box (px) */
export const FACE = 240
/** Between the icon and what is beside it (a Volume knob, the Computer's meter) */
export const BESIDE_GAP = 16
/** A control beside it: its room across (px) */
export const BESIDE_W = 150
/** Its port line, from the drawing's top: on the icon, with a note under it or not */
const PORT_LINE = 100
/** Its name, this many times a free control's (read zoomed out) */
const NAME_SCALE = 1.5
/** A selected icon's glow, each side of its lines (px on the canvas; thicker zoomed out) */
const GLOW = 12
const GLOW_FAR = 24

/** What an icon takes: lucide's icons, or one drawn in their style (a blown speaker, the guitar) — drawn in `currentColor` */
export type FramelessIcon = ComponentType<{ size?: number }>

/** A note under its icon: its words, their colour and size (px), a small picture at their start */
export interface FramelessNote {
  text: string
  color: string
  size: number
  icon?: (size: number) => ReactNode
}

/** Beside its icon: what, and its room across (px) */
interface Beside {
  node: ReactNode
  width: number
}

/**
 * An element with no card around it (D28), like the amps (D27): its icon — selected, its own lines
 * turn the accent colour with a soft glow around them — with what is `before` it (on its input's
 * side: the Active Speaker's Volume knob) or `after` it (on its output's side: the Computer's
 * meter), its name, and its `footer` under them (its meter). A `note` under the icon grows the
 * element downward; the icon keeps its size. The same at every zoom.
 */
export function Frameless({ id, typeKey, Icon, color, flipped = false, note, before, after, footer }: {
  id: string
  typeKey: TypeKey
  Icon: FramelessIcon
  /** The icon's colour (a condition's), else the text colour */
  color?: string
  /** Flipped horizontally: its picture faces the other way, what is beside it swaps sides */
  flipped?: boolean
  note?: FramelessNote
  before?: Beside
  after?: Beside
  footer: (width: number) => ReactNode
}) {
  const label = useNodeName(id, typeKey)
  // The icon and what is beside it: the note and the footer as wide as them
  const width = FACE + (before ? BESIDE_GAP + before.width : 0) + (after ? BESIDE_GAP + after.width : 0)
  const side  = (b: Beside) => (
    <div className="nodrag nopan" style={{ width: b.width, height: FACE, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}>
      {b.node}
    </div>
  )

  return (
    <MirroredIcons.Provider value={flipped}>
      <FreeControl
        nodeId={id} typeKey={typeKey} label={label} portLine={PORT_LINE} textScale={NAME_SCALE} outline={false}
        footer={footer(width)}
      >
        <div style={{ width, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          {/* In signal order: what comes before the icon on its input's side (flipped, the input
              is on the right, and so is it) */}
          <div style={{ display: 'flex', flexDirection: flipped ? 'row-reverse' : 'row', alignItems: 'center', gap: BESIDE_GAP }}>
            {before && side(before)}
            <SelectableIcon nodeId={id} Icon={Icon} size={FACE} color={color} />
            {after && side(after)}
          </div>
          {note && (
            <span style={{ fontSize: note.size, fontWeight: 700, lineHeight: NOTE_LINE, textAlign: 'center', color: note.color, maxWidth: width }}>
              {note.icon && (
                <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: `${NOTE_ICON_GAP}em` }}>
                  {note.icon(Math.round(note.size * NOTE_ICON_W))}
                </span>
              )}
              {note.text}
            </span>
          )}
        </div>
      </FreeControl>
    </MirroredIcons.Provider>
  )
}

/**
 * The icon, `size` px square. Selected, its lines turn the accent colour with the soft glow around
 * them (the same icon drawn under it, its lines thicker) — its own outline, as the amps' (D27).
 */
function SelectableIcon({ nodeId, Icon, size, color = 'var(--lsc-fg)' }: {
  nodeId: string
  Icon: FramelessIcon
  size: number
  color?: string
}) {
  const selected = useSignalStore((s) => s.selectedNodeIds.includes(nodeId))
  const overview = useSignalStore((s) => s.overview)
  const mirrored = useContext(MirroredIcons)
  // The icon's lines are 2 of its 24 units: the glow is added each side, in those units
  const glow = (2 * (overview ? GLOW_FAR : GLOW)) / (size / 24)
  const layer: CSSProperties = { position: 'absolute', inset: 0, display: 'block', lineHeight: 0 }
  return (
    <span aria-hidden style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'block', ...(mirrored ? { transform: 'scaleX(-1)' } : {}) }}>
      {selected && (
        // One translucent layer (opacity on the whole picture: where its lines cross it is no
        // darker); its lines thickened by CSS (lsc-icon-glow), whatever icon it is
        <span
          className="lsc-icon-glow"
          style={{ ...layer, color: 'var(--lsc-accent)', opacity: 0.35, '--lsc-glow': `${2 + glow}px` } as CSSProperties}
        >
          <Icon size={size} />
        </span>
      )}
      <span style={{ ...layer, color: selected ? 'var(--lsc-accent)' : color }}><Icon size={size} /></span>
    </span>
  )
}
