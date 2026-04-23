import { useSignalChain } from '../hooks/useSignalChain'
import { getHealthStyle } from '../hooks/useGainStaging'
import { useTranslation } from '../i18n/useTranslation'
import { AlertTriangle, CheckCircle, Info } from 'lucide-react'

export function GainStagingBanner() {
  const { overallHealth, warnings } = useSignalChain()
  const style = getHealthStyle(overallHealth)
  const { t } = useTranslation()

  const icon =
    overallHealth === 'good' ? (
      <CheckCircle size={14} className="text-green-600" />
    ) : overallHealth === 'clipping' ? (
      <AlertTriangle size={14} className="text-red-500" />
    ) : (
      <Info size={14} style={{ color: style.color }} />
    )

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-xs border-b"
      style={{ backgroundColor: style.bg, borderColor: style.border }}
    >
      {icon}
      <span className="font-semibold" style={{ color: style.color }}>
        {t.banner.gainStaging}: {t.health[overallHealth]}
      </span>
      {warnings.length > 0 && (
        <span className="text-slate-600 truncate">{warnings[0]}</span>
      )}
    </div>
  )
}
