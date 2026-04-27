import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode, CSSProperties } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Power, X, HelpCircle, Plus } from 'lucide-react'
import { NODE_REGISTRY } from '../../data/nodeRegistry'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { TooltipPanel } from '../Tooltip'

// Processor types the user can insert on any edge
const INSERTABLE_TYPES = ['gain', 'hpf', 'eq', 'comp', 'fader', 'switch', 'splitter', 'potentiometer', 'amp']

// Source and sink types cannot be bypassed or removed via the wrapper UI
const PROTECTED_TYPES = new Set(['mic', 'line-in', 'instrument', 'speaker'])

interface GraphNodeWrapperProps {
  nodeId: string
  typeKey: string
  icon: ReactNode
  label: string
  accentColor?: string
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

export function GraphNodeWrapper({
  nodeId,
  typeKey,
  icon,
  label,
  accentColor,
  children,
  className = '',
  style,
}: GraphNodeWrapperProps) {
  const setActiveTooltip    = useSignalStore((s) => s.setActiveTooltip)
  const activeTooltipId     = useSignalStore((s) => s.activeTooltipId)
  const toggleBypassNode    = useSignalStore((s) => s.toggleBypassNode)
  const removeNode          = useSignalStore((s) => s.removeNode)
  const insertNodeOnEdge    = useSignalStore((s) => s.insertNodeOnEdge)
  const edges               = useSignalStore((s) => s.edges)
  const { t }               = useTranslation()

  const isBypassed  = useSignalStore((s) => s.nodes.find((n) => n.id === nodeId)?.bypassed ?? false)
  const isProtected = PROTECTED_TYPES.has(typeKey)
  const hasTooltip  = Boolean(t.theory[typeKey])

  const def     = NODE_REGISTRY[typeKey]
  const inputs  = def?.inputs ?? []
  const outputs = def?.outputs ?? []

  const [insertMenu, setInsertMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!insertMenu) return
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setInsertMenu(null)
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

  function handleOutputClick(handleId: string, e: React.MouseEvent) {
    const edge = edges.find((ed) => ed.source === nodeId && ed.sourceHandle === handleId)
    if (edge) openMenuForEdge(edge.id, e)
  }

  function handleInputClick(handleId: string, e: React.MouseEvent) {
    const edge = edges.find((ed) => ed.target === nodeId && ed.targetHandle === handleId)
    if (edge) openMenuForEdge(edge.id, e)
  }

  function handleInsert(newTypeKey: string) {
    if (!insertMenu) return
    insertNodeOnEdge(insertMenu.edgeId, newTypeKey)
    setInsertMenu(null)
  }

  const borderAccent = accentColor
    ? `3px solid ${isBypassed ? 'var(--signal-hot)' : accentColor}`
    : `1px solid ${isBypassed ? 'var(--signal-hot)' : 'var(--lsc-border)'}`

  return (
    <div
      className={`relative w-52 select-none cursor-default ${className}`}
      style={{
        background: 'var(--lsc-node-bg)',
        border: `1px solid ${isBypassed ? 'var(--signal-hot)' : 'var(--lsc-border)'}`,
        borderLeft: borderAccent,
        borderRadius: 'var(--lsc-radius-lg)',
        boxShadow: activeTooltipId === nodeId
          ? '0 0 0 2px var(--lsc-accent)'
          : 'var(--lsc-shadow-node)',
        transition: 'border-color 0.15s',
        pointerEvents: 'auto',
        ...style,
      }}
    >
      {/* Input handles — visible colored dots on the left */}
      {inputs.map((port, i) => (
        <Handle
          key={port.id}
          id={port.id}
          type="target"
          position={Position.Left}
          title={`${port.label} — click to insert before`}
          style={{
            top: inputs.length === 1 ? '50%' : `${((i + 1) / (inputs.length + 1)) * 100}%`,
            width: 10, height: 10,
            background: 'var(--lsc-border)',
            border: '2px solid var(--lsc-node-bg)',
            borderRadius: '50%',
            cursor: 'pointer',
          }}
          onClick={(e) => handleInputClick(port.id, e)}
        />
      ))}

      {/* Output handles — accent-colored dots on the right */}
      {outputs.map((port, i) => (
        <Handle
          key={port.id}
          id={port.id}
          type="source"
          position={Position.Right}
          title={`${port.label} — click to insert after`}
          style={{
            top: outputs.length === 1 ? '50%' : `${((i + 1) / (outputs.length + 1)) * 100}%`,
            width: 10, height: 10,
            background: accentColor ?? 'var(--lsc-accent)',
            border: '2px solid var(--lsc-node-bg)',
            borderRadius: '50%',
            cursor: 'pointer',
          }}
          onClick={(e) => handleOutputClick(port.id, e)}
        />
      ))}

      {/* Insertion picker — portalled to body to escape React Flow's CSS transform */}
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

      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid var(--lsc-border)' }}
      >
        <div className="flex items-center gap-2" style={{ color: 'var(--lsc-text)' }}>
          <span>{icon}</span>
          <span className="text-xs font-semibold" style={{ color: 'var(--lsc-text)' }}>{label}</span>
          {isBypassed && (
            <span
              className="text-[9px] font-bold tracking-wide uppercase px-1 rounded"
              style={{ background: 'var(--signal-hot)', color: '#fff', lineHeight: '1.4' }}
            >
              BYP
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isProtected && (
            <>
              <button
                className="nodrag nopan transition-colors rounded"
                title={isBypassed ? (t.nodeControls?.bypassed ?? 'Bypassed') : (t.nodeControls?.bypass ?? 'Bypass')}
                style={{
                  color: isBypassed ? 'var(--signal-hot)' : 'var(--lsc-text)',
                  padding: '1px 2px', cursor: 'pointer',
                }}
                onClick={() => toggleBypassNode(nodeId)}
              >
                <Power size={12} />
              </button>
              <button
                className="nodrag nopan transition-colors rounded"
                title={t.nodeControls?.remove ?? 'Remove'}
                style={{ color: 'var(--lsc-text)', padding: '1px 2px', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--signal-clipping)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--lsc-text)')}
                onClick={() => removeNode(nodeId)}
              >
                <X size={12} />
              </button>
            </>
          )}
          {hasTooltip && (
            <button
              className="nodrag nopan transition-colors"
              style={{ color: 'var(--lsc-text)', cursor: 'pointer' }}
              onClick={() => setActiveTooltip(activeTooltipId === nodeId ? null : nodeId)}
            >
              <HelpCircle size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Content — dimmed when bypassed */}
      <div className="p-3" style={{ opacity: isBypassed ? 0.5 : 1, transition: 'opacity 0.15s' }}>
        {children}
      </div>

      {hasTooltip && <TooltipPanel nodeId={typeKey} />}
    </div>
  )
}
