import type { NodeProps, Node } from '@xyflow/react'
import { MoveHorizontal } from 'lucide-react'
import { NodeWrapper } from './NodeWrapper'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { isNodeStereo } from '../../data/nodeRegistry'
import { KnobControl } from '../controls/KnobControl'
import { SignalMeter } from '../SignalMeter'

interface GraphPanData extends Record<string, unknown> {
  color?: string
  label?: string
}

function positionLabel(pos: number): string {
  if (pos <= 2)  return 'L'
  if (pos >= 98) return 'R'
  if (pos < 50)  return `L${50 - pos}`
  if (pos > 50)  return `R${pos - 50}`
  return 'C'
}

/**
 * Mono mode: Pan knob — one input spread over L / R (equal-power, −3 dB each side at centre).
 * Stereo mode: Balance knob — L / R in → L / R out, turning only fades the opposite side.
 */
export function PanNode({ id, data }: NodeProps<Node<GraphPanData>>) {
  const { portSignal, stages } = useGraphSignal()
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()

  const balance     = node ? isNodeStereo(node) : false
  const panPosition = (node?.params.panPosition as number) ?? 50
  const outL = portSignal.get(`${id}:out-l`) ?? -Infinity
  const outR = portSignal.get(`${id}:out-r`) ?? -Infinity
  const out  = stages[id]?.out ?? -Infinity

  const label = balance
    ? (t.nodes.pan?.balanceLabel ?? 'Balance')
    : (t.nodes.pan?.label ?? 'Pan')

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="pan"
      icon={<MoveHorizontal size={16} />}
      label={data.label ?? label}
    >
      {/* 0 = full left, 50 = centre, 100 = full right */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <KnobControl
          value={panPosition}
          min={0}
          max={100}
          step={1}
          label="L ← → R"
          formatValue={positionLabel}
          onChange={(v) => updateNodeParams(id, { panPosition: v })}
          color="var(--lsc-accent)"
          size={48}
        />
      </div>

      <SignalMeter db={outL} dbR={outR} health={getHealth(out)} label={t.meters.output} showValue={false} />
    </NodeWrapper>
  )
}
