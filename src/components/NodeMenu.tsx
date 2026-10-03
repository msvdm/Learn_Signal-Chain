import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  HelpCircle, Power, Trash2, Scissors, Copy, ClipboardPaste, BoxSelect,
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
} from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import { useGraphSignal } from '../hooks/useSignalChain'
import { canBypass, helpKeyOf } from '../data/nodeRegistry'
import { useLatestRef } from '../hooks/useLatestRef'
import { MOD } from '../utils/shortcut'
import type { Direction } from '../utils/nodeGroup'

const MARGIN = 8

interface NodeMenuProps {
  /** The element that was right-clicked */
  nodeId: string
  /** What the actions apply to: the right-clicked element, or every selected one */
  targets: string[]
  /** Screen point that was right-clicked */
  x: number
  y: number
  onCut: () => void
  onCopy: () => void
  onDuplicate: (dir: Direction) => void
  onRemove: () => void
  onClose: () => void
}

/**
 * Right-click menu of an element on the canvas: Help, Bypass / Turn back on, Cut, Copy,
 * Duplicate (left / right / up / down), Remove. With several elements selected, the
 * actions apply to all of them (Help and Bypass are left out).
 */
export function NodeMenu({ nodeId, targets, x, y, onCut, onCopy, onDuplicate, onRemove, onClose }: NodeMenuProps) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === nodeId))
  const setActiveTooltip = useSignalStore((s) => s.setActiveTooltip)
  const setSelectedNode  = useSignalStore((s) => s.setSelectedNode)
  const toggleBypassNode = useSignalStore((s) => s.toggleBypassNode)
  const { stages }       = useGraphSignal()
  const { t, fmt }       = useTranslation()

  // The element is gone (removed, Reset, level change) — nothing to act on
  const onCloseRef = useLatestRef(onClose)
  useEffect(() => {
    if (!node) onCloseRef.current()
  }, [node, onCloseRef])

  if (!node) return null

  const many      = targets.length > 1
  const helpKey   = helpKeyOf(node, stages[nodeId])
  const hasHelp   = !many && Boolean(t.theory[helpKey])
  const bypassed  = node.bypassed ?? false

  const act = (fn: () => void) => () => { fn(); onClose() }

  const arrows: { dir: Direction; icon: ReactNode; label: string }[] = [
    { dir: 'left',  icon: <ArrowLeft size={15} />,  label: t.nodeMenu.duplicateLeft },
    { dir: 'right', icon: <ArrowRight size={15} />, label: t.nodeMenu.duplicateRight },
    { dir: 'up',    icon: <ArrowUp size={15} />,    label: t.nodeMenu.duplicateUp },
    { dir: 'down',  icon: <ArrowDown size={15} />,  label: t.nodeMenu.duplicateDown },
  ]

  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      {many && (
        <div style={{ padding: '6px 10px 4px', fontSize: 12, fontWeight: 600, color: 'var(--lsc-fg-muted)' }}>
          {fmt(t.nodeMenu.selected, { count: String(targets.length) })}
        </div>
      )}
      {hasHelp && (
        <MenuItem
          icon={<HelpCircle size={15} />}
          label={t.tooltip.whatIsThis}
          onClick={act(() => { setActiveTooltip(nodeId, helpKey); setSelectedNode(nodeId) })}
        />
      )}
      {!many && canBypass(node.typeKey) && (
        <MenuItem
          icon={<Power size={15} />}
          label={bypassed ? t.nodeMenu.turnOn : t.nodeMenu.bypass}
          onClick={act(() => toggleBypassNode(nodeId))}
        />
      )}
      {(hasHelp || (!many && canBypass(node.typeKey))) && <MenuDivider />}
      <MenuItem icon={<Scissors size={15} />} label={t.nodeMenu.cut} hint={`${MOD}X`} onClick={act(onCut)} />
      <MenuItem icon={<Copy size={15} />} label={t.nodeMenu.copy} hint={`${MOD}C`} onClick={act(onCopy)} />
      {/* Duplicate: one row, an arrow per side the copy can go */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 4px 4px 10px' }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{t.nodeMenu.duplicate}</span>
        {arrows.map((a) => (
          <button
            key={a.dir}
            role="menuitem"
            title={a.label}
            aria-label={a.label}
            onClick={act(() => onDuplicate(a.dir))}
            className="lsc-menu-item"
            style={{
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--lsc-radius-sm)', border: '1px solid var(--lsc-border)',
              background: 'transparent', color: 'var(--lsc-fg)', cursor: 'pointer', padding: 0,
            }}
          >
            {a.icon}
          </button>
        ))}
      </div>
      <MenuDivider />
      <MenuItem
        icon={<Trash2 size={15} />}
        label={many ? fmt(t.nodeMenu.removeMany, { count: String(targets.length) }) : t.nodeControls.remove}
        hint="Del"
        danger
        onClick={act(onRemove)}
      />
    </ContextMenu>
  )
}

