import { useState } from 'react'
import type { ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Power, X, HelpCircle } from 'lucide-react'
import { NODE_REGISTRY } from '../../data/nodeRegistry'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { getHealthStyle } from '../../hooks/useGainStaging'

const NO_BYPASS_TYPES = new Set(['mic', 'line-in', 'instrument', 'speaker', 'fader', 'switch', 'potentiometer', 'gain', 'relay', 'pan', 'adc', 'dac', 'pad'])

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
  const removeEdge       = useSignalStore((s) => s.removeEdge)
  const toolMode         = useSignalStore((s) => s.toolMode)
  const graphEdges       = useSignalStore((s) => s.edges)
  const { t }            = useTranslation()

  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null)

  const isBypassed = useSignalStore((s) => s.nodes.find((n) => n.id === nodeId)?.bypassed ?? false)
  const isNoBypass = NO_BYPASS_TYPES.has(typeKey)
  const hasTooltip = Boolean(t.theory[typeKey])

  const def     = NODE_REGISTRY[typeKey]
  const inputs  = def?.inputs  ?? []
  const outputs = def?.outputs ?? []

  const health      = stages[nodeId]?.health ?? 'too-quiet'
  const healthStyle = getHealthStyle(health)

  const showBypass = isBypassed && !isNoBypass

  function edgesOnHandle(portId: string, type: 'source' | 'target') {
    return type === 'source'
      ? graphEdges.filter((e) => e.source === nodeId && e.sourceHandle === portId)
      : graphEdges.filter((e) => e.target === nodeId && e.targetHandle === portId)
  }

  function HandleDeleteBtn({
    portId,
    handleType,
    topPct,
    side,
  }: { portId: string; handleType: 'source' | 'target'; topPct: string; side: 'left' | 'right' }) {
    if (toolMode !== 'select') return null
    if (hoveredHandle !== portId) return null
    const connected = edgesOnHandle(portId, handleType)
    if (connected.length === 0) return null
    return (
      <button
        className="nodrag nopan lsc-handle-delete"
        style={{
          position: 'absolute',
          top: topPct,
          [side]: -22,
          transform: 'translateY(-50%)',
        }}
        title="Remove connection"
        onClick={() => connected.forEach((e) => removeEdge(e.id))}
      >
        ×
      </button>
    )
  }

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
      {inputs.map((port, i) => {
        const topPct = inputs.length === 1 ? '50%' : `${((i + 1) / (inputs.length + 1)) * 100}%`
        return (
          <span key={port.id}>
            <Handle
              id={port.id}
              type="target"
              position={Position.Left}
              title={port.label}
              style={{
                top: topPct,
                width: 10, height: 10,
                background: 'var(--lsc-border)',
                border: '2px solid var(--lsc-node-bg)',
                borderRadius: '50%',
                cursor: 'crosshair',
              }}
              onMouseEnter={() => setHoveredHandle(port.id)}
              onMouseLeave={() => setHoveredHandle(null)}
            />
            <HandleDeleteBtn portId={port.id} handleType="target" topPct={topPct} side="left" />
          </span>
        )
      })}

      {/* Output handles */}
      {outputs.map((port, i) => {
        const topPct = outputs.length === 1 ? '50%' : `${((i + 1) / (outputs.length + 1)) * 100}%`
        return (
          <span key={port.id}>
            <Handle
              id={port.id}
              type="source"
              position={Position.Right}
              title={port.label}
              style={{
                top: topPct,
                width: 10, height: 10,
                background: accentColor ?? 'var(--lsc-accent)',
                border: '2px solid var(--lsc-node-bg)',
                borderRadius: '50%',
                cursor: 'crosshair',
              }}
              onMouseEnter={() => setHoveredHandle(port.id)}
              onMouseLeave={() => setHoveredHandle(null)}
            />
            <HandleDeleteBtn portId={port.id} handleType="source" topPct={topPct} side="right" />
          </span>
        )
      })}

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
            onClick={() => setActiveTooltip(activeTooltipId === nodeId ? null : nodeId, activeTooltipId === nodeId ? null : typeKey)}
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

    </div>
  )
}
