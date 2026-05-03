import type { NodeProps, Node } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { GitBranch, X, HelpCircle } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { TooltipPanel } from '../Tooltip'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { getHealthStyle } from '../../hooks/useGainStaging'

interface GraphRelayData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function RelayNode({ id, data }: NodeProps<Node<GraphRelayData>>) {
  const { stages, portSignal } = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const removeNode       = useSignalStore((s) => s.removeNode)
  const setActiveTooltip = useSignalStore((s) => s.setActiveTooltip)
  const activeTooltipId  = useSignalStore((s) => s.activeTooltipId)
  const allEdges         = useSignalStore((s) => s.edges)
  const { t }            = useTranslation()

  const selected    = (node?.params.selectedInput as string) ?? 'a'
  const result      = stages[id]
  const health      = result?.health ?? 'too-quiet'
  const healthStyle = getHealthStyle(health)
  const hasTooltip  = Boolean(t.theory?.relay)

  // Find the signal level coming into each input handle
  const incomingA = allEdges.find((e) => e.target === id && e.targetHandle === 'in-a')
  const incomingB = allEdges.find((e) => e.target === id && e.targetHandle === 'in-b')
  const sigA = incomingA ? (portSignal.get(`${incomingA.source}:${incomingA.sourceHandle}`) ?? -Infinity) : -Infinity
  const sigB = incomingB ? (portSignal.get(`${incomingB.source}:${incomingB.sourceHandle}`) ?? -Infinity) : -Infinity

  return (
    <div
      className="relative select-none cursor-default"
      style={{
        width: 130,
        background: 'var(--lsc-node-bg)',
        border: `1px solid ${healthStyle.border}`,
        borderRadius: 'var(--lsc-radius-md)',
        boxShadow: activeTooltipId === id ? '0 0 0 2px var(--lsc-accent)' : 'var(--lsc-shadow-node)',
        transition: 'border-color 0.15s',
        pointerEvents: 'auto',
      }}
    >
      {/* Input handle A — upper left */}
      <Handle
        id="in-a"
        type="target"
        position={Position.Left}
        style={{
          top: '33%', width: 10, height: 10,
          background: selected === 'a' ? 'var(--signal-good)' : 'var(--lsc-border)',
          border: '2px solid var(--lsc-node-bg)', borderRadius: '50%', cursor: 'crosshair',
        }}
      />

      {/* Input handle B — lower left */}
      <Handle
        id="in-b"
        type="target"
        position={Position.Left}
        style={{
          top: '67%', width: 10, height: 10,
          background: selected === 'b' ? 'var(--signal-good)' : 'var(--lsc-border)',
          border: '2px solid var(--lsc-node-bg)', borderRadius: '50%', cursor: 'crosshair',
        }}
      />

      {/* Output handle — center right */}
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        style={{
          top: '50%', width: 10, height: 10,
          background: healthStyle.color,
          border: '2px solid var(--lsc-node-bg)', borderRadius: '50%', cursor: 'crosshair',
        }}
      />

      {/* Action row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2, padding: '3px 4px 0' }}>
        <button
          className="nodrag nopan"
          title={t.nodeControls.remove}
          style={{ padding: '1px', color: 'var(--lsc-text)', cursor: 'pointer', background: 'none', border: 'none' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--signal-clipping)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--lsc-text)')}
          onClick={() => removeNode(id)}
        >
          <X size={10} />
        </button>
        {hasTooltip && (
          <button
            className="nodrag nopan"
            style={{ padding: '1px', color: 'var(--lsc-text)', cursor: 'pointer', background: 'none', border: 'none' }}
            onClick={() => setActiveTooltip(activeTooltipId === id ? null : id)}
          >
            <HelpCircle size={10} />
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '2px 8px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--lsc-accent)' }}>
          <GitBranch size={12} />
          <span style={{ fontSize: 'var(--node-text-md)', fontWeight: 600, color: 'var(--lsc-text)' }}>
            {data.label ?? t.nodes.relay?.label ?? 'Relay'}
          </span>
        </div>

        {/* A / B input selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['a', 'b'] as const).map((ch) => (
            <button
              key={ch}
              className="nodrag nopan"
              onClick={() => updateNodeParams(id, { selectedInput: ch })}
              style={{
                flex: 1, padding: '3px 0',
                fontSize: 'var(--node-text-xs)', fontWeight: 700, textTransform: 'uppercase',
                borderRadius: 'var(--lsc-radius-sm)',
                border: `1px solid ${selected === ch ? 'var(--signal-good)' : 'var(--lsc-border)'}`,
                background: selected === ch ? 'var(--signal-good-bg)' : 'transparent',
                color: selected === ch ? 'var(--signal-good)' : 'var(--lsc-text)',
                cursor: 'pointer',
              }}
            >
              {ch.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Input level readouts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {(['a', 'b'] as const).map((ch) => {
            const sig    = ch === 'a' ? sigA : sigB
            const active = selected === ch
            return (
              <div
                key={ch}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontSize: 'var(--node-text-2xs)', fontWeight: 700, color: active ? 'var(--signal-good)' : 'var(--lsc-text)', opacity: active ? 1 : 0.4 }}>
                  In {ch.toUpperCase()}
                </span>
                <span style={{
                  fontSize: 'var(--node-text-2xs)', fontFamily: 'var(--lsc-font-mono)',
                  color: active ? getHealthStyle(result?.health ?? 'too-quiet').color : 'var(--lsc-text)',
                  opacity: active ? 1 : 0.4,
                }}>
                  {isFinite(sig) ? sig.toFixed(1) : '−∞'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {hasTooltip && <TooltipPanel instanceId={id} typeKey="relay" />}
    </div>
  )
}
