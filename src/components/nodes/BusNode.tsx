import { Handle, Position } from '@xyflow/react'
import { Radio, Volume2, Headphones, X } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'
import { useSignalChain } from '../../hooks/useSignalChain'
import { getHealthStyle, formatDb } from '../../hooks/useGainStaging'
import { SignalMeter } from '../SignalMeter'
import type { Send } from '../../store/signalStore'

const BUS_ICONS = {
  aux: Radio,
  fx: Volume2,
  pfl: Headphones,
}

const BUS_LABELS = {
  aux: 'Aux Bus',
  fx: 'FX Bus',
  pfl: 'PFL Bus',
}

interface BusNodeProps {
  data: { send: Send }
}

export function BusNode({ data }: BusNodeProps) {
  const { send } = data
  const { stages } = useSignalChain()
  const removeSend = useSignalStore((s) => s.removeSend)

  const tapStage = stages[send.fromNodeId]
  const tapDb = tapStage?.out ?? -Infinity
  const tapHealth = tapStage?.health ?? 'too-quiet'
  const healthStyle = getHealthStyle(tapHealth)

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
        pointerEvents: 'auto',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'var(--lsc-node-bg)', borderColor: 'var(--lsc-border)' }}
      />
      <Handle
        type="source"
        position={Position.Right}
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
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: 'var(--lsc-fg-dim)' }}>Tap point</span>
          <span
            className="text-[10px] font-mono font-semibold"
            style={{ color: healthStyle.color }}
          >
            {formatDb(tapDb)}
          </span>
        </div>
        <SignalMeter db={tapDb} health={tapHealth} showValue={false} />
      </div>
    </div>
  )
}
