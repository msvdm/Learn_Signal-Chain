import type { ReactNode } from 'react'
import type { TypeKey } from '../../data/nodeRegistry'
import { useNodeChrome } from '../../hooks/useNodeChrome'
import { PORT_TOP } from '../../utils/layoutHelpers'
import { EdgeTags, PortStack, WireTargetBadge } from './NodeChrome'

// Room between a port ring (on the edge) and the control: the ring reaches 14px in, then a gap
const SIDE = 26
// Between the control (with its name) and what is beside it
const BESIDE_GAP = 16

interface FreeControlProps {
  nodeId: string
  typeKey: TypeKey
  /** Name under the control (follows the wiring: Preamp / Gain, Pan / Balance, Main Fader). */
  label: string
  /** false = no name under the control, when the control says it all (the Switch's On / Off) */
  showName?: boolean
  /** Reading under the name. Keep it in a StableText so the control never changes size. */
  value?: ReactNode
  /**
   * Distance from the control's top edge to its port line: the control is placed so this line
   * sits at PORT_TOP, level with every card's first port, and wires between them stay straight.
   */
  portLine: number
  /** The control itself (knob, fader, button) */
  children: ReactNode
  /** Under the reading (Pan's direction indicator) */
  footer?: ReactNode
  /** The name and reading this many times their usual size (the Gain and Pan knobs: 2, read zoomed out) */
  textScale?: number
  /** false = no box around it, hovered or selected: the control shows its selection itself (the amps — D27) */
  outline?: boolean
  /** Right of the control and its name, its top level with the control's (the Preamp's meter — D34) */
  beside?: ReactNode
}

/**
 * A free-standing control: Gain, Pan, Fader, Switch, Pad, 48V (and the Compressor below Advanced) are drawn as the bare control with its
 * connection points, not as a card. The same size at every zoom (no overview face), large
 * enough to read zoomed out. Remove is in the right-click menu, like on the cards.
 * Grab the name or the space around the control to move it.
 */
export function FreeControl({ nodeId, typeKey, label, showName = true, value, portLine, children, footer, textScale = 1, outline = true, beside }: FreeControlProps) {
  const { ports, selected, overview, wireTarget } = useNodeChrome(nodeId, typeKey)
  // Room above the control so its port line sits at PORT_TOP. A control whose port line is lower
  // than that (a 110px knob: 55) reaches above the box instead — a negative padding would void
  // the whole padding rule, its side room for the port rings with it
  const lift = PORT_TOP - portLine

  return (
    <div
      className={`lsc-free-control${selected ? ' lsc-selected' : ''}`}
      style={{
        position: 'relative',
        width: 'max-content',
        padding: `${Math.max(0, lift)}px ${SIDE}px 14px`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        color: 'var(--lsc-fg)',
        pointerEvents: 'auto',
      }}
    >
      {/* Outline: faint dashes on hover; selected = a solid ring, a soft glow and a tinted
          background (thicker zoomed out, so it still shows) */}
      {outline && <div
        aria-hidden
        className="lsc-free-outline"
        style={{
          position: 'absolute', inset: 0, borderRadius: 'var(--lsc-radius-lg)', pointerEvents: 'none',
          ...(selected ? {
            border: `${overview ? 12 : 4}px solid var(--lsc-accent)`,
            background: 'var(--lsc-select-tint)',
            boxShadow: `0 0 0 ${overview ? 36 : 12}px var(--lsc-select-halo)`,
          } : {}),
        }}
      />}

      {wireTarget && <WireTargetBadge label={label} />}

      <PortStack nodeId={nodeId} ports={ports} />
      <EdgeTags nodeId={nodeId} overview={overview} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: BESIDE_GAP }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {lift < 0 ? <div style={{ marginTop: lift }}>{children}</div> : children}

          {/* Name and reading, like the print under a desk's control */}
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {showName && (
              <span
                style={{
                  fontSize: 15 * textScale, fontWeight: 700, lineHeight: 1.15, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--lsc-fg-muted)',
                  // Long names wrap instead of widening the control
                  maxWidth: 200 * textScale, textAlign: 'center',
                }}
              >
                {label}
              </span>
            )}
            {value !== undefined && (
              <span style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: 22 * textScale, fontWeight: 700, lineHeight: 1.1 }}>
                {value}
              </span>
            )}
          </div>
        </div>
        {beside && <div style={{ marginTop: Math.min(0, lift) }}>{beside}</div>}
      </div>

      {footer && <div style={{ marginTop: 10, alignSelf: 'stretch' }}>{footer}</div>}
    </div>
  )
}
