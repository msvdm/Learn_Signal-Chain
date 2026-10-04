import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import type { SignalEdge } from '../data/nodeRegistry'
import { useTranslation } from '../i18n/useTranslation'
import { useGraphSignal } from '../hooks/useGraphSignal'
import { chainSourcesOfEdge } from '../utils/chainColors'
import { nodeName, sideLetter } from '../utils/nodeName'

interface UnplugMenuProps {
  /** Wires plugged into the port */
  wires: SignalEdge[]
  /** Screen rectangle of the port the list opens next to */
  anchor: DOMRect
  onClose: () => void
}

/**
 * List of the wires on a bus input that holds several of them.
 * Pointing at a wire lights up its whole chain (everything else is dimmed);
 * × unplugs just that wire.
 * Rendered in document.body — React Flow's transform breaks position: fixed inside the canvas.
 */
export function UnplugMenu({ wires, anchor, onClose }: UnplugMenuProps) {
  const nodes           = useSignalStore((s) => s.nodes)
  const edges           = useSignalStore((s) => s.edges)
  const removeEdge      = useSignalStore((s) => s.removeEdge)
  const setHighlight    = useSignalStore((s) => s.setHighlightEdges)
  const { t, fmt }      = useTranslation()
  const { stages, wires: signals } = useGraphSignal()
  const ref             = useRef<HTMLDivElement>(null)

  // The parent passes a new onClose each render — keep the latest without re-subscribing
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  // Close on a click outside or Escape; clear the highlight when the list goes away
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
      setHighlight([])
    }
  }, [setHighlight])

  // Nothing left to choose from — close
  useEffect(() => {
    if (wires.length === 0) onCloseRef.current()
  }, [wires.length])

  // Open to the left of the input port so the card itself stays visible
  const WIDTH = 280
  const left  = Math.max(8, anchor.left - WIDTH - 12)
  const top   = Math.max(8, Math.min(anchor.top - 16, window.innerHeight - 80 - wires.length * 48))

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{
        position: 'fixed', zIndex: 1000,
        top, left, width: WIDTH,
        background: 'var(--lsc-node-bg)', color: 'var(--lsc-fg)',
        border: '1px solid var(--lsc-border)', borderRadius: 'var(--lsc-radius-lg)',
        boxShadow: 'var(--lsc-shadow-node)',
        padding: 6, fontSize: 13,
      }}
      onMouseLeave={() => setHighlight([])}
    >
      <div style={{ padding: '4px 8px 2px', fontWeight: 700 }}>{t.unplugMenu.title}</div>
      <div style={{ padding: '0 8px 6px', fontSize: 12, color: 'var(--lsc-fg-muted)' }}>{t.unplugMenu.hint}</div>

      {wires.map((wire) => {
        const from    = nodes.find((n) => n.id === wire.source)
        const sources = chainSourcesOfEdge(wire, nodes, edges)
        const start   = sources[0]
        const named   = start ?? from
        const name    = nodeName(t, named, named && stages[named.id])
        const via     = start && from && start.id !== from.id
          ? fmt(t.unplugMenu.via, { node: nodeName(t, from, stages[from.id]) })
          : null
        const side    = sideLetter(signals.get(`${wire.source}:${wire.sourceHandle}`)?.kind)
        return (
          <div
            key={wire.id}
            role="menuitem"
            onMouseEnter={() => setHighlight([wire.id])}
            className="lsc-unplug-row"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px', borderRadius: 'var(--lsc-radius-sm)',
            }}
          >
            {/* Chain colours of the sources feeding this wire */}
            <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              {(sources.length > 0 ? sources : [undefined]).map((s, i) => (
                <span
                  key={s?.id ?? i}
                  style={{ width: 10, height: 10, borderRadius: 9999, background: s?.color ?? 'var(--lsc-border)' }}
                />
              ))}
            </span>
            <span style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
              <span style={{ fontWeight: 600 }}>{name}</span>
              {side && <span style={{ color: 'var(--lsc-fg-muted)', fontWeight: 700 }}> · {side}</span>}
              {via && <span style={{ display: 'block', fontSize: 12, color: 'var(--lsc-fg-muted)' }}>{via}</span>}
            </span>
            <button
              title={t.unplugMenu.unplugOne}
              onClick={() => removeEdge(wire.id)}
              className="lsc-node-btn lsc-node-btn-remove"
              style={{
                width: 22, height: 22, flexShrink: 0, borderRadius: 9999, padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--lsc-border)', background: 'transparent',
                color: 'var(--lsc-fg-muted)', cursor: 'pointer',
              }}
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
        )
      })}

      <button
        onClick={() => { wires.forEach((w) => removeEdge(w.id)); onClose() }}
        style={{
          width: '100%', marginTop: 4, padding: '6px 8px',
          borderRadius: 'var(--lsc-radius-sm)', border: '1px solid var(--signal-clipping-border)',
          background: 'var(--signal-clipping-bg)', color: 'var(--signal-clipping)',
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {t.unplugMenu.unplugAll}
      </button>
    </div>,
    document.body,
  )
}
