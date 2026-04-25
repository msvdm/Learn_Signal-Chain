import { Handle, Position } from '@xyflow/react'
import { Radio, Volume2, Headphones, Network, X, ToggleLeft, ToggleRight } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'
import { useMultiChannelSignal } from '../../hooks/useSignalChain'
import { getHealthStyle, formatDb } from '../../hooks/useGainStaging'
import { SignalMeter } from '../SignalMeter'
import { VerticalFader } from '../controls/VerticalFader'
import { getHealth } from '../../hooks/useSignalChain'
import type { Bus } from '../../store/signalStore'

const BUS_ICONS: Record<string, typeof Radio> = {
  aux:    Radio,
  fx:     Volume2,
  pfl:    Headphones,
  matrix: Network,
}

interface BusNodeProps {
  data: { bus: Bus }
}

export function BusNode({ data }: BusNodeProps) {
  const { bus } = data
  const { busResults } = useMultiChannelSignal()
  const removeBus = useSignalStore((s) => s.removeBus)
  const updateBus = useSignalStore((s) => s.updateBus)

  const busResult = busResults[bus.id] ?? { inputDb: -Infinity, outputDb: -Infinity }
  const inputDb   = busResult.inputDb
  const outputDb  = busResult.outputDb
  const inputHealth  = getHealth(inputDb)
  const outputHealth = getHealth(outputDb)
  const healthStyle  = getHealthStyle(outputHealth)

  const Icon = BUS_ICONS[bus.busType] ?? Radio

  return (
    <div
      className="select-none"
      style={{
        width: 192,
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
            {bus.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {bus.busType !== 'pfl' && (
            <button
              className="nodrag nopan flex items-center gap-1 text-[9px] rounded px-1 py-0.5 transition-colors"
              title={bus.isStereo ? 'Stereo — click for mono' : 'Mono — click for stereo'}
              style={{
                color: 'var(--lsc-fg-dim)',
                background: 'var(--lsc-sunken)',
                border: '1px solid var(--lsc-border)',
                cursor: 'pointer',
              }}
              onClick={() => updateBus(bus.id, { isStereo: !bus.isStereo })}
            >
              {bus.isStereo
                ? <><ToggleRight size={10} /> ST</>
                : <><ToggleLeft size={10} /> MO</>
              }
            </button>
          )}
          <button
            className="nodrag nopan transition-colors"
            title="Remove bus"
            style={{ color: 'var(--lsc-fg-fainter)', padding: '1px 2px', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--signal-clipping)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--lsc-fg-fainter)')}
            onClick={() => removeBus(bus.id)}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Input signal */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px]" style={{ color: 'var(--lsc-fg-dim)' }}>Receives</span>
            <span
              className="text-[10px] font-mono font-semibold"
              style={{ color: getHealthStyle(inputHealth).color }}
            >
              {formatDb(inputDb)}
            </span>
          </div>
          <SignalMeter db={inputDb} health={inputHealth} showValue={false} />
        </div>

        {/* Bus master fader */}
        <VerticalFader
          value={bus.faderDb}
          min={-80}
          max={10}
          step={1}
          formatValue={(v) => (v <= -80 ? '−∞' : `${v >= 0 ? '+' : ''}${v} dB`)}
          onChange={(v) => updateBus(bus.id, { faderDb: v })}
        />

        {/* Output signal */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px]" style={{ color: 'var(--lsc-fg-dim)' }}>Output</span>
            <span
              className="text-[10px] font-mono font-semibold"
              style={{ color: healthStyle.color }}
            >
              {formatDb(outputDb)}
            </span>
          </div>
          <SignalMeter db={outputDb} health={outputHealth} showValue={false} />
        </div>
      </div>
    </div>
  )
}
