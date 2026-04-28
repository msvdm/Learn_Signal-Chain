import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Power, X, HelpCircle, Plus, GitFork } from 'lucide-react'
import { NODE_REGISTRY } from '../../data/nodeRegistry'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { TooltipPanel } from '../Tooltip'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { getHealthStyle } from '../../hooks/useGainStaging'

const INSERTABLE_TYPES = ['gain', 'hpf', 'eq', 'graphic-eq', 'comp', 'fader', 'switch', 'potentiometer', 'amp']
const PROTECTED_TYPES  = new Set(['mic', 'line-in', 'instrument', 'speaker'])
const NO_BYPASS_TYPES  = new Set(['fader', 'switch', 'potentiometer', 'gain'])

interface InlineNodeProps {
  nodeId: string
  typeKey: string
  icon: ReactNode
  label: string
  accentColor?: string
  value?: string
  children?: ReactNode
}

export function InlineNode({
  nodeId,
  typeKey,
  icon,
  label,
  accentColor,
  value,
  children,
}: InlineNodeProps) {
  const { stages }       = useGraphSignal()
  const setActiveTooltip = useSignalStore((s) => s.setActiveTooltip)
  const activeTooltipId  = useSignalStore((s) => s.activeTooltipId)
  const toggleBypassNode = useSignalStore((s) => s.toggleBypassNode)
  const removeNode       = useSignalStore((s) => s.removeNode)
  const insertNodeOnEdge = useSignalStore((s) => s.insertNodeOnEdge)
  const edges            = useSignalStore((s) => s.edges)
  const { t }            = useTranslation()

  const startSplitDraw  = useSignalStore((s) => s.startSplitDraw)

  const isBypassed  = useSignalStore((s) => s.nodes.find((n) => n.id === nodeId)?.bypassed ?? false)
  const isProtected = PROTECTED_TYPES.has(typeKey)
  const isNoBypass  = NO_BYPASS_TYPES.has(typeKey)
  const hasTooltip  = Boolean(t.theory[typeKey])

  const def     = NODE_REGISTRY[typeKey]
  const inputs  = def?.inputs  ?? []
  const outputs = def?.outputs ?? []

  const health      = stages[nodeId]?.health ?? 'too-quiet'
  const healthStyle = getHealthStyle(health)

  const showBypass = isBypassed && !isNoBypass

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

  return (
    <div
      className="relative select-none cursor-default"
      style={{
        width: 100,
        background: 'var(--lsc-node-bg)',
        border: showBypass
          ? '2px solid var(--signal-hot)'
          : `1px solid ${healthStyle.border}`,
        borderRadius: 'var(--lsc-radius-md)',
        boxShadow: activeTooltipId === nodeId
          ? '0 0 0 2px var(--lsc-accent)'
          : 'var(--lsc-shadow-node)',
        transition: 'border-color 0.15s',
        pointerEvents: 'auto',
      }}
    >
      {/* Input handles */}
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

      {/* Output handles */}
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
          {/* Add Split — top action, separated from the insert list */}
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

      {/* Action row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2, padding: '3px 4px 0' }}>
        {!isProtected && !isNoBypass && (
          <button
            className="nodrag nopan"
            title={isBypassed ? t.nodeControls.bypassed : t.nodeControls.bypass}
            style={{
              padding: '1px',
              color: isBypassed ? 'var(--signal-hot)' : 'var(--lsc-text)',
              cursor: 'pointer', background: 'none', border: 'none',
            }}
            onClick={() => toggleBypassNode(nodeId)}
          >
            <Power size={10} />
          </button>
        )}
        {!isProtected && (
          <button
            className="nodrag nopan"
            title={t.nodeControls.remove}
            style={{ padding: '1px', color: 'var(--lsc-text)', cursor: 'pointer', background: 'none', border: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--signal-clipping)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--lsc-text)')}
            onClick={() => removeNode(nodeId)}
          >
            <X size={10} />
          </button>
        )}
        {hasTooltip && (
          <button
            className="nodrag nopan"
            style={{ padding: '1px', color: 'var(--lsc-text)', cursor: 'pointer', background: 'none', border: 'none' }}
            onClick={() => setActiveTooltip(activeTooltipId === nodeId ? null : nodeId)}
          >
            <HelpCircle size={10} />
          </button>
        )}
      </div>

      {/* Icon + label body */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '2px 6px 8px',
          gap: 3,
          opacity: showBypass ? 0.55 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        <div style={{ color: accentColor ?? 'var(--lsc-accent)', lineHeight: 1 }}>
          {icon}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: 'var(--lsc-text)',
          textAlign: 'center', lineHeight: 1.2,
          maxWidth: '100%', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
        {showBypass && (
          <span style={{
            fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            background: 'var(--signal-hot)', color: '#fff',
            borderRadius: 2, padding: '1px 3px', lineHeight: 1.4,
          }}>BYP</span>
        )}
        {value && !showBypass && (
          <span style={{
            fontSize: 9, fontFamily: 'var(--lsc-font-mono)',
            color: 'var(--lsc-text)', lineHeight: 1,
          }}>
            {value}
          </span>
        )}
        {children}
      </div>

      {hasTooltip && <TooltipPanel nodeId={typeKey} />}
    </div>
  )
}
