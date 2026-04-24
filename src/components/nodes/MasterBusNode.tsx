import { Network } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { SignalMeter } from '../SignalMeter'
import { useSignalChain } from '../../hooks/useSignalChain'

export function MasterBusNode({ id }: { id: string }) {
  const { stages } = useSignalChain()
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }

  return (
    <NodeWrapper nodeId={id} icon={<Network size={14} />} label="Master Bus">
      <div className="space-y-3">
        <SignalMeter db={result.out} health={result.health} label="Channels summed" />
        <div
          className="rounded-lg px-2 py-2 text-center text-[10px]"
          style={{ background: 'var(--lsc-sunken)', color: 'var(--lsc-fg-dim)' }}
        >
          All channel signals combine here
        </div>
      </div>
    </NodeWrapper>
  )
}
