import type { ReactNode, CSSProperties } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Power, X, HelpCircle } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { TooltipPanel } from '../Tooltip'
import { NODE_REGISTRY } from '../../data/nodeRegistry'

// Sources and passive speaker — no bypass, no remove button
const PROTECTED_TYPES = new Set(['mic', 'line-in', 'instrument', 'speaker'])
// These nodes can be removed but bypassing them makes no sense
const NO_BYPASS_TYPES = new Set(['amp', 'master-bus', 'bus', 'active-speaker', 'audio-interface'])

interface NodeWrapperProps {
  nodeId: string
  typeKey: string
  icon: ReactNode
  label: string
  accentColor?: string
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

export function NodeWrapper({
  nodeId,
  typeKey,
  icon,
  label,
  accentColor,
  children,
  className = '',
  style,
}: NodeWrapperProps) {
  const setActiveTooltip    = useSignalStore((s) => s.setActiveTooltip)
  const activeTooltipId     = useSignalStore((s) => s.activeTooltipId)
  const toggleBypassNode    = useSignalStore((s) => s.toggleBypassNode)
  const removeNode          = useSignalStore((s) => s.removeNode)
  const { t }               = useTranslation()

  const isBypassed  = useSignalStore((s) => s.nodes.find((n) => n.id === nodeId)?.bypassed ?? false)
  const isProtected = PROTECTED_TYPES.has(typeKey)
  const isNoBypass  = NO_BYPASS_TYPES.has(typeKey)
  const hasTooltip  = Boolean(t.theory[typeKey])

  const def     = NODE_REGISTRY[typeKey]
  const inputs  = def?.inputs ?? []
  const outputs = def?.outputs ?? []

  const borderAccent = accentColor
    ? `3px solid ${isBypassed ? 'var(--signal-hot)' : accentColor}`
    : `1px solid ${isBypassed ? 'var(--signal-hot)' : 'var(--lsc-border)'}`

  return (
    <div
      className={`relative w-52 select-none cursor-default ${className}`}
      style={{
        background: 'var(--lsc-node-bg)',
        border: `1px solid ${isBypassed ? 'var(--signal-hot)' : 'var(--lsc-border)'}`,
        borderLeft: borderAccent,
        borderRadius: 'var(--lsc-radius-lg)',
        boxShadow: activeTooltipId === nodeId
          ? '0 0 0 2px var(--lsc-accent)'
          : 'var(--lsc-shadow-node)',
        transition: 'border-color 0.15s',
        pointerEvents: 'auto',
        ...style,
      }}
    >
      {/* Input handles — visible colored dots on the left */}
      {inputs.map((port, i) => (
        <Handle
          key={port.id}
          id={port.id}
          type="target"
          position={Position.Left}
          title={port.label}
          style={{
            top: inputs.length === 1 ? '50%' : `${((i + 1) / (inputs.length + 1)) * 100}%`,
            width: 10, height: 10,
            background: 'var(--lsc-border)',
            border: '2px solid var(--lsc-node-bg)',
            borderRadius: '50%',
            cursor: 'crosshair',
          }}
        />
      ))}

      {/* Output handles — accent-colored dots on the right */}
      {outputs.map((port, i) => (
        <Handle
          key={port.id}
          id={port.id}
          type="source"
          position={Position.Right}
          title={port.label}
          style={{
            top: outputs.length === 1 ? '50%' : `${((i + 1) / (outputs.length + 1)) * 100}%`,
            width: 10, height: 10,
            background: accentColor ?? 'var(--lsc-accent)',
            border: '2px solid var(--lsc-node-bg)',
            borderRadius: '50%',
            cursor: 'crosshair',
          }}
        />
      ))}

      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid var(--lsc-border)' }}
      >
        <div className="flex items-center gap-2" style={{ color: 'var(--lsc-text)' }}>
          <span>{icon}</span>
          <span className="text-xs font-semibold" style={{ color: 'var(--lsc-text)' }}>{label}</span>
          {isBypassed && (
            <span
              className="text-[9px] font-bold tracking-wide uppercase px-1 rounded"
              style={{ background: 'var(--signal-hot)', color: '#fff', lineHeight: '1.4' }}
            >
              BYP
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isProtected && !isNoBypass && (
            <button
              className="nodrag nopan transition-colors rounded"
              title={isBypassed ? (t.nodeControls?.bypassed ?? 'Bypassed') : (t.nodeControls?.bypass ?? 'Bypass')}
              style={{
                color: isBypassed ? 'var(--signal-hot)' : 'var(--lsc-text)',
                padding: '1px 2px', cursor: 'pointer',
              }}
              onClick={() => toggleBypassNode(nodeId)}
            >
              <Power size={12} />
            </button>
          )}
          {!isProtected && (
            <button
              className="nodrag nopan transition-colors rounded"
              title={t.nodeControls?.remove ?? 'Remove'}
              style={{ color: 'var(--lsc-text)', padding: '1px 2px', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--signal-clipping)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--lsc-text)')}
              onClick={() => removeNode(nodeId)}
            >
              <X size={12} />
            </button>
          )}
          {hasTooltip && (
            <button
              className="nodrag nopan transition-colors"
              style={{ color: 'var(--lsc-text)', cursor: 'pointer' }}
              onClick={() => setActiveTooltip(activeTooltipId === nodeId ? null : nodeId)}
            >
              <HelpCircle size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Content — dimmed when bypassed */}
      <div className="p-3" style={{ opacity: isBypassed ? 0.5 : 1, transition: 'opacity 0.15s' }}>
        {children}
      </div>

      {hasTooltip && <TooltipPanel instanceId={nodeId} typeKey={typeKey} />}
    </div>
  )
}
