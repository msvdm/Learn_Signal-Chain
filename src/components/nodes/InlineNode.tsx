import type { ReactNode } from 'react'
import type { TypeKey } from '../../data/nodeRegistry'
import { NodeWrapper } from './NodeWrapper'
import type { OverviewArt } from './OverviewFace'

interface InlineNodeProps {
  nodeId: string
  typeKey: TypeKey
  label: string
  /** A single big reading shown at the top of the body (e.g. a source's level). */
  value?: string
  children?: ReactNode
  align?: 'start' | 'center'
  overviewArt?: OverviewArt
  overviewLevel?: boolean
}

/**
 * Simple single-control nodes (sources, gain, fader, switch …).
 * Same card shell as every other node; the body just centres one control.
 */
export function InlineNode({
  nodeId,
  typeKey,
  label,
  value,
  children,
  align = 'center',
  overviewArt,
  overviewLevel,
}: InlineNodeProps) {
  return (
    <NodeWrapper
      nodeId={nodeId} typeKey={typeKey} label={label} align={align}
      overviewArt={overviewArt} overviewLevel={overviewLevel}
    >
      {value && (
        <span style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>
          {value}
        </span>
      )}
      {children}
    </NodeWrapper>
  )
}
