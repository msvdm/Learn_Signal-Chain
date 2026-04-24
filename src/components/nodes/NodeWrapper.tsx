import type { ReactNode } from 'react'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { TooltipPanel } from '../Tooltip'
import { HelpCircle } from 'lucide-react'

interface NodeWrapperProps {
  nodeId: string
  icon: ReactNode
  label: string
  children?: ReactNode
  className?: string
}

export function NodeWrapper({ nodeId, icon, label, children, className = '' }: NodeWrapperProps) {
  const setActiveTooltip = useSignalStore((s) => s.setActiveTooltip)
  const activeTooltipId = useSignalStore((s) => s.activeTooltipId)
  const { t } = useTranslation()

  const hasTooltip = Boolean(t.theory[nodeId])

  return (
    <div
      className={`relative w-52 select-none ${className}`}
      style={{
        background: 'var(--lsc-node-bg)',
        border: '1px solid var(--lsc-border)',
        borderRadius: 'var(--lsc-radius-lg)',
        boxShadow: activeTooltipId === nodeId
          ? '0 0 0 2px var(--lsc-accent)'
          : 'var(--lsc-shadow-node)',
      }}
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
        </div>
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

      {/* Content */}
      <div className="p-3">
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
