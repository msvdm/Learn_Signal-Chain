import type { CSSProperties, ReactNode } from 'react'
import { useReactFlow, useViewport } from '@xyflow/react'
import { MousePointer2, Cable, Grid3x3, Minus, Plus } from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import type { ToolMode } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'

const divider: CSSProperties = { width: 1, height: 22, background: 'var(--lsc-border)', margin: '0 4px', flexShrink: 0 }

const zoomBtn: CSSProperties = {
  width: 30, height: 34, border: 'none', background: 'transparent', borderRadius: 7,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--lsc-fg-muted)', cursor: 'pointer',
}

function ModeButton({ mode, icon, label, shortcut, hint }: {
  mode: ToolMode; icon: ReactNode; label: string; shortcut: string; hint: string
}) {
  const toolMode    = useSignalStore((s) => s.toolMode)
  const setToolMode = useSignalStore((s) => s.setToolMode)
  const active = toolMode === mode
  return (
    <button
      onClick={() => setToolMode(mode)}
      title={hint}
      aria-pressed={active}
      style={{
        height: 34, padding: '0 10px', borderRadius: 7, border: 'none',
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
        background: active ? 'var(--lsc-accent)' : 'transparent',
        color: active ? '#fff' : 'var(--lsc-fg)',
      }}
    >
      {icon}
      {label}
      <kbd style={{ opacity: 0.8 }}>{shortcut}</kbd>
    </button>
  )
}

/** Floating toolbar, top-centre of the canvas: Move / Connect, Snap to grid, zoom. */
export function CanvasToolbar() {
  const snapToGrid    = useSignalStore((s) => s.snapToGrid)
  const setSnapToGrid = useSignalStore((s) => s.setSnapToGrid)
  const { zoomIn, zoomOut, zoomTo } = useReactFlow()
  const { zoom } = useViewport()
  const { t } = useTranslation()

  return (
    <div
      className="lsc-overlay"
      style={{
        position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 120,
        display: 'flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 10,
        background: 'var(--lsc-header)', border: '1px solid var(--lsc-border)',
        boxShadow: 'var(--lsc-shadow-popup)', color: 'var(--lsc-fg)',
      }}
    >
      <ModeButton mode="select"  icon={<MousePointer2 size={15} />} label={t.toolbar.move}    shortcut="V" hint={t.toolbar.moveHint} />
      <ModeButton mode="connect" icon={<Cable size={15} />}         label={t.toolbar.connect} shortcut="C" hint={t.toolbar.connectHint} />

      <span style={divider} />

      <button
        role="switch"
        aria-checked={snapToGrid}
        onClick={() => setSnapToGrid(!snapToGrid)}
        title={t.toolbar.snapHint}
        style={{
          height: 34, padding: '0 10px', borderRadius: 7, border: 'none', background: 'transparent',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 600, color: 'var(--lsc-fg)', cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <Grid3x3 size={15} />
        {t.toolbar.snap}
        <span
          style={{
            position: 'relative', width: 30, height: 18, borderRadius: 9999, flexShrink: 0,
            background: snapToGrid ? 'var(--lsc-accent)' : 'var(--lsc-sunken)',
            border: `1px solid ${snapToGrid ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
            transition: 'background 0.15s',
          }}
        >
          <span
            style={{
              position: 'absolute', top: 2, left: snapToGrid ? 15 : 2,
              width: 12, height: 12, borderRadius: 9999,
              background: snapToGrid ? '#fff' : 'var(--lsc-fg-muted)',
              transition: 'left 0.15s',
            }}
          />
        </span>
      </button>

      <span style={divider} />

      <button onClick={() => zoomOut({ duration: 150 })} title={t.toolbar.zoomOut} aria-label={t.toolbar.zoomOut} style={zoomBtn}>
        <Minus size={16} />
      </button>
      <button
        onClick={() => zoomTo(1, { duration: 150 })}
        title={t.toolbar.zoomReset}
        style={{
          ...zoomBtn, width: 'auto', minWidth: 46, padding: '0 4px',
          fontFamily: 'var(--lsc-font-mono)', fontSize: 12, color: 'var(--lsc-fg)',
        }}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button onClick={() => zoomIn({ duration: 150 })} title={t.toolbar.zoomIn} aria-label={t.toolbar.zoomIn} style={zoomBtn}>
        <Plus size={16} />
      </button>
    </div>
  )
}

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
