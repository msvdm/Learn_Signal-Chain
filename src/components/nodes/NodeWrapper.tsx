import type { ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useSignalStore, MASTER_PROTECTED } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { TooltipPanel } from '../Tooltip'
import { HelpCircle, Power, X } from 'lucide-react'

const HANDLE_STYLE = { visibility: 'hidden' as const }

import type { CSSProperties } from 'react'

interface NodeWrapperProps {
  nodeId: string
  channelId: string
  typeKey?: string
  icon: ReactNode
  label: string
  accentColor?: string
  children?: ReactNode
  className?: string
  style?: CSSProperties
  hasTarget?: boolean
  hasSource?: boolean
}

export function NodeWrapper({
  nodeId,
  channelId,
  typeKey,
  icon,
  label,
  accentColor,
  children,
  className = '',
  style,
  hasTarget = true,
  hasSource = true,
}: NodeWrapperProps) {
  const setActiveTooltip         = useSignalStore((s) => s.setActiveTooltip)
  const activeTooltipId          = useSignalStore((s) => s.activeTooltipId)
  const toggleBypassChannelNode  = useSignalStore((s) => s.toggleBypassChannelNode)
  const removeChannelNode        = useSignalStore((s) => s.removeChannelNode)
  const removeMasterNode         = useSignalStore((s) => s.removeMasterNode)
  const { t }                    = useTranslation()

  // Determine bypass state
  const channel = useSignalStore((s) => s.channels.find((c) => c.id === channelId))
  const effectiveTypeKey = typeKey ?? ''
  const isBypassed = channel ? channel.bypassedNodes.has(effectiveTypeKey) : false

  const isMasterSection = channelId === 'master'
  const isMasterNode = MASTER_PROTECTED.has(nodeId)
  const isSourceNode = effectiveTypeKey === 'source'
  const isProtected  = isMasterNode || isSourceNode

  const hasTooltip = Boolean(t.theory[typeKey ?? nodeId])

  return (
    <div
      className={`relative w-52 select-none cursor-default ${className}`}
      style={{
        background: 'var(--lsc-node-bg)',
        border: `1px solid ${isBypassed ? 'var(--signal-hot)' : 'var(--lsc-border)'}`,
        borderLeft: accentColor
          ? `3px solid ${isBypassed ? 'var(--signal-hot)' : accentColor}`
          : `1px solid ${isBypassed ? 'var(--signal-hot)' : 'var(--lsc-border)'}`,
        borderRadius: 'var(--lsc-radius-lg)',
        boxShadow: activeTooltipId === nodeId
          ? '0 0 0 2px var(--lsc-accent)'
          : 'var(--lsc-shadow-node)',
        transition: 'border-color 0.15s',
        pointerEvents: 'auto',
        ...style,
      }}
    >
      {hasTarget && <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />}
      {hasSource && <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />}
      {/* Send-tap handle: bottom-center, used by send edges so they branch off the chain below the card */}
      {hasSource && channelId !== 'master' && (
        <Handle id="send-tap" type="source" position={Position.Bottom} style={HANDLE_STYLE} />
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid var(--lsc-border)' }}
      >
        <div className="flex items-center gap-2" style={{ color: 'var(--lsc-fg-dim)' }}>
          <span>{icon}</span>
          <span className="text-xs font-semibold" style={{ color: 'var(--lsc-fg)' }}>
            {label}
          </span>
          {isBypassed && (
            <span
              className="text-[9px] font-bold tracking-wide uppercase px-1 rounded"
              style={{ background: 'var(--signal-hot)', color: '#fff', lineHeight: '1.4' }}
            >
              BYP
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {!isProtected && (
            <>
              {!isMasterSection && (
                <button
                  className="nodrag nopan transition-colors rounded"
                  title={isBypassed ? (t.nodeControls?.bypassed ?? 'Bypassed') : (t.nodeControls?.bypass ?? 'Bypass')}
                  style={{
                    color: isBypassed ? 'var(--signal-hot)' : 'var(--lsc-fg-fainter)',
                    padding: '1px 2px',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleBypassChannelNode(channelId, effectiveTypeKey)}
                >
                  <Power size={12} />
                </button>
              )}
              <button
                className="nodrag nopan transition-colors rounded"
                title={t.nodeControls?.remove ?? 'Remove'}
                style={{ color: 'var(--lsc-fg-fainter)', padding: '1px 2px', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--signal-clipping)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--lsc-fg-fainter)')}
                onClick={() => {
                  if (isMasterSection) removeMasterNode(nodeId)
                  else removeChannelNode(channelId, effectiveTypeKey)
                }}
              >
                <X size={12} />
              </button>
            </>
          )}
          {hasTooltip && (
            <button
              className="nodrag nopan transition-colors"
              style={{ color: 'var(--lsc-fg-dim)', cursor: 'pointer' }}
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

      {/* Tooltip */}
      {hasTooltip && <TooltipPanel nodeId={typeKey ?? nodeId} />}
    </div>
  )
}

interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  label: string
  formatValue?: (v: number) => string
  onChange: (v: number) => void
  className?: string
}

export function ControlSlider({
  value,
  min,
  max,
  step = 1,
  label,
  formatValue,
  onChange,
  className = '',
}: SliderProps) {
  const display = formatValue ? formatValue(value) : String(value)
  return (
    <div className={`nodrag nopan space-y-1 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px]" style={{ color: 'var(--lsc-fg-dim)' }}>{label}</span>
        <span className="text-[10px] font-mono font-semibold" style={{ color: 'var(--lsc-fg)' }}>
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="nodrag nopan w-full h-1.5 appearance-none rounded-full cursor-pointer"
        style={{ accentColor: 'var(--signal-good)', background: 'var(--lsc-track)' }}
      />
    </div>
  )
}
