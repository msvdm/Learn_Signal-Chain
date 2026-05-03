import type { NodeProps, Node } from '@xyflow/react'
import { MoveHorizontal } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { getHealthStyle } from '../../hooks/useGainStaging'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { KnobControl } from '../controls/KnobControl'

interface BalanceData extends Record<string, unknown> {
  color?: string
  label?: string
}

function balanceLabel(pos: number): string {
  if (pos <= 2)  return 'L'
  if (pos >= 98) return 'R'
  if (pos === 50) return 'C'
  if (pos < 50)  return `L${50 - pos}`
  return `R${pos - 50}`
}

export function BalanceNode({ id, data }: NodeProps<Node<BalanceData>>) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { stages, portSignal } = useGraphSignal()
  const { t }            = useTranslation()

  const pos    = (node?.params.balancePosition as number) ?? 50
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const outL   = portSignal.get(`${id}:out-l`) ?? result.out
  const outR   = portSignal.get(`${id}:out-r`) ?? result.out

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="balance"
      icon={<MoveHorizontal size={14} />}
      label={data.label ?? t.nodes.balance?.label ?? 'Balance'}
    >
      <div className="space-y-3">
        {/* Balance knob — 0 = full L, 50 = centre, 100 = full R */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <KnobControl
            value={pos}
            min={0}
            max={100}
            step={1}
            label="L ← → R"
            formatValue={balanceLabel}
            onChange={(v) => updateNodeParams(id, { balancePosition: v })}
            color="var(--lsc-accent)"
            size={44}
          />
        </div>

        {/* L / R output levels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {([['L', outL], ['R', outR]] as [string, number][]).map(([ch, sig]) => (
            <div key={ch} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--node-text-xs)', fontWeight: 700, color: isFinite(sig) ? getHealthStyle(getHealth(sig)).color : 'var(--lsc-text)' }}>
                {ch}
              </span>
              <span style={{ fontSize: 'var(--node-text-2xs)', fontFamily: 'var(--lsc-font-mono)', color: isFinite(sig) ? getHealthStyle(getHealth(sig)).color : 'var(--lsc-text)' }}>
                {isFinite(sig) ? `${sig.toFixed(1)}` : '−∞'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </NodeWrapper>
  )
}
