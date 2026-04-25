import { Network } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useMultiChannelSignal } from '../../hooks/useSignalChain'
import { useSignalStore } from '../../store/signalStore'

export function MasterBusNode({ id }: { id: string }) {
  const { masterStages, masterInputDb } = useMultiChannelSignal()
  const channelCount = useSignalStore((s) => s.channels.length)
  const result = masterStages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  const mixNote = channelCount === 1
    ? 'Single channel output'
    : `${channelCount} channels mixing here`

  return (
    <NodeWrapper nodeId={id} channelId="master" typeKey="master-bus" icon={<Network size={14} />} label="Master Bus">
      <div className="space-y-3">
        <SignalMeter db={masterInputDb} health={result.health} label="Channels summed" />
        <div
          className="rounded-lg px-2 py-2 text-center text-[10px]"
          style={{ background: 'var(--lsc-sunken)', color: 'var(--lsc-fg-dim)' }}
        >
          {mixNote}
          {channelCount > 1 && (
            <span className="block mt-0.5" style={{ color: 'var(--lsc-fg-fainter)' }}>
              Each doubling of channels adds ~3 dB
            </span>
          )}
        </div>
      </div>
    </NodeWrapper>
  )
}