/** Right-click menu of the empty canvas: Paste here, Select everything. */
export function CanvasMenu({ x, y, canPaste, canSelectAll, onPaste, onSelectAll, onClose }: {
  x: number
  y: number
  canPaste: boolean
  canSelectAll: boolean
  onPaste: () => void
  onSelectAll: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const act = (fn: () => void) => () => { fn(); onClose() }
  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      <MenuItem
        icon={<ClipboardPaste size={15} />}
        label={canPaste ? t.nodeMenu.paste : t.nodeMenu.pasteEmpty}
        hint={`${MOD}V`}
        disabled={!canPaste}
        onClick={act(onPaste)}
      />
      <MenuItem
        icon={<BoxSelect size={15} />}
        label={t.nodeMenu.selectAll}
        hint={`${MOD}A`}
        disabled={!canSelectAll}
        onClick={act(onSelectAll)}
      />
    </ContextMenu>
  )
}

/**
 * The menu box: kept on screen, closes on a click outside, Escape, zooming or resizing;
 * arrow keys move between the items.
 * Rendered in document.body — React Flow's transform breaks position: fixed inside the canvas.
 */
function ContextMenu({ x, y, onClose, children }: { x: number; y: number; onClose: () => void; children: ReactNode }) {
  const ref           = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  // The parent passes a new onClose each render — keep the latest without re-subscribing
  const onCloseRef    = useLatestRef(onClose)

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
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
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
  }, [onCloseRef])

  // Arrow keys move between the items
  function onMenuKey(e: React.KeyboardEvent) {
    const keys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    const i     = items.indexOf(document.activeElement as HTMLButtonElement)
    const back  = e.key === 'ArrowUp' || e.key === 'ArrowLeft'
    items[(i + (back ? items.length - 1 : 1)) % items.length]?.focus()
  }

  return createPortal(
    <div
      ref={ref}
      role="menu"
      onKeyDown={onMenuKey}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed', zIndex: 1000, left: pos.left, top: pos.top, minWidth: 240,
        background: 'var(--lsc-node-bg)', color: 'var(--lsc-fg)',
        border: '1px solid var(--lsc-border)', borderRadius: 'var(--lsc-radius-lg)',
        boxShadow: 'var(--lsc-shadow-popup)', padding: 4, fontSize: 13,
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

function MenuDivider() {
  return <div role="separator" style={{ height: 1, margin: '4px 6px', background: 'var(--lsc-border)' }} />
}

function MenuItem({ icon, label, hint, onClick, danger = false, disabled = false }: {
  icon: ReactNode
  label: string
  /** Keyboard shortcut shown on the right */
  hint?: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={danger ? 'lsc-menu-item lsc-menu-item-danger' : 'lsc-menu-item'}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 'var(--lsc-radius-sm)',
        border: 'none', background: 'transparent', textAlign: 'left',
        color: danger ? 'var(--signal-clipping-text)' : 'var(--lsc-fg)',
        fontSize: 13, fontWeight: 500, cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{ display: 'flex', color: danger ? 'inherit' : 'var(--lsc-fg-muted)' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {hint && <span style={{ fontSize: 12, color: 'var(--lsc-fg-dim)', marginLeft: 12 }}>{hint}</span>}
    </button>
  )
}
