import { useState, useEffect, useRef } from 'react'
import type { EdgeProps } from '@xyflow/react'
import { getStraightPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react'
import { Plus, ArrowUpRight } from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import { CHAIN_ORDER } from '../data/levels'

const INSERT_LABELS: Record<string, string> = {
  preamp:        'Preamp / Gain',
  eq:            'Equalizer',
  comp:          'Compressor',
  fader:         'Channel Fader',
  'output-eq':   'Output EQ',
  'output-gain': 'Output Gain',
}

export function ChainEdge({
  id, source, target, sourceX, sourceY, targetX, targetY, style, markerEnd,
}: EdgeProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const insertNode       = useSignalStore((s) => s.insertNode)
  const startPlacingSend = useSignalStore((s) => s.startPlacingSend)
  const chainOrder       = useSignalStore((s) => s.chainOrder)
  const complexityLevel  = useSignalStore((s) => s.complexityLevel)
  const { t }            = useTranslation()

  const BEGINNER_BLOCKED = new Set(['output-eq', 'output-gain'])

  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY })

  const srcPos = CHAIN_ORDER.indexOf(source)
  const tgtPos = CHAIN_ORDER.indexOf(target ?? '')
  const availableInserts = CHAIN_ORDER.filter((nid) =>
    !chainOrder.includes(nid) &&
    CHAIN_ORDER.indexOf(nid) > srcPos &&
    CHAIN_ORDER.indexOf(nid) < tgtPos &&
    !(BEGINNER_BLOCKED.has(nid) && complexityLevel === 'beginner')
  )

  // Nothing to insert and sends don't make sense before the first gain stage
  const showSends = source !== 'mic'
  const canOpen = availableInserts.length > 0 || showSends

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const sectionStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 10px 3px',
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
    color: 'var(--lsc-fg-dim)', background: 'var(--lsc-sunken)',
  }
  const itemStyle: React.CSSProperties = {
    display: 'block', width: '100%',
    padding: '5px 12px',
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--lsc-fg)', textAlign: 'left', fontSize: 12,
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            zIndex: open ? 9999 : 1,
          }}
        >
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
                color: 'var(--lsc-fg)',
              }}
            >
              {availableInserts.length > 0 && (
                <>
                  <div style={sectionStyle}>
                    <Plus size={9} /> {t.chainMenu.insertTitle}
                  </div>
                  {availableInserts.map((nodeId) => (
                    <button
                      key={nodeId}
                      style={itemStyle}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--lsc-sunken)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      onClick={() => { insertNode(nodeId, source); setOpen(false) }}
                    >
                      {INSERT_LABELS[nodeId] ?? nodeId}
                    </button>
                  ))}
                </>
              )}

              {showSends && (
                <>
                  {availableInserts.length > 0 && <div style={{ borderTop: '1px solid var(--lsc-border)' }} />}
                  <div style={sectionStyle}>
                    <ArrowUpRight size={9} /> {t.chainMenu.sendTitle}
                  </div>
                  {(['aux', 'fx', 'pfl'] as const).map((busType) => (
                    <button
                      key={busType}
                      style={itemStyle}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--lsc-sunken)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      onClick={() => { startPlacingSend(source, busType); setOpen(false) }}
                    >
                      {busType === 'aux' ? t.chainMenu.auxBus : busType === 'fx' ? t.chainMenu.fxEngine : t.chainMenu.pflMonitor}
                    </button>
                  ))}
                </>
              )}
            </div>
          ) : canOpen ? (
            <button
              className="nodrag nopan"
              onClick={(e) => { e.stopPropagation(); setOpen(true) }}
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
              title="Insert node or add send"
            >
              +
            </button>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
