import { useState } from 'react'
import type { ReactNode } from 'react'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { TooltipPanel } from '../Tooltip'
import { HelpCircle, Power, X } from 'lucide-react'

const PROTECTED_NODES = new Set(['mic', 'speaker'])

interface NodeWrapperProps {
  nodeId: string
  icon: ReactNode
  label: string
  children?: ReactNode
  className?: string
}

export function NodeWrapper({ nodeId, icon, label, children, className = '' }: NodeWrapperProps) {
  const setActiveTooltip  = useSignalStore((s) => s.setActiveTooltip)
  const activeTooltipId   = useSignalStore((s) => s.activeTooltipId)
  const bypassedNodes     = useSignalStore((s) => s.bypassedNodes)
  const toggleBypassNode  = useSignalStore((s) => s.toggleBypassNode)
  const removeNode        = useSignalStore((s) => s.removeNode)
  const { t }             = useTranslation()

  const [hovered, setHovered] = useState(false)

  const isBypassed  = bypassedNodes.has(nodeId)
  const isProtected = PROTECTED_NODES.has(nodeId)
  const hasTooltip  = Boolean(t.theory[nodeId])
  const showControls = hovered && !isProtected

  return (
    <div
      className={`relative w-52 select-none ${className}`}
      style={{
        background: 'var(--lsc-node-bg)',
        border: `1px solid ${isBypassed ? 'var(--signal-hot)' : 'var(--lsc-border)'}`,
        borderRadius: 'var(--lsc-radius-lg)',
        boxShadow: activeTooltipId === nodeId
          ? '0 0 0 2px var(--lsc-accent)'
          : 'var(--lsc-shadow-node)',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
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

        {/* Action buttons — visible on hover for non-protected nodes */}
        <div className="flex items-center gap-1">
          {showControls && (
            <>
              <button
                className="nodrag transition-colors rounded"
                title={isBypassed ? t.nodeControls?.bypassed ?? 'Bypassed' : t.nodeControls?.bypass ?? 'Bypass'}
                style={{
                  color: isBypassed ? 'var(--signal-hot)' : 'var(--lsc-fg-fainter)',
                  padding: '1px 2px',
                }}
                onClick={() => toggleBypassNode(nodeId)}
              >
                <Power size={12} />
              </button>
              <button
                className="nodrag transition-colors rounded"
                title={t.nodeControls?.remove ?? 'Remove'}
                style={{ color: 'var(--lsc-fg-fainter)', padding: '1px 2px' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--signal-clipping)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--lsc-fg-fainter)')}
                onClick={() => removeNode(nodeId)}
              >
                <X size={12} />
              </button>
            </>
          )}
          {hasTooltip && (
            <button
              className="nodrag transition-colors"
              style={{ color: 'var(--lsc-fg-dim)' }}
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
      {hasTooltip && <TooltipPanel nodeId={nodeId} />}
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
    <div className={`nodrag space-y-1 ${className}`}>
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
        className="nodrag w-full h-1.5 appearance-none rounded-full cursor-pointer"
        style={{ accentColor: 'var(--signal-good)', background: 'var(--lsc-track)' }}
      />
    </div>
  )
}
