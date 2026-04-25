import { Handle, Position } from '@xyflow/react'

// Placeholder end-of-chain marker (shown when chain has no speaker node)
export function EndNode() {
  return (
    <div className="nodrag nopan" style={{ pointerEvents: 'auto' }}>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <div
        style={{
          width: 22, height: 22,
          borderRadius: '50%',
          background: 'var(--lsc-node-bg)',
          border: '1.5px dashed var(--lsc-border)',
          opacity: 0.35,
        }}
      />
    </div>
  )
}
