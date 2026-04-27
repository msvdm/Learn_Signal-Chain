import { useState } from 'react'
import { Panel } from '@xyflow/react'
import { Plus, Radio, Volume2, Headphones, Network, X } from 'lucide-react'
import { useSignalStore } from '../store/signalStore'
import { LEVEL_LIMITS } from '../data/levels'
import type { BusType } from '../store/signalStore'

interface BusOption {
  type: BusType
  icon: typeof Radio
  label: string
  description: string
}

const BUS_OPTIONS: BusOption[] = [
  { type: 'pfl',    icon: Headphones, label: 'PFL Monitor', description: 'Pre-fader listen — headphone cue' },
  { type: 'aux',    icon: Radio,      label: 'Aux Bus',     description: 'Effects send or monitor mix' },
  { type: 'fx',     icon: Volume2,    label: 'FX Engine',   description: 'Reverb, delay, other effects' },
  { type: 'matrix', icon: Network,    label: 'Matrix Out',  description: 'Secondary output routing' },
]

export function InsertBusPanel() {
  const [open, setOpen] = useState(false)
  const nodes          = useSignalStore((s) => s.nodes)
  const complexityLevel = useSignalStore((s) => s.complexityLevel)
  const addBusNode     = useSignalStore((s) => s.addBusNode)

  const limits   = LEVEL_LIMITS[complexityLevel]
  const busNodes = nodes.filter((n) => n.typeKey === 'bus')

  function canAdd(type: BusType): { allowed: boolean; reason?: string } {
    const existing = busNodes.filter((n) => n.params.busType === type).length
    if (type === 'pfl') {
      if (existing >= limits.maxPflBuses) return { allowed: false, reason: 'PFL already added' }
      return { allowed: true }
    }
    if (type === 'aux') {
      if (existing >= limits.maxAuxBuses) return { allowed: false, reason: `Max ${limits.maxAuxBuses} aux buses` }
      return { allowed: true }
    }
    if (type === 'fx') {
      if (limits.maxFxEngines === 0) return { allowed: false, reason: 'Not available at this level' }
      if (existing >= limits.maxFxEngines) return { allowed: false, reason: `Max ${limits.maxFxEngines} FX engines` }
      return { allowed: true }
    }
    if (type === 'matrix') {
      if (!limits.hasMatrixBuses) return { allowed: false, reason: 'Not available at this level' }
      if (existing >= 2) return { allowed: false, reason: 'Max 2 matrix outputs' }
      return { allowed: true }
    }
    return { allowed: false }
  }

  const visibleOptions = BUS_OPTIONS.filter((opt) => {
    if (opt.type === 'matrix') return limits.hasMatrixBuses
    if (opt.type === 'fx') return limits.maxFxEngines > 0
    return true
  })

  const baseStyle: React.CSSProperties = {
    background: 'var(--lsc-node-bg)',
    border: '1px solid var(--lsc-border)',
    borderRadius: 'var(--lsc-radius-md)',
    boxShadow: 'var(--lsc-shadow-popup)',
    fontSize: 12,
    color: 'var(--lsc-text)',
    overflow: 'hidden',
  }

  return (
    <Panel position="top-right" style={{ margin: 12 }}>
      {open ? (
        <div style={{ ...baseStyle, minWidth: 230 }}>
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: '1px solid var(--lsc-border)', background: 'var(--lsc-sunken)' }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--lsc-text)' }}>
              Insert Bus
            </span>
            <button
              className="nodrag nopan"
              style={{ color: 'var(--lsc-text)', cursor: 'pointer' }}
              onClick={() => setOpen(false)}
            >
              <X size={12} />
            </button>
          </div>
          {visibleOptions.map(({ type, icon: Icon, label, description }) => {
            const { allowed, reason } = canAdd(type)
            return (
              <button
                key={type}
                className="nodrag nopan w-full text-left transition-colors"
                disabled={!allowed}
                title={!allowed ? reason : undefined}
                style={{
                  display: 'block',
                  padding: '8px 12px',
                  background: 'none',
                  border: 'none',
                  cursor: allowed ? 'pointer' : 'not-allowed',
                  opacity: allowed ? 1 : 0.45,
                  borderBottom: '1px solid var(--lsc-border)',
                }}
                onMouseEnter={(e) => { if (allowed) e.currentTarget.style.background = 'var(--lsc-sunken)' }}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                onClick={() => {
                  if (!allowed) return
                  addBusNode(type)
                  setOpen(false)
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Icon size={12} style={{ color: 'var(--lsc-text)' }} />
                    <span className="font-semibold text-[12px]">{label}</span>
                  </div>
                  {!allowed && reason && (
                    <span className="text-[9px]" style={{ color: 'var(--lsc-text)' }}>{reason}</span>
                  )}
                </div>
                <span className="text-[10px]" style={{ color: 'var(--lsc-text)' }}>{description}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <button
          className="nodrag nopan flex items-center gap-1.5"
          title="Add a bus (Aux, FX, PFL, Matrix)"
          onClick={() => setOpen(true)}
          style={{
            ...baseStyle,
            padding: '6px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Plus size={13} style={{ color: 'var(--lsc-accent)' }} />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--lsc-text)' }}>Insert Bus</span>
          {busNodes.length > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--lsc-text)' }}>{busNodes.length}</span>
          )}
        </button>
      )}
    </Panel>
  )
}
