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
  const unlockedNodes = useSignalStore((s) => s.unlockedNodes)
  const { t } = useTranslation()

  const isInteractive = unlockedNodes.includes(nodeId)
  const hasTooltip = Boolean(t.theory[nodeId])

  return (
    <div
      className={`relative w-52 rounded-xl border select-none ${
        activeTooltipId === nodeId ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
      } ${className}`}
      style={{
        background: 'var(--node-bg)',
        borderColor: 'var(--node-border)',
        boxShadow: 'var(--node-shadow)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--node-border)' }}
      >
        <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <span>{icon}</span>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {label}
          </span>
        </div>
        {hasTooltip && (
          <button
            className="nodrag transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => setActiveTooltip(activeTooltipId === nodeId ? null : nodeId)}
          >
            <HelpCircle size={13} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className={`p-3 ${!isInteractive ? 'opacity-40 pointer-events-none' : ''}`}>
        {children}
      </div>

      {/* Locked overlay for non-interactive nodes */}
      {!isInteractive && (
        <div className="absolute inset-0 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="flex h-full items-center justify-center">
            <span className="text-[10px] font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>
              LOCKED
            </span>
          </div>
        </div>
      )}

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
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="text-[10px] font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
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
        style={{ accentColor: '#4ade80', background: '#2e3341' }}
      />
    </div>
  )
}
