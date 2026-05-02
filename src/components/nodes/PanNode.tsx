import type { NodeProps, Node } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { MoveHorizontal, X, HelpCircle } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { TooltipPanel } from '../Tooltip'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { getHealthStyle } from '../../hooks/useGainStaging'
import { KnobControl } from '../controls/KnobControl'

interface GraphPanData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function PanNode({ id, data }: NodeProps<Node<GraphPanData>>) {
  const { stages, portSignal } = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const removeNode       = useSignalStore((s) => s.removeNode)
  const setActiveTooltip = useSignalStore((s) => s.setActiveTooltip)
  const activeTooltipId  = useSignalStore((s) => s.activeTooltipId)
  const { t }            = useTranslation()

  const panPosition = (node?.params.panPosition as number) ?? 50
  const result      = stages[id]
  const healthStyle = getHealthStyle(result?.health ?? 'too-quiet')
  const hasTooltip  = Boolean(t.theory?.pan)

  const outL = portSignal.get(`${id}:out-l`) ?? -Infinity
  const outR = portSignal.get(`${id}:out-r`) ?? -Infinity

  function panLabel(pos: number): string {
    if (pos <= 2)  return 'L'
    if (pos >= 98) return 'R'
    if (pos < 50)  return `L${50 - pos}`
    if (pos > 50)  return `R${pos - 50}`
    return 'C'
  }

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
      {/* Input handle — center left */}
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        style={{
          top: '50%', width: 10, height: 10,
          background: 'var(--lsc-border)',
          border: '2px solid var(--lsc-node-bg)', borderRadius: '50%', cursor: 'crosshair',
        }}
      />

      {/* Output handle L — upper right */}
      <Handle
        id="out-l"
        type="source"
        position={Position.Right}
        style={{
          top: '35%', width: 10, height: 10,
          background: isFinite(outL) ? getHealthStyle(getHealth(outL)).color : 'var(--lsc-border)',
          border: '2px solid var(--lsc-node-bg)', borderRadius: '50%', cursor: 'crosshair',
        }}
      />

      {/* Output handle R — lower right */}
      <Handle
        id="out-r"
        type="source"
        position={Position.Right}
        style={{
          top: '65%', width: 10, height: 10,
          background: isFinite(outR) ? getHealthStyle(getHealth(outR)).color : 'var(--lsc-border)',
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
      <div style={{ padding: '2px 8px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <MoveHorizontal size={12} style={{ color: 'var(--lsc-accent)' }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--lsc-text)' }}>
            {data.label ?? t.nodes.pan?.label ?? 'Pan'}
          </span>
        </div>

        {/* Pan knob: 0 = full left, 50 = centre, 100 = full right */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <KnobControl
            value={panPosition}
            min={0}
            max={100}
            step={1}
            label="L ← → R"
            formatValue={(v) => panLabel(v)}
            onChange={(v) => updateNodeParams(id, { panPosition: v })}
            color="var(--lsc-accent)"
            size={44}
          />
        </div>

        {/* L / R output levels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {([['L', outL], ['R', outR]] as [string, number][]).map(([ch, sig]) => (
            <div key={ch} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 8, fontWeight: 700,
                  color: isFinite(sig) ? getHealthStyle(getHealth(sig)).color : 'var(--lsc-text)',
                }}
              >
                {ch}
              </span>
              <span
                style={{
                  fontSize: 8, fontFamily: 'var(--lsc-font-mono)',
                  color: isFinite(sig) ? getHealthStyle(getHealth(sig)).color : 'var(--lsc-text)',
                }}
              >
                {isFinite(sig) ? `${sig.toFixed(1)}` : '−∞'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {hasTooltip && <TooltipPanel instanceId={id} typeKey="pan" />}
    </div>
  )
}
