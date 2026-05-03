import type { NodeProps, Node } from '@xyflow/react'
import { MoveHorizontal } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { getHealthStyle } from '../../hooks/useGainStaging'
import { useSignalStore } from '../../store/signalStore'
import { ControlSlider } from './ControlSlider'

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

  const pos    = (node?.params.balancePosition as number) ?? 50
  const result = stages[id] ?? { out: -Infinity, health: 'too-quiet' as const }
  const outL   = portSignal.get(`${id}:out-l`) ?? result.out
  const outR   = portSignal.get(`${id}:out-r`) ?? result.out

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="balance"
      icon={<MoveHorizontal size={14} />}
      label={data.label ?? 'Balance'}
    >
      <div className="space-y-3">
        {/* Balance slider — 0 = full L, 50 = centre, 100 = full R */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 8, color: 'var(--lsc-text)', opacity: 0.6 }}>L</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--lsc-accent)' }}>
              {balanceLabel(pos)}
            </span>
            <span style={{ fontSize: 8, color: 'var(--lsc-text)', opacity: 0.6 }}>R</span>
          </div>
          <ControlSlider
            value={pos}
            min={0}
            max={100}
            step={1}
            label=""
            onChange={(v) => updateNodeParams(id, { balancePosition: v })}
            formatValue={(v) => balanceLabel(v)}
          />
        </div>

        {/* L / R output levels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {([['L', outL], ['R', outR]] as [string, number][]).map(([ch, sig]) => (
            <div key={ch} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: isFinite(sig) ? getHealthStyle(getHealth(sig)).color : 'var(--lsc-text)' }}>
                {ch}
              </span>
              <span style={{ fontSize: 8, fontFamily: 'var(--lsc-font-mono)', color: isFinite(sig) ? getHealthStyle(getHealth(sig)).color : 'var(--lsc-text)' }}>
                {isFinite(sig) ? `${sig.toFixed(1)}` : '−∞'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </NodeWrapper>
  )
}
