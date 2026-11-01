import { useTranslation } from '../i18n/useTranslation'

/** Bottom-centre status while a wire is being drawn. */
export function ConnectingToast({ sourceLabel }: { sourceLabel: string }) {
  const { t, fmt } = useTranslation()
  return (
    <div
      style={{
        position: 'absolute', left: 16, right: 16, bottom: 16, zIndex: 120,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}
    >
      <div
        role="status"
        style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, maxWidth: '100%',
          padding: '10px 14px', borderRadius: 10,
          background: 'var(--lsc-fg)', color: 'var(--lsc-header)',
          fontSize: 13, boxShadow: 'var(--lsc-shadow-popup)',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--lsc-accent)', flexShrink: 0 }} />
        <span>
          <strong>{fmt(t.connecting.from, { node: sourceLabel })}</strong> {t.connecting.hint}
        </span>
        <kbd style={{ opacity: 0.75, padding: '2px 6px' }}>Esc</kbd>
        <span style={{ opacity: 0.75 }}>{t.connecting.cancel}</span>
      </div>
    </div>
  )
}
