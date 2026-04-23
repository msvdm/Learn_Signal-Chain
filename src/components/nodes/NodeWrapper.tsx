import type { ReactNode } from 'react'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { levels } from '../../data/levels'
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
  const level = useSignalStore((s) => s.level)
  const setActiveTooltip = useSignalStore((s) => s.setActiveTooltip)
  const activeTooltipId = useSignalStore((s) => s.activeTooltipId)
  const levelConfig = levels[level]
  const { t } = useTranslation()

  const isInteractive = levelConfig.interactiveNodes.includes(nodeId)
  const hasTooltip = Boolean(t.theory[nodeId])

  return (
    <div
      className={`relative w-48 rounded-xl border bg-white shadow-sm select-none ${
        activeTooltipId === nodeId ? 'ring-2 ring-slate-400 ring-offset-1' : ''
      } ${className}`}
      style={{ borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
        <div className="flex items-center gap-2 text-slate-700">
          <span className="text-slate-400">{icon}</span>
          <span className="text-xs font-semibold">{label}</span>
        </div>
        {hasTooltip && (
          <button
            className="nodrag text-slate-300 hover:text-slate-500 transition-colors"
            onClick={() => setActiveTooltip(activeTooltipId === nodeId ? null : nodeId)}
          >
            <HelpCircle size={13} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className={`p-3 ${!isInteractive ? 'opacity-60 pointer-events-none' : ''}`}>
        {children}
      </div>

      {/* Locked overlay for Level 1 (all) or non-interactive nodes */}
      {!isInteractive && level !== 1 && (
        <div className="absolute inset-0 rounded-xl bg-slate-50/60" />
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
        <span className="text-[10px] text-slate-500">{label}</span>
        <span className="text-[10px] font-mono font-semibold text-slate-700">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="nodrag w-full h-1.5 appearance-none rounded-full bg-slate-200 cursor-pointer"
        style={{ accentColor: '#0f172a' }}
      />
    </div>
  )
}
