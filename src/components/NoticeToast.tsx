import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'

/** How long a notice stays: a problem stays longer, so there is time to read what to do. */
const SHOW_MS  = 4000
const ERROR_MS = 8000

/** Bottom-centre message after saving, copying a link or opening a file ("Link copied"). */
export function NoticeToast() {
  const notice      = useSignalStore((s) => s.notice)
  const clearNotice = useSignalStore((s) => s.clearNotice)
  const { t }       = useTranslation()

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(clearNotice, notice.error ? ERROR_MS : SHOW_MS)
    return () => clearTimeout(timer)
  }, [notice, clearNotice])

  if (!notice) return null
  return (
    <div
      style={{
        position: 'absolute', left: 16, right: 16, bottom: 16, zIndex: 130,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}
    >
      <div
        role={notice.error ? 'alert' : 'status'}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, maxWidth: 560,
          padding: '10px 10px 10px 14px', borderRadius: 10, pointerEvents: 'auto',
          background: 'var(--lsc-fg)', color: 'var(--lsc-header)',
          fontSize: 13, lineHeight: 1.4, boxShadow: 'var(--lsc-shadow-popup)',
        }}
      >
        <span
          style={{
            width: 8, height: 8, borderRadius: 9999, flexShrink: 0,
            background: notice.error ? 'var(--signal-clipping)' : 'var(--signal-good)',
          }}
        />
        <span style={{ flex: 1 }}>{notice.text}</span>
        <button
          onClick={clearNotice}
          title={t.tooltip.close}
          aria-label={t.tooltip.close}
          style={{
            display: 'flex', padding: 4, border: 'none', borderRadius: 6,
            background: 'transparent', color: 'inherit', opacity: 0.75, cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
