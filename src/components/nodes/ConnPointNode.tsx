import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { NodeProps, Node } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { Plus, GitFork, X } from 'lucide-react'
import { NODE_REGISTRY } from '../../data/nodeRegistry'
import { useSignalStore } from '../../store/signalStore'

const INSERTABLE_TYPES = ['gain', 'hpf', 'eq', 'graphic-eq', 'comp', 'fader', 'switch', 'potentiometer', 'amp']

interface ConnPointData extends Record<string, unknown> {
  color?: string
  label?: string
}

export function ConnPointNode({ id, data }: NodeProps<Node<ConnPointData>>) {
  const edges            = useSignalStore((s) => s.edges)
  const insertNodeOnEdge = useSignalStore((s) => s.insertNodeOnEdge)
  const removeNode       = useSignalStore((s) => s.removeNode)
  const startSplitDraw   = useSignalStore((s) => s.startSplitDraw)

  const [insertMenu, setInsertMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!insertMenu) return
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) setInsertMenu(null)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setInsertMenu(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [insertMenu])

  function openMenuForEdge(edgeId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setInsertMenu({ edgeId, x: e.clientX + 8, y: e.clientY })
  }

  function handleOutputClick(e: React.MouseEvent) {
    const edge = edges.find((ed) => ed.source === id && ed.sourceHandle === 'out')
    if (edge) openMenuForEdge(edge.id, e)
  }

  function handleInputClick(e: React.MouseEvent) {
    const edge = edges.find((ed) => ed.target === id && ed.targetHandle === 'in')
    if (edge) openMenuForEdge(edge.id, e)
  }

  function handleInsert(typeKey: string) {
    if (!insertMenu) return
    insertNodeOnEdge(insertMenu.edgeId, typeKey)
    setInsertMenu(null)
  }

  const accent = data.color ?? 'var(--lsc-accent)'

  return (
    <div
      style={{
        position: 'relative',
        width: 16, height: 16,
        borderRadius: '50%',
        background: accent,
        border: '2px solid var(--lsc-node-bg)',
        boxShadow: 'var(--lsc-shadow-node)',
        cursor: 'default',
        pointerEvents: 'auto',
      }}
      title={data.label ?? 'Connection point — click handles to insert or split'}
    >
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        style={{
          top: '50%', width: 10, height: 10,
          background: 'var(--lsc-border)',
          border: '2px solid var(--lsc-node-bg)',
          borderRadius: '50%',
          cursor: 'pointer',
        }}
        onClick={handleInputClick}
      />
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        style={{
          top: '50%', width: 10, height: 10,
          background: accent,
          border: '2px solid var(--lsc-node-bg)',
          borderRadius: '50%',
          cursor: 'pointer',
        }}
        onClick={handleOutputClick}
      />

      <button
        className="nodrag nopan"
        title="Remove connection point"
        style={{
          position: 'absolute', top: -9, right: -9,
          width: 14, height: 14,
          borderRadius: '50%',
          background: 'var(--lsc-node-bg)',
          border: '1px solid var(--lsc-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0, color: 'var(--lsc-text)', lineHeight: 1,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--signal-clipping)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--lsc-text)')}
        onClick={(e) => { e.stopPropagation(); removeNode(id) }}
      >
        <X size={8} />
      </button>

      {insertMenu && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: insertMenu.x,
            top: insertMenu.y,
            zIndex: 9999,
            background: 'var(--lsc-node-bg)',
            border: '1px solid var(--lsc-border)',
            borderRadius: 'var(--lsc-radius-md)',
            boxShadow: 'var(--lsc-shadow-popup)',
            minWidth: 180,
            overflow: 'hidden',
            fontSize: 12,
            color: 'var(--lsc-text)',
          }}
        >
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              width: '100%', padding: '7px 12px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--lsc-accent)', textAlign: 'left', fontSize: 12, fontWeight: 600,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--lsc-sunken)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            onClick={() => { startSplitDraw(insertMenu.edgeId); setInsertMenu(null) }}
          >
            <GitFork size={13} /> Add Split
          </button>
          <div style={{ height: 1, background: 'var(--lsc-border)', margin: '0 8px' }} />
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px 3px',
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--lsc-text)', background: 'var(--lsc-sunken)',
            }}
          >
            <Plus size={9} /> Insert on this connection
          </div>
          {INSERTABLE_TYPES.map((key) => {
            const typeDef = NODE_REGISTRY[key]
            if (!typeDef) return null
            return (
              <button
                key={key}
                style={{
                  display: 'block', width: '100%',
                  padding: '5px 12px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--lsc-text)', textAlign: 'left', fontSize: 12,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--lsc-sunken)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                onClick={() => handleInsert(key)}
              >
                {typeDef.label}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
