import { ViewportPortal } from '@xyflow/react'
import { useTranslation } from '../i18n/useTranslation'
import type { EmptyStateLayout } from '../utils/emptyStateLayout'

/**
 * Ghost outline shown on an empty canvas — rendered in flow space so it lines up
 * with the fixed Master Bus and zooms with the canvas. Purely visual: it never
 * catches the pointer, so drops land on the canvas underneath.
 */
export function EmptyStateGuide({ layout }: { layout: EmptyStateLayout }) {
  const { t, fmt } = useTranslation()
  const copy = {
    source: { title: t.emptyState.source, hint: t.emptyState.sourceHint },
    preamp: { title: t.emptyState.preamp, hint: t.emptyState.preampHint },
    output: { title: t.emptyState.output, hint: t.emptyState.outputHint },
  }
  const { headline } = layout

  return (
    <ViewportPortal>
      <div style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
        {/* Connector lines */}
        {layout.lines.map((l, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', left: l.x1, top: l.y - 1.5,
              width: l.x2 - l.x1, height: 3, background: 'var(--lsc-border)',
            }}
          />
        ))}

        {/* Headline */}
        <div
          style={{
            position: 'absolute', left: headline.x, top: headline.y,
            width: headline.w, height: headline.h,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
            gap: 10, textAlign: 'center', color: 'var(--lsc-fg)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {t.emptyState.title}
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, maxWidth: 480, color: 'var(--lsc-fg-muted)', textWrap: 'pretty' }}>
            {t.emptyState.body}
          </p>
        </div>

        {/* Ghost slots */}
        {layout.slots.map(({ kind, step, rect }) => {
          const first = step === 1
          return (
            <div
              key={kind}
              style={{
                position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h,
                borderRadius: 12, padding: 14,
                display: 'flex', flexDirection: 'column', gap: 6,
                background: first ? 'var(--lsc-accent-bg)' : 'var(--lsc-sunken)',
                border: `1px solid ${first ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lsc-fg-muted)', textTransform: 'uppercase' }}>
                {fmt(t.emptyState.step, { n: String(step) })}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: first ? 'var(--lsc-fg)' : 'var(--lsc-fg-muted)' }}>
                {copy[kind].title}
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--lsc-fg-muted)' }}>
                {copy[kind].hint}
              </span>
            </div>
          )
        })}
      </div>
    </ViewportPortal>
  )
}

/** Keyboard shortcuts card — bottom-right of the canvas while it is empty. */
export function ShortcutsCard() {
  const { t } = useTranslation()
  const rows: [string, string][] = [
    [t.emptyState.moveSelect, 'V'],
    [t.emptyState.drawWire, 'C'],
    [t.emptyState.cancel, 'Esc'],
  ]
  return (
    <div
      className="lsc-overlay"
      style={{
        position: 'absolute', right: 14, bottom: 14, zIndex: 120, width: 260,
        padding: '12px 14px', borderRadius: 12,
        background: 'var(--lsc-header)', border: '1px solid var(--lsc-border)',
        boxShadow: 'var(--lsc-shadow-popup)',
        display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--lsc-fg)',
      }}
    >
      <span className="lsc-overline">{t.emptyState.shortcuts}</span>
      {rows.map(([label, key]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{label}</span>
          <kbd style={{ borderColor: 'var(--lsc-border)', padding: '1px 6px' }}>{key}</kbd>
        </div>
      ))}
    </div>
  )
}
