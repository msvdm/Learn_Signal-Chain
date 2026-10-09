import type { ReactNode } from 'react'
import type { TypeKey } from '../../data/nodeRegistry'
import type { NodeChrome } from '../../hooks/useNodeChrome'
import type { Size } from '../../utils/geometry'
import { EdgeTags, PortStack, WireTargetBadge } from './NodeChrome'

/**
 * What every card has, whatever it shows (NodeWrapper: a full card; FaceCard: only its face; the
 * Relay Switch its own): its box — border, background, the selection ring and glow, at least `size`
 * —, the chain colour stripe, its ports, the tags on its bottom edge, and while a wire is being
 * drawn the badge saying it can take it. Zoomed out a `bare` card has no box: only a selection
 * still draws its ring.
 */
export function CardFrame({ nodeId, typeKey, label, chrome, size, bare = false, notConnectedTag = false, children }: {
  nodeId: string
  typeKey: TypeKey
  label: string
  chrome: NodeChrome
  size: Size
  bare?: boolean
  /** "Not connected" on the bottom edge (a full card's source; a face says it on its face) */
  notConnectedTag?: boolean
  children: ReactNode
}) {
  const { node, ports, chains, selected, overview, wireTarget } = chrome
  const isBypassed  = node?.bypassed ?? false
  const borderColor = bare && !selected ? 'transparent' : isBypassed ? 'var(--signal-hot)' : selected ? 'var(--lsc-accent)' : 'var(--lsc-border)'
  // Selected: a solid ring, a soft glow and a tinted face — thicker zoomed out, so it still shows
  const ring = overview ? 12 : 4

  return (
    <div
      className={`lsc-node-card select-none${selected ? ' lsc-selected' : ''}`}
      style={{
        position: 'relative',
        width: 'max-content',
        minWidth: size.w,
        minHeight: size.h,
        display: 'flex',
        flexDirection: 'column',
        background: selected
          ? 'linear-gradient(var(--lsc-select-tint), var(--lsc-select-tint)), var(--lsc-node-bg)'
          : bare ? 'transparent' : 'var(--lsc-node-bg)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--lsc-radius-lg)',
        boxShadow: selected
          ? `0 0 0 ${ring}px var(--lsc-accent), 0 0 0 ${ring * 3}px var(--lsc-select-halo), var(--lsc-shadow-node)`
          : bare ? 'none' : 'var(--lsc-shadow-node)',
        color: 'var(--lsc-fg)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        pointerEvents: 'auto',
      }}
    >
      {wireTarget && <WireTargetBadge label={label} />}

      {/* Chain colour stripe — one segment per source feeding this card */}
      {chains.length > 0 && !bare && (
        <div
          aria-hidden
          style={{
            position: 'absolute', top: 0, left: 10, right: 10, height: 3,
            display: 'flex', borderRadius: '0 0 3px 3px', overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {chains.map((c) => <span key={c} style={{ flex: 1, background: c }} />)}
        </div>
      )}

      <PortStack nodeId={nodeId} typeKey={typeKey} ports={ports} />
      <EdgeTags nodeId={nodeId} overview={overview} notConnected={notConnectedTag} />

      {children}
    </div>
  )
}
