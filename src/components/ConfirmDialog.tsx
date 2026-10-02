import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmDialogProps {
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/** In-app replacement for window.confirm. Enter confirms, Escape / backdrop cancels. */
export function ConfirmDialog({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }
    }
    // Capture so the canvas Escape handler doesn't also fire
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lsc-dialog-title"
        aria-describedby="lsc-dialog-body"
        style={{
          width: 400, maxWidth: '100%', borderRadius: 12,
          background: 'var(--lsc-header)', border: '1px solid var(--lsc-border)',
          boxShadow: 'var(--lsc-shadow-popup)', color: 'var(--lsc-fg)',
        }}
      >
        <div style={{ padding: '16px 16px 4px' }}>
          <h2 id="lsc-dialog-title" style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h2>
          <p id="lsc-dialog-body" style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--lsc-fg-muted)' }}>
            {body}
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16 }}>
          <button
            onClick={onCancel}
            className="lsc-btn-outline"
            style={{
              height: 34, padding: '0 12px', borderRadius: 8,
              border: '1px solid var(--lsc-border)', background: 'transparent',
              color: 'var(--lsc-fg)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            style={{
              height: 34, padding: '0 14px', borderRadius: 8, border: 'none',
              background: 'var(--lsc-accent)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
