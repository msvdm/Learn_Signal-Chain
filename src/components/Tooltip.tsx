import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import { X } from 'lucide-react'

export function DrawerHelpContent() {
  const activeTooltipId = useSignalStore((s) => s.activeTooltipId)
  const activeTooltipTypeKey = useSignalStore((s) => s.activeTooltipTypeKey)
  const setActiveTooltip = useSignalStore((s) => s.setActiveTooltip)
  const { t } = useTranslation()

  if (activeTooltipId && activeTooltipTypeKey) {
    const entry = t.theory[activeTooltipTypeKey]
    const nodeLabel = t.nodes[activeTooltipTypeKey as keyof typeof t.nodes]?.label ?? activeTooltipTypeKey

    if (entry) {
      return (
        <div style={{ padding: '12px 16px', height: '100%', overflowY: 'auto' }}>
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 style={{ fontSize: 'var(--node-text-md)', fontWeight: 700, color: 'var(--lsc-text)', lineHeight: 1.2 }}>
              {nodeLabel}
            </h3>
            <button
              onClick={() => setActiveTooltip(null, null)}
              className="flex-shrink-0 transition-colors nodrag nopan"
              style={{ color: 'var(--lsc-text)', cursor: 'pointer', background: 'none', border: 'none', padding: 2 }}
              title="Close"
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--node-text-sm)', color: 'var(--lsc-text)' }}>
            <div>
              <span className="lsc-overline">{t.tooltip.whatIsThis}</span>
              <p style={{ marginTop: 2, lineHeight: 1.55, fontSize: 'var(--node-text-xs)' }}>{entry.what}</p>
            </div>
            <div>
              <span className="lsc-overline">{t.tooltip.whyIsItHere}</span>
              <p style={{ marginTop: 2, lineHeight: 1.55, fontSize: 'var(--node-text-xs)' }}>{entry.why}</p>
            </div>
            <div
              style={{
                borderRadius: 'var(--lsc-radius-md)',
                background: 'var(--lsc-tip-bg)',
                border: '1px solid var(--lsc-tip-bd)',
                padding: '8px 10px',
              }}
            >
              <span style={{ fontSize: 'var(--node-text-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--lsc-tip)' }}>
                {t.tooltip.proTip}
              </span>
              <p style={{ marginTop: 3, lineHeight: 1.55, fontSize: 'var(--node-text-xs)', color: 'var(--lsc-tip-fg)' }}>
                {entry.tip}
              </p>
            </div>
          </div>
        </div>
      )
    }
  }

  const tips = [t.drawer.tip1, t.drawer.tip2, t.drawer.tip3, t.drawer.tip4, t.drawer.tip5]

  return (
    <div style={{ padding: '10px 16px 12px', height: '100%', overflowY: 'auto' }}>
      <p style={{
        fontSize: 'var(--node-text-sm)',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--lsc-text)',
        marginBottom: 8,
        opacity: 0.5,
      }}>
        {t.drawer.defaultTitle}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {tips.map((tip, i) => (
          <div
            key={i}
            style={{
              background: 'var(--lsc-sunken)',
              border: '1px solid var(--lsc-border)',
              borderRadius: 'var(--lsc-radius-md)',
              padding: '8px 10px',
            }}
          >
            <p style={{ fontWeight: 600, fontSize: 'var(--node-text-sm)', color: 'var(--lsc-text)', marginBottom: 3 }}>
              {tip.title}
            </p>
            <p style={{ fontSize: 'var(--node-text-xs)', color: 'var(--lsc-text)', lineHeight: 1.5, opacity: 0.75 }}>
              {tip.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
