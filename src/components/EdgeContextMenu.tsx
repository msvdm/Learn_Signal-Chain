import { useEffect, useRef } from 'react'
import type { Edge } from '@xyflow/react'
import { Plus, ArrowUpRight } from 'lucide-react'
import { useTranslation } from '../i18n/useTranslation'

const INSERT_LABELS: Record<string, string> = {
  mic:    'Microphone',
  preamp: 'Preamp / Gain',
  eq:     'Equalizer',
  comp:   'Compressor',
  fader:  'Channel Fader',
  master: 'Master Bus',
}

interface EdgeContextMenuProps {
  edge: Edge
  position: { x: number; y: number }
  availableInserts: string[]
  onInsert: (nodeId: string) => void
  onSend: (busType: 'aux' | 'fx' | 'pfl') => void
  onClose: () => void
}

export function EdgeContextMenu({
  position,
  availableInserts,
  onInsert,
  onSend,
  onClose,
}: EdgeContextMenuProps) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    zIndex: 1000,
    background: 'var(--lsc-node-bg)',
    border: '1px solid var(--lsc-border)',
    borderRadius: 'var(--lsc-radius-md)',
    boxShadow: 'var(--lsc-shadow-popup)',
    minWidth: 180,
    overflow: 'hidden',
    fontFamily: 'var(--lsc-font-sans)',
    fontSize: 12,
    color: 'var(--lsc-text)',
  }

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px 4px',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--lsc-text)',
    background: 'var(--lsc-sunken)',
  }

  const itemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '6px 14px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--lsc-text)',
    fontSize: 12,
  }

  const disabledStyle: React.CSSProperties = {
    ...itemStyle,
    color: 'var(--lsc-text)',
    cursor: 'default',
    fontStyle: 'italic',
  }

  const dividerStyle: React.CSSProperties = {
    borderTop: '1px solid var(--lsc-border)',
  }

  return (
    <div ref={menuRef} style={menuStyle}>
      {/* INSERT section */}
      <div style={sectionHeaderStyle}>
        <Plus size={10} />
        {t.chainMenu.insertTitle}
      </div>
      {availableInserts.length === 0 ? (
        <span style={disabledStyle}>{t.chainMenu.allStagesInUse}</span>
      ) : (
        availableInserts.map((nodeId) => (
          <button
            key={nodeId}
            style={itemStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--lsc-sunken)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            onClick={() => { onInsert(nodeId); onClose() }}
          >
            {INSERT_LABELS[nodeId] ?? nodeId}
          </button>
        ))
      )}

      {/* SEND section */}
      <div style={dividerStyle} />
      <div style={sectionHeaderStyle}>
        <ArrowUpRight size={10} />
        {t.chainMenu.sendTitle}
      </div>
      {(['aux', 'fx', 'pfl'] as const).map((busType) => {
        const label = busType === 'aux'
          ? t.chainMenu.auxBus
          : busType === 'fx'
          ? t.chainMenu.fxEngine
          : t.chainMenu.pflMonitor
        return (
          <button
            key={busType}
            style={itemStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--lsc-sunken)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            onClick={() => { onSend(busType); onClose() }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
