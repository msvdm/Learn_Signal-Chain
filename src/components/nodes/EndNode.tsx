import { useState, useRef, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Plus, Speaker } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'

export function EndNode() {
  const [open, setOpen] = useState(false)
  const insertNode = useSignalStore((s) => s.insertNode)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '6px 12px',
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--lsc-fg)', textAlign: 'left', fontSize: 12,
  }

  return (
    <div className="nodrag nopan" style={{ pointerEvents: 'auto' }}>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />

      {open ? (
        <div
          ref={menuRef}
          style={{
            background: 'var(--lsc-node-bg)',
            border: '1px solid var(--lsc-border)',
            borderRadius: 'var(--lsc-radius-md)',
            boxShadow: 'var(--lsc-shadow-popup)',
            minWidth: 170,
            overflow: 'hidden',
            fontSize: 12,
          }}
        >
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px 3px',
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--lsc-fg-dim)', background: 'var(--lsc-sunken)',
            }}
          >
            <Plus size={9} /> Add output
          </div>
          <button
            style={itemStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--lsc-sunken)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            onClick={() => { insertNode('speaker', 'master-fader'); setOpen(false) }}
          >
            <Speaker size={13} />
            Speaker Output (L/R)
          </button>
        </div>
      ) : (
        <button
          className="nodrag nopan"
          onClick={(e) => { e.stopPropagation(); setOpen(true) }}
          title="Add speaker output"
          style={{
            width: 22, height: 22,
            borderRadius: '50%',
            background: 'var(--lsc-node-bg)',
            border: '1.5px solid var(--lsc-border)',
            color: 'var(--lsc-fg-dim)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, lineHeight: 1,
            boxShadow: 'var(--lsc-shadow-node)',
            opacity: 0.35,
            transition: 'opacity 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = 'var(--lsc-accent)' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.35'; e.currentTarget.style.borderColor = 'var(--lsc-border)' }}
        >
          +
        </button>
      )}
    </div>
  )
}
