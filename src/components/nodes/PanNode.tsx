import type { NodeProps, Node } from '@xyflow/react'
import { MoveHorizontal } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { getHealthStyle } from '../../hooks/useGainStaging'
import { KnobControl } from '../controls/KnobControl'

interface GraphPanData extends Record<string, unknown> {
  color?: string
  label?: string
}

function panLabel(pos: number): string {
  if (pos <= 2)  return 'L'
  if (pos >= 98) return 'R'
  if (pos < 50)  return `L${50 - pos}`
  if (pos > 50)  return `R${pos - 50}`
  return 'C'
}

export function PanNode({ id, data }: NodeProps<Node<GraphPanData>>) {
  const { portSignal }   = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const panPosition = (node?.params.panPosition as number) ?? 50
  const outL = portSignal.get(`${id}:out-l`) ?? -Infinity
  const outR = portSignal.get(`${id}:out-r`) ?? -Infinity

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="pan"
      icon={<MoveHorizontal size={16} />}
      label={data.label ?? t.nodes.pan?.label ?? 'Pan'}
    >
      {/* Pan knob: 0 = full left, 50 = centre, 100 = full right */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <KnobControl
          value={panPosition}
          min={0}
          max={100}
          step={1}
          label="L ← → R"
          formatValue={panLabel}
          onChange={(v) => updateNodeParams(id, { panPosition: v })}
          color="var(--lsc-accent)"
          size={48}
        />
      </div>

      {/* L / R output levels */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {([['L', outL], ['R', outR]] as [string, number][]).map(([ch, sig]) => {
          const color = isFinite(sig) ? getHealthStyle(getHealth(sig)).color : 'var(--lsc-fg-muted)'
          return (
            <div key={ch} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 'var(--node-text-sm)', fontWeight: 700, color }}>{ch}</span>
              <span style={{ fontSize: 'var(--node-text-sm)', fontFamily: 'var(--lsc-font-mono)', color }}>
                {isFinite(sig) ? `${sig.toFixed(1)}` : '−∞'}
              </span>
            </div>
          )
        })}
      </div>
    </NodeWrapper>
  )
}
