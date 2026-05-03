import type { ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Power, X, HelpCircle } from 'lucide-react'
import { NODE_REGISTRY } from '../../data/nodeRegistry'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { TooltipPanel } from '../Tooltip'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { getHealthStyle } from '../../hooks/useGainStaging'

const NO_BYPASS_TYPES = new Set(['mic', 'line-in', 'instrument', 'speaker', 'fader', 'switch', 'potentiometer', 'gain', 'relay', 'pan', 'adc', 'dac'])

interface InlineNodeProps {
  nodeId: string
  typeKey: string
  icon: ReactNode
  label: string
  accentColor?: string
  value?: string
  children?: ReactNode
  width?: number
}

export function InlineNode({
  nodeId,
  typeKey,
  icon,
  label,
  accentColor,
  value,
  children,
  width = 100,
}: InlineNodeProps) {
  const { stages }       = useGraphSignal()
  const setActiveTooltip = useSignalStore((s) => s.setActiveTooltip)
  const activeTooltipId  = useSignalStore((s) => s.activeTooltipId)
  const toggleBypassNode = useSignalStore((s) => s.toggleBypassNode)
  const removeNode       = useSignalStore((s) => s.removeNode)
  const { t }            = useTranslation()

  const isBypassed = useSignalStore((s) => s.nodes.find((n) => n.id === nodeId)?.bypassed ?? false)
  const isNoBypass = NO_BYPASS_TYPES.has(typeKey)
  const hasTooltip = Boolean(t.theory[typeKey])

  const def     = NODE_REGISTRY[typeKey]
  const inputs  = def?.inputs  ?? []
  const outputs = def?.outputs ?? []

  const health      = stages[nodeId]?.health ?? 'too-quiet'
  const healthStyle = getHealthStyle(health)

  const showBypass = isBypassed && !isNoBypass

  return (
    <div
      className="relative select-none cursor-default"
      style={{
        width,
        background: 'var(--lsc-node-bg)',
        border: showBypass
          ? '2px solid var(--signal-hot)'
          : `1px solid ${healthStyle.border}`,
        borderRadius: 'var(--lsc-radius-md)',
        boxShadow: activeTooltipId === nodeId
          ? '0 0 0 2px var(--lsc-accent)'
          : 'var(--lsc-shadow-node)',
        transition: 'border-color 0.15s',
        pointerEvents: 'auto',
      }}
    >
      {/* Input handles */}
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

      {/* Output handles */}
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

      {/* Action row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2, padding: '3px 4px 0' }}>
        {!isNoBypass && (
          <button
            className="nodrag nopan"
            title={isBypassed ? t.nodeControls.bypassed : t.nodeControls.bypass}
            style={{
              padding: '1px',
              color: isBypassed ? 'var(--signal-hot)' : 'var(--lsc-text)',
              cursor: 'pointer', background: 'none', border: 'none',
            }}
            onClick={() => toggleBypassNode(nodeId)}
          >
            <Power size={10} />
          </button>
        )}
        <button
          className="nodrag nopan"
          title={t.nodeControls.remove}
          style={{ padding: '1px', color: 'var(--lsc-text)', cursor: 'pointer', background: 'none', border: 'none' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--signal-clipping)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--lsc-text)')}
          onClick={() => removeNode(nodeId)}
        >
          <X size={10} />
        </button>
        {hasTooltip && (
          <button
            className="nodrag nopan"
            style={{ padding: '1px', color: 'var(--lsc-text)', cursor: 'pointer', background: 'none', border: 'none' }}
            onClick={() => setActiveTooltip(activeTooltipId === nodeId ? null : nodeId)}
          >
            <HelpCircle size={10} />
          </button>
        )}
      </div>

      {/* Icon + label body */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '2px 6px 8px',
          gap: 3,
          opacity: showBypass ? 0.55 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        <div style={{ color: accentColor ?? 'var(--lsc-accent)', lineHeight: 1 }}>
          {icon}
        </div>
        <span style={{
          fontSize: 'var(--node-text-md)', fontWeight: 600,
          color: 'var(--lsc-text)',
          textAlign: 'center', lineHeight: 1.2,
          maxWidth: '100%', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
        {showBypass && (
          <span style={{
            fontSize: 'var(--node-text-2xs)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            background: 'var(--signal-hot)', color: '#fff',
            borderRadius: 2, padding: '1px 3px', lineHeight: 1.4,
          }}>BYP</span>
        )}
        {value && !showBypass && (
          <span style={{
            fontSize: 'var(--node-text-xs)', fontFamily: 'var(--lsc-font-mono)',
            color: 'var(--lsc-text)', lineHeight: 1,
          }}>
            {value}
          </span>
        )}
        {children}
      </div>

      {hasTooltip && <TooltipPanel instanceId={nodeId} typeKey={typeKey} />}
    </div>
  )
}
