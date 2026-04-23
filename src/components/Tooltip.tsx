import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import { X } from 'lucide-react'

interface TooltipProps {
  nodeId: string
}

export function TooltipPanel({ nodeId }: TooltipProps) {
  const activeTooltipId = useSignalStore((s) => s.activeTooltipId)
  const setActiveTooltip = useSignalStore((s) => s.setActiveTooltip)
  const { t } = useTranslation()

  if (activeTooltipId !== nodeId) return null

  const entry = t.theory[nodeId]
  if (!entry) return null

  const nodeLabel = t.nodes[nodeId as keyof typeof t.nodes]?.label ?? nodeId

  return (
    <div
      className="absolute bottom-full left-1/2 mb-3 w-72 -translate-x-1/2 rounded-xl border p-4 shadow-lg z-50"
      style={{
        background: 'var(--node-bg)',
        borderColor: 'var(--node-border)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* Arrow */}
      <div
        className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent"
        style={{ borderTopColor: 'var(--node-bg)', marginTop: -1 }}
      />

      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
          {nodeLabel}
        </h3>
        <button
          onClick={() => setActiveTooltip(null)}
          className="flex-shrink-0 transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-2 text-xs" style={{ color: 'var(--text-primary)' }}>
        <div>
          <span className="font-semibold uppercase tracking-wide text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {t.tooltip.whatIsThis}
          </span>
          <p className="mt-0.5 leading-relaxed">{entry.what}</p>
        </div>
        <div>
          <span className="font-semibold uppercase tracking-wide text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {t.tooltip.whyIsItHere}
          </span>
          <p className="mt-0.5 leading-relaxed">{entry.why}</p>
        </div>
        <div className="rounded-lg p-2" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <span className="font-semibold uppercase tracking-wide text-[10px] text-amber-400">
            {t.tooltip.proTip}
          </span>
          <p className="mt-0.5 leading-relaxed text-amber-300">{entry.tip}</p>
        </div>
      </div>
    </div>
  )
}
