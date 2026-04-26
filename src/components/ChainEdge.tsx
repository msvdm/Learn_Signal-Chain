import { useState, useEffect, useRef } from 'react'
import type { EdgeProps } from '@xyflow/react'
import { getStraightPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react'
import { Plus, ArrowUpRight, Radio, Volume2, Headphones, Network, Check } from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import { useTranslation } from '../i18n/useTranslation'
import { CHANNEL_NODE_ORDER, MASTER_NODE_ORDER } from '../data/levels'
import type { BusType } from '../data/levels'

const INSERT_LABELS: Record<string, string> = {
  preamp:        'Preamp / Gain',
  hpf:           'High-Pass Filter',
  eq:            'Parametric EQ',
  comp:          'Compressor',
  fader:         'Channel Fader',
  'graphic-eq':  'Graphic EQ (10-band)',
}

const BUS_ICONS: Record<BusType, typeof Radio> = {
  aux:    Radio,
  fx:     Volume2,
  pfl:    Headphones,
  matrix: Network,
}

export function ChainEdge({
  id, source, target, sourceX, sourceY, targetX, targetY, style, markerEnd,
}: EdgeProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const buses              = useSignalStore((s) => s.buses)
  const sends              = useSignalStore((s) => s.sends)
  const addSend            = useSignalStore((s) => s.addSend)
  const insertChannelNode  = useSignalStore((s) => s.insertChannelNode)
  const insertMasterNode   = useSignalStore((s) => s.insertMasterNode)
  const masterChainOrder   = useSignalStore((s) => s.masterChainOrder)
  const complexityLevel    = useSignalStore((s) => s.complexityLevel)
  const { t }              = useTranslation()

  // Extract channelId and typeKeys from the edge source/target IDs
  const channelId     = source.includes(':') ? source.split(':')[0] : 'master'
  const srcTypeKey    = source.includes(':') ? source.split(':')[1] : source
  const tgtTypeKey    = target?.includes(':') ? target.split(':')[1] : (target ?? '')

  const channel = useSignalStore((s) => s.channels.find((c) => c.id === channelId))

  const [edgePath, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY })

  // Channel inserts: find type-keys that fit between this edge's source and target
  const srcPos = CHANNEL_NODE_ORDER.indexOf(srcTypeKey)
  const tgtPos = CHANNEL_NODE_ORDER.indexOf(tgtTypeKey)
  const availableInserts = channel
    ? CHANNEL_NODE_ORDER.filter((k) =>
        !channel.chainOrder.includes(k) &&
        CHANNEL_NODE_ORDER.indexOf(k) > srcPos &&
        CHANNEL_NODE_ORDER.indexOf(k) < tgtPos
      )
    : []

  // Master inserts: graphic-eq is insertable between master-fader and speaker, advanced+ only
  const isAdvanced = complexityLevel === 'advanced' || complexityLevel === 'routing-madness'
  const srcMasterPos = MASTER_NODE_ORDER.indexOf(srcTypeKey)
  const tgtMasterPos = MASTER_NODE_ORDER.indexOf(tgtTypeKey)
  const availableMasterInserts = channelId === 'master' && isAdvanced
    ? MASTER_NODE_ORDER.filter((k) =>
        !masterChainOrder.includes(k) &&
        MASTER_NODE_ORDER.indexOf(k) > srcMasterPos &&
        MASTER_NODE_ORDER.indexOf(k) < tgtMasterPos
      )
    : []

  // Sends only make sense from channel nodes (not from the source node itself)
  const showSends = channelId !== 'master' && srcTypeKey !== 'source'

  const canOpen = availableInserts.length > 0 || availableMasterInserts.length > 0 || showSends

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
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%',
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
                minWidth: 180,
                overflow: 'hidden',
                fontSize: 12,
                color: 'var(--lsc-fg)',
              }}
            >
              {/* Channel inserts */}
              {availableInserts.length > 0 && (
                <>
                  <div style={sectionStyle}>
                    <Plus size={9} /> {t.chainMenu.insertTitle}
                  </div>
                  {availableInserts.map((typeKey) => (
                    <button
                      key={typeKey}
                      style={itemStyle}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--lsc-sunken)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      onClick={() => {
                        insertChannelNode(channelId, typeKey, srcTypeKey)
                        setOpen(false)
                      }}
                    >
                      {INSERT_LABELS[typeKey] ?? typeKey}
                    </button>
                  ))}
                </>
              )}

              {/* Master inserts */}
              {availableMasterInserts.length > 0 && (
                <>
                  {availableInserts.length > 0 && <div style={{ borderTop: '1px solid var(--lsc-border)' }} />}
                  <div style={sectionStyle}>
                    <Plus size={9} /> {t.chainMenu.insertTitle}
                  </div>
                  {availableMasterInserts.map((nodeId) => (
                    <button
                      key={nodeId}
                      style={itemStyle}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--lsc-sunken)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                      onClick={() => {
                        insertMasterNode(nodeId, srcTypeKey)
                        setOpen(false)
                      }}
                    >
                      {INSERT_LABELS[nodeId] ?? nodeId}
                    </button>
                  ))}
                </>
              )}

              {/* Send to Bus section — bus picker */}
              {showSends && (
                <>
                  {(availableInserts.length > 0 || availableMasterInserts.length > 0) && <div style={{ borderTop: '1px solid var(--lsc-border)' }} />}
                  <div style={sectionStyle}>
                    <ArrowUpRight size={9} /> {t.chainMenu.sendTitle}
                  </div>

                  {buses.length === 0 ? (
                    <div
                      style={{
                        padding: '8px 12px',
                        fontSize: 11,
                        color: 'var(--lsc-fg-dim)',
                        fontStyle: 'italic',
                      }}
                    >
                      Add buses using the Insert Bus panel →
                    </div>
                  ) : (
                    buses.map((bus) => {
                      const alreadyConnected = sends.some(
                        (s) => s.fromNodeId === source && s.busId === bus.id
                      )
                      const Icon = BUS_ICONS[bus.busType] ?? Radio
                      return (
                        <button
                          key={bus.id}
                          style={{
                            ...itemStyle,
                            opacity: alreadyConnected ? 0.5 : 1,
                            cursor: alreadyConnected ? 'default' : 'pointer',
                          }}
                          disabled={alreadyConnected}
                          onMouseEnter={(e) => {
                            if (!alreadyConnected) e.currentTarget.style.background = 'var(--lsc-sunken)'
                          }}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                          onClick={() => {
                            if (!alreadyConnected) {
                              addSend(source, bus.id)
                              setOpen(false)
                            }
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <Icon size={11} style={{ color: 'var(--lsc-fg-dim)' }} />
                            {bus.label}
                          </span>
                          {alreadyConnected && <Check size={10} style={{ color: 'var(--signal-good)' }} />}
                        </button>
                      )
                    })
                  )}
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
              title="Insert node or connect to bus"
            >
              +
            </button>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
