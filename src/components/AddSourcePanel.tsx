import { useState } from 'react'
import { Panel } from '@xyflow/react'
import { Plus, Mic, Cable, Guitar, X } from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import { LEVEL_LIMITS } from '../data/levels'
import type { SourceType } from '../store/signalStore'

const SOURCE_OPTIONS: { type: SourceType; icon: typeof Mic; label: string; description: string }[] = [
  { type: 'mic',        icon: Mic,    label: 'Microphone',  description: 'XLR mic — needs phantom/preamp' },
  { type: 'line',       icon: Cable,  label: 'Line Input',  description: '+4 dBu or −10 dBu balanced line' },
  { type: 'instrument', icon: Guitar, label: 'Instrument',  description: 'Hi-Z direct guitar, bass, keys' },
]

export function AddSourcePanel() {
  const [open, setOpen] = useState(false)
  const channels       = useSignalStore((s) => s.channels)
  const complexityLevel = useSignalStore((s) => s.complexityLevel)
  const addChannel     = useSignalStore((s) => s.addChannel)

  const limits = LEVEL_LIMITS[complexityLevel]
  const atMax  = channels.length >= limits.maxInputChannels

  const baseStyle: React.CSSProperties = {
    background: 'var(--lsc-node-bg)',
    border: '1px solid var(--lsc-border)',
    borderRadius: 'var(--lsc-radius-md)',
    boxShadow: 'var(--lsc-shadow-popup)',
    fontSize: 12,
    color: 'var(--lsc-fg)',
    overflow: 'hidden',
  }

  return (
    <Panel position="top-left" style={{ margin: 12 }}>
      {open ? (
        <div style={{ ...baseStyle, minWidth: 220 }}>
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: '1px solid var(--lsc-border)', background: 'var(--lsc-sunken)' }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--lsc-fg-dim)' }}>
              Add Source
            </span>
            <button
              className="nodrag nopan"
              style={{ color: 'var(--lsc-fg-dim)', cursor: 'pointer' }}
              onClick={() => setOpen(false)}
            >
              <X size={12} />
            </button>
          </div>
          {SOURCE_OPTIONS.map(({ type, icon: Icon, label, description }) => (
            <button
              key={type}
              className="nodrag nopan w-full text-left transition-colors"
              style={{
                display: 'block',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderBottom: '1px solid var(--lsc-border)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--lsc-sunken)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              onClick={() => { addChannel(type); setOpen(false) }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <Icon size={12} style={{ color: 'var(--lsc-fg-dim)' }} />
                <span className="font-semibold text-[12px]">{label}</span>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--lsc-fg-dim)' }}>{description}</span>
            </button>
          ))}
        </div>
      ) : (
        <button
          className="nodrag nopan flex items-center gap-1.5"
          title={atMax
            ? `Max ${limits.maxInputChannels} channel${limits.maxInputChannels === 1 ? '' : 's'} at ${complexityLevel} level`
            : 'Add input source'}
          disabled={atMax}
          onClick={() => setOpen(true)}
          style={{
            ...baseStyle,
            padding: '6px 10px',
            cursor: atMax ? 'not-allowed' : 'pointer',
            opacity: atMax ? 0.45 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Plus size={13} style={{ color: 'var(--lsc-accent)' }} />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--lsc-fg)' }}>Add Source</span>
          <span className="text-[10px]" style={{ color: 'var(--lsc-fg-fainter)' }}>
            {channels.length}/{limits.maxInputChannels}
          </span>
        </button>
      )}
    </Panel>
  )
}
