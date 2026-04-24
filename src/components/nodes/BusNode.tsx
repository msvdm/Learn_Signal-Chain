import { Handle, Position } from '@xyflow/react'
import { Radio, Volume2, Headphones, X } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'
import { useSignalChain, getHealth } from '../../hooks/useSignalChain'
import { getHealthStyle, formatDb } from '../../hooks/useGainStaging'
import { SignalMeter } from '../SignalMeter'
import { ControlSlider } from './NodeWrapper'
import type { Send } from '../../store/signalStore'

const BUS_ICONS = {
  aux: Radio,
  fx: Volume2,
  pfl: Headphones,
}

const BUS_LABELS = {
  aux: 'Aux Bus',
  fx: 'FX Engine',
  pfl: 'PFL Monitor',
}

interface BusNodeProps {
  data: { send: Send }
}

export function BusNode({ data }: BusNodeProps) {
  const { send } = data
  const { stages } = useSignalChain()
  const updateSendLevel = useSignalStore((s) => s.updateSendLevel)
  const removeSend      = useSignalStore((s) => s.removeSend)

  // Signal at the tap point (output of fromNodeId)
  const tapStage  = stages[send.fromNodeId]
  const tapDb     = tapStage?.out ?? -Infinity
  const sendDb    = tapDb + send.sendLevelDb
  const sendHealth = getHealth(sendDb)
  const healthStyle = getHealthStyle(sendHealth)

  const Icon = BUS_ICONS[send.busType]
  const label = BUS_LABELS[send.busType]

  return (
    <div
      className="select-none nodrag"
      style={{
        width: 168,
        background: 'var(--lsc-node-bg)',
        border: '1px solid var(--lsc-border)',
        borderRadius: 'var(--lsc-radius-lg)',
        boxShadow: 'var(--lsc-shadow-node)',
      }}
    >
      {/* Input handle — signal enters from chain */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'var(--lsc-node-bg)', borderColor: 'var(--lsc-border)' }}
      />

      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid var(--lsc-border)' }}
      >
        <div className="flex items-center gap-2" style={{ color: 'var(--lsc-fg-dim)' }}>
          <Icon size={13} />
          <span className="text-xs font-semibold" style={{ color: 'var(--lsc-fg)' }}>
            {label}
          </span>
        </div>
        <button
          className="nodrag transition-colors"
          title="Remove send"
          style={{ color: 'var(--lsc-fg-fainter)', padding: '1px 2px' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--signal-clipping)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--lsc-fg-fainter)')}
          onClick={() => removeSend(send.id)}
        >
          <X size={12} />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Tap signal info */}
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: 'var(--lsc-fg-dim)' }}>Tap</span>
          <span
            className="text-[10px] font-mono font-semibold"
            style={{ color: tapStage ? getHealthStyle(tapStage.health).color : 'var(--lsc-fg-fainter)' }}
          >
            {formatDb(tapDb)}
          </span>
        </div>

        {/* Send level slider */}
        <ControlSlider
          label="Send level"
          value={send.sendLevelDb}
          min={-60}
          max={0}
          step={0.5}
          formatValue={(v) => (v <= -60 ? '−∞' : `${v >= 0 ? '+' : ''}${v.toFixed(1)} dB`)}
          onChange={(v) => updateSendLevel(send.id, v)}
        />

        {/* Bus signal meter */}
        <div className="space-y-1">
          <span className="text-[10px]" style={{ color: 'var(--lsc-fg-dim)' }}>Bus signal</span>
          <SignalMeter db={sendDb} health={sendHealth} showValue={false} />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold" style={{ color: healthStyle.color }}>
              {formatDb(sendDb)}
            </span>
            <span className="text-[10px]" style={{ color: healthStyle.color }}>
              {sendHealth.replace('-', ' ')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
