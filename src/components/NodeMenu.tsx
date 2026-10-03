import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, Power, Trash2 } from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import { useGraphSignal } from '../hooks/useSignalChain'
import { canBypass, helpKeyOf } from '../data/nodeRegistry'

const MARGIN = 8

interface NodeMenuProps {
  nodeId: string
  /** Screen point that was right-clicked */
  x: number
  y: number
  onClose: () => void
}

/**
 * Right-click menu of an element on the canvas: Help, Bypass / Turn back on, Remove.
 * Rendered in document.body — React Flow's transform breaks position: fixed inside the canvas.
 */
export function NodeMenu({ nodeId, x, y, onClose }: NodeMenuProps) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === nodeId))
  const setActiveTooltip = useSignalStore((s) => s.setActiveTooltip)
  const setSelectedNode  = useSignalStore((s) => s.setSelectedNode)
  const toggleBypassNode = useSignalStore((s) => s.toggleBypassNode)
  const removeNode       = useSignalStore((s) => s.removeNode)
  const { stages }       = useGraphSignal()
  const { t }            = useTranslation()
  const ref              = useRef<HTMLDivElement>(null)
  const [pos, setPos]    = useState({ left: x, top: y })

  // The parent passes a new onClose each render — keep the latest without re-subscribing
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  // Keep the whole menu on screen
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    setPos({
      left: Math.max(MARGIN, Math.min(x, window.innerWidth - r.width - MARGIN)),
      top:  Math.max(MARGIN, Math.min(y, window.innerHeight - r.height - MARGIN)),
    })
  }, [x, y])

  // Close on a click outside, Escape, zooming or scrolling; focus the first item for the keyboard
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    const close = () => onCloseRef.current()
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('wheel', close, { passive: true })
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', close)
      window.removeEventListener('resize', close)
    }
  }, [])

  // The element is gone (removed, Reset, level change) — nothing to act on
  useEffect(() => {
    if (!node) onCloseRef.current()
  }, [node])

  if (!node) return null

  const helpKey   = helpKeyOf(node, stages[nodeId])
  const hasHelp   = Boolean(t.theory[helpKey])
  const bypassed  = node.bypassed ?? false

  function act(fn: () => void) {
    fn()
    onCloseRef.current()
  }

  // Arrow keys move between the items
  function onMenuKey(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const i     = items.indexOf(document.activeElement as HTMLButtonElement)
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
  }

  return createPortal(
    <div
      ref={ref}
      role="menu"
      onKeyDown={onMenuKey}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed', zIndex: 1000, left: pos.left, top: pos.top, minWidth: 220,
        background: 'var(--lsc-node-bg)', color: 'var(--lsc-fg)',
        border: '1px solid var(--lsc-border)', borderRadius: 'var(--lsc-radius-lg)',
        boxShadow: 'var(--lsc-shadow-popup)', padding: 4, fontSize: 13,
      }}
    >
      {hasHelp && (
        <MenuItem
          icon={<HelpCircle size={15} />}
          label={t.tooltip.whatIsThis}
          onClick={() => act(() => { setActiveTooltip(nodeId, helpKey); setSelectedNode(nodeId) })}
        />
      )}
      {canBypass(node.typeKey) && (
        <MenuItem
          icon={<Power size={15} />}
          label={bypassed ? t.nodeMenu.turnOn : t.nodeMenu.bypass}
          onClick={() => act(() => toggleBypassNode(nodeId))}
        />
      )}
      <MenuItem
        icon={<Trash2 size={15} />}
        label={t.nodeControls.remove}
        danger
        onClick={() => act(() => removeNode(nodeId))}
      />
    </div>,
    document.body,
  )
}

function MenuItem({ icon, label, onClick, danger = false }: {
  icon: ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={danger ? 'lsc-menu-item lsc-menu-item-danger' : 'lsc-menu-item'}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 'var(--lsc-radius-sm)',
        border: 'none', background: 'transparent', textAlign: 'left',
        color: danger ? 'var(--signal-clipping-text)' : 'var(--lsc-fg)',
        fontSize: 13, fontWeight: 500, cursor: 'pointer',
      }}
    >
      <span style={{ display: 'flex', color: danger ? 'inherit' : 'var(--lsc-fg-muted)' }}>{icon}</span>
      {label}
    </button>
  )
}
