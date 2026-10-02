import type { ReactNode } from 'react'
import { NodeWrapper } from './NodeWrapper'

interface InlineNodeProps {
  nodeId: string
  typeKey: string
  icon: ReactNode
  label: string
  accentColor?: string
  /** A single big reading shown at the top of the body (e.g. a source's level). */
  value?: string
  children?: ReactNode
  align?: 'start' | 'center'
}

/**
 * Simple single-control nodes (sources, gain, fader, switch …).
 * Same card shell as every other node; the body just centres one control.
 */
export function InlineNode({
  nodeId,
  typeKey,
  icon,
  label,
  value,
  children,
  align = 'center',
}: InlineNodeProps) {
  return (
    <NodeWrapper nodeId={nodeId} typeKey={typeKey} icon={icon} label={label} align={align}>
      {value && (
        <span style={{ fontFamily: 'var(--lsc-font-mono)', fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>
          {value}
        </span>
      )}
      {children}
    </NodeWrapper>
  )
}
