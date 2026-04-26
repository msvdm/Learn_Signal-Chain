import { Network } from 'lucide-react'
import { Handle, Position } from '@xyflow/react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useMultiChannelSignal } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'

const HANDLE_STYLE = { visibility: 'hidden' as const }

export function MasterBusNode({ id }: { id: string }) {
  const { masterStages, masterInputDb } = useMultiChannelSignal()
  const channels = useSignalStore((s) => s.channels)
  const result = masterStages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  const mixNote = channels.length === 1
    ? 'Single channel output'
    : `${channels.length} channels mixing here`

  return (
    // hasTarget={false} — we provide our own per-channel target handles below
    // so each channel's line arrives at a distinct vertical position.
    <NodeWrapper nodeId={id} channelId="master" typeKey="master-bus" icon={<Network size={14} />} label="Master Bus" hasTarget={false}>
      {/* One hidden target handle per channel, spread across the left edge */}
      {channels.map((ch, i) => {
        const topPct = channels.length === 1
          ? 50
          : 10 + (i / (channels.length - 1)) * 80
        return (
          <Handle
            key={ch.id}
            id={ch.id}
            type="target"
            position={Position.Left}
            style={{ ...HANDLE_STYLE, top: `${topPct}%` }}
          />
        )
      })}

      <div className="space-y-3">
        <SignalMeter db={masterInputDb} health={result.health} label="Channels summed" />
        <div
          className="rounded-lg px-2 py-2 text-center text-[10px]"
          style={{ background: 'var(--lsc-sunken)', color: 'var(--lsc-text)' }}
        >
          {mixNote}
          {channels.length > 1 && (
            <span className="block mt-0.5" style={{ color: 'var(--lsc-text)' }}>
              Each doubling of channels adds ~3 dB
            </span>
          )}
        </div>
      </div>
    </NodeWrapper>
  )
}
