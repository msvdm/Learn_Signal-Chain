import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import { levels } from '../data/levels'
import { ChevronRight, X } from 'lucide-react'

interface TooltipProps {
  nodeId: string
}

export function TooltipPanel({ nodeId }: TooltipProps) {
  const activeTooltipId = useSignalStore((s) => s.activeTooltipId)
  const level = useSignalStore((s) => s.level)
  const advanceTour = useSignalStore((s) => s.advanceTour)
  const setActiveTooltip = useSignalStore((s) => s.setActiveTooltip)
  const tourIndex = useSignalStore((s) => s.tourIndex)
  const { t } = useTranslation()

  if (activeTooltipId !== nodeId) return null

  const entry = t.theory[nodeId]
  if (!entry) return null

  const levelConfig = levels[level]
  const isLastInTour = levelConfig.guidedTour && tourIndex >= levelConfig.tourSequence.length - 1
  const nodeLabel = t.nodes[nodeId as keyof typeof t.nodes]?.label ?? nodeId

  return (
    <div
      className="absolute bottom-full left-1/2 mb-3 w-72 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-4 shadow-lg z-50"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
    >
      {/* Arrow */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white" style={{ marginTop: -1 }} />
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-200" style={{ zIndex: -1 }} />

      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-900 leading-tight">{nodeLabel}</h3>
        {!levelConfig.guidedTour && (
          <button
            onClick={() => setActiveTooltip(null)}
            className="text-slate-400 hover:text-slate-600 flex-shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="space-y-2 text-xs text-slate-700">
        <div>
          <span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">{t.tooltip.whatIsThis}</span>
          <p className="mt-0.5 leading-relaxed">{entry.what}</p>
        </div>
        <div>
          <span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">{t.tooltip.whyIsItHere}</span>
          <p className="mt-0.5 leading-relaxed">{entry.why}</p>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-100 p-2">
          <span className="font-semibold text-amber-700 uppercase tracking-wide text-[10px]">{t.tooltip.proTip}</span>
          <p className="mt-0.5 leading-relaxed text-amber-800">{entry.tip}</p>
        </div>
      </div>

      {levelConfig.guidedTour && (
        <button
          onClick={advanceTour}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          {isLastInTour ? t.tooltip.finishTour : t.tooltip.next}
          <ChevronRight size={12} />
        </button>
      )}
    </div>
  )
}
