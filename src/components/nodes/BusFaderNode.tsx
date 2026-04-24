import { Handle, Position } from '@xyflow/react'
import { Radio, Volume2, Headphones } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'
import { useSignalChain, getHealth } from '../../hooks/useSignalChain'
import { getHealthStyle, formatDb } from '../../hooks/useGainStaging'
import { SignalMeter } from '../SignalMeter'
import { VerticalFader } from '../controls/VerticalFader'
import type { Send } from '../../store/signalStore'

const BUS_ICONS = {
  aux: Radio,
  fx: Volume2,
  pfl: Headphones,
}

const BUS_FADER_LABELS = {
  aux: 'Aux Fader',
  fx: 'FX Fader',
  pfl: 'PFL Fader',
}

interface BusFaderNodeProps {
  data: { send: Send }
}

export function BusFaderNode({ data }: BusFaderNodeProps) {
  const { send } = data
  const { stages } = useSignalChain()
  const updateBusFader = useSignalStore((s) => s.updateBusFader)

  const tapStage = stages[send.fromNodeId]
  const tapDb = tapStage?.out ?? -Infinity
  const faderOut = tapDb + send.faderDb
  const faderHealth = getHealth(faderOut)
  const healthStyle = getHealthStyle(faderHealth)

  const Icon = BUS_ICONS[send.busType]
  const label = BUS_FADER_LABELS[send.busType]

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

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: '1px solid var(--lsc-border)', color: 'var(--lsc-fg-dim)' }}
      >
        <Icon size={13} />
        <span className="text-xs font-semibold" style={{ color: 'var(--lsc-fg)' }}>
          {label}
        </span>
      </div>

      {/* Fader + meter */}
      <div className="p-3 space-y-2">
        <VerticalFader
          value={send.faderDb}
          min={-80}
          max={10}
          step={0.5}
          formatValue={(v) => (v <= -80 ? '−∞' : `${v >= 0 ? '+' : ''}${v.toFixed(1)} dB`)}
          onChange={(v) => updateBusFader(send.id, v)}
        />

        <SignalMeter db={faderOut} health={faderHealth} showValue={false} />
        <div className="flex justify-between">
          <span className="text-[10px] font-mono font-semibold" style={{ color: healthStyle.color }}>
            {formatDb(faderOut)}
          </span>
          <span className="text-[10px]" style={{ color: healthStyle.color }}>
            {faderHealth.replace('-', ' ')}
          </span>
        </div>
      </div>
    </div>
  )
}
