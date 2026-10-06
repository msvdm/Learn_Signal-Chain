import type { ReactNode } from 'react'
import type { TypeKey } from '../../data/nodeRegistry'
import { useNodeChrome } from '../../hooks/useNodeChrome'
import { PORT_TOP } from '../../utils/layoutHelpers'
import { NoiseTags, PortStack, WireTargetBadge } from './NodeChrome'

// Room between a port ring (on the edge) and the control: the ring reaches 14px in, then a gap
const SIDE = 26

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
}

/**
 * A free-standing control: Gain, Pan, Fader, Switch and Pad are drawn as the bare control with its
 * connection points, not as a card. The same size at every zoom (no overview face), large
 * enough to read zoomed out. Help and Remove are in the right-click menu, like on the cards.
 * Grab the name or the space around the control to move it.
 */
export function FreeControl({ nodeId, typeKey, label, showName = true, value, portLine, children, footer }: FreeControlProps) {
  const { ports, chains, selected, overview, wireTarget } = useNodeChrome(nodeId, typeKey)

  return (
    <div
      className={`lsc-free-control select-none ${selected ? 'lsc-selected' : ''}`}
      // Without its name under it, the name shows on hover
      title={showName ? undefined : label}
      style={{
        position: 'relative',
        width: 'max-content',
        padding: `${PORT_TOP - portLine}px ${SIDE}px 14px`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        color: 'var(--lsc-fg)',
        pointerEvents: 'auto',
      }}
    >
      {/* Outline: faint dashes on hover; selected = a solid ring, a soft glow and a tinted
          background (thicker zoomed out, so it still shows) */}
      <div
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
      />

      {wireTarget && <WireTargetBadge label={label} />}

      <PortStack nodeId={nodeId} typeKey={typeKey} ports={ports} />
      <NoiseTags nodeId={nodeId} overview={overview} />

      {children}

      {/* Name and reading, like the print under a desk's control */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        {showName && (
          <span
            style={{
              fontSize: 15, fontWeight: 700, lineHeight: 1.15, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--lsc-fg-muted)',
              // Long names wrap instead of widening the control
              maxWidth: 200, textAlign: 'center',
            }}
          >
            {label}
          </span>
        )}
        {value !== undefined && (
          <span style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>
            {value}
          </span>
        )}
        {/* Which sources (chains) pass through it — the space is kept when there are none */}
        <div aria-hidden style={{ display: 'flex', width: 40, height: 4, borderRadius: 9999, overflow: 'hidden', marginTop: 2 }}>
          {chains.map((c) => <span key={c} style={{ flex: 1, background: c }} />)}
        </div>
      </div>

      {footer && <div style={{ marginTop: 10, alignSelf: 'stretch' }}>{footer}</div>}
    </div>
  )
}
