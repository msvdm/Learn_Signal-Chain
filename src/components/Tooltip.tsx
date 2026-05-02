import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import { X } from 'lucide-react'

interface TooltipProps {
  instanceId: string  // the node's unique instance ID — used to match against the store
  typeKey: string     // the node type — used to look up theory content
}

export function TooltipPanel({ instanceId, typeKey }: TooltipProps) {
  const activeTooltipId = useSignalStore((s) => s.activeTooltipId)
  const setActiveTooltip = useSignalStore((s) => s.setActiveTooltip)
  const { t } = useTranslation()

  if (activeTooltipId !== instanceId) return null

  const entry = t.theory[typeKey]
  if (!entry) return null

  const nodeLabel = t.nodes[typeKey as keyof typeof t.nodes]?.label ?? typeKey

  return (
    <div
      className="absolute bottom-full left-1/2 mb-3 w-72 -translate-x-1/2 z-50"
      style={{
        background: 'var(--lsc-node-bg)',
        border: '1px solid var(--lsc-border)',
        borderRadius: 'var(--lsc-radius-lg)',
        padding: 14,
        boxShadow: 'var(--lsc-shadow-tooltip)',
      }}
    >
      {/* Arrow */}
      <div
        className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent"
        style={{ borderTopColor: 'var(--lsc-border)', marginTop: -1 }}
      />
      <div
        className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent"
        style={{ borderTopColor: 'var(--lsc-node-bg)', marginTop: -2 }}
      />

      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold leading-tight" style={{ color: 'var(--lsc-text)' }}>
          {nodeLabel}
        </h3>
        <button
          onClick={() => setActiveTooltip(null)}
          className="flex-shrink-0 transition-colors"
          style={{ color: 'var(--lsc-text)' }}
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-2 text-xs" style={{ color: 'var(--lsc-text)' }}>
        <div>
          <span className="lsc-overline">{t.tooltip.whatIsThis}</span>
          <p className="mt-0.5 leading-relaxed" style={{ fontSize: 11 }}>{entry.what}</p>
        </div>
        <div>
          <span className="lsc-overline">{t.tooltip.whyIsItHere}</span>
          <p className="mt-0.5 leading-relaxed" style={{ fontSize: 11 }}>{entry.why}</p>
        </div>
        <div
          style={{
            borderRadius: 'var(--lsc-radius-md)',
            background: 'var(--lsc-tip-bg)',
            border: '1px solid var(--lsc-tip-bd)',
            padding: 8,
          }}
        >
          <span
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--lsc-tip)' }}
          >
            {t.tooltip.proTip}
          </span>
          <p className="mt-0.5 leading-relaxed" style={{ fontSize: 11, color: 'var(--lsc-tip-fg)' }}>
            {entry.tip}
          </p>
        </div>
      </div>
    </div>
  )
}
