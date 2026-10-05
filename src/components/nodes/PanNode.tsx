import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useStage } from '../../hooks/useGraphSignal'
import { KnobControl } from '../controls/KnobControl'
import { StableText } from '../controls/StableText'
import { ChannelRow } from '../SignalMeter'

// A free-standing knob, big enough to read zoomed out
const KNOB = 110

function positionLabel(pos: number): string {
  if (pos <= 2)  return 'L'
  if (pos >= 98) return 'R'
  if (pos < 50)  return `L${50 - pos}`
  if (pos > 50)  return `R${pos - 50}`
  return 'C'
}

/**
 * Always sends out a stereo wire.
 * Mono wire in: Pan knob — spreads it over L / R (equal-power, −3 dB each side at centre).
 * Stereo wire in: Balance knob — turning only fades the opposite side.
 * Drawn as a bare knob (no card) with a slim L / R meter under it.
 */
export function PanNode({ id }: CardProps) {
  const stage            = useStage(id)
  const p                = useParams(id, 'pan')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)

  const panPosition = p('panPosition')

  const label = useNodeName(id, 'pan')

  return (
    <FreeControl
      nodeId={id}
      typeKey="pan"
      label={label}
      portLine={KNOB / 2}
      value={<StableText reserve={['L50', 'R50']} align="center">{positionLabel(panPosition)}</StableText>}
      footer={
        <div style={{ width: 180, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <ChannelRow ch="L" db={stage?.out.l ?? -Infinity} />
          <ChannelRow ch="R" db={stage?.out.r ?? -Infinity} />
        </div>
      }
    >
      {/* 0 = full left, 50 = centre, 100 = full right */}
      <KnobControl
        value={panPosition}
        min={0}
        max={100}
        step={1}
        label="L ← → R"
        formatValue={positionLabel}
        onChange={(v) => updateNodeParams(id, { panPosition: v })}
        color="var(--lsc-accent)"
        size={KNOB}
        showReadout={false}
      />
    </FreeControl>
  )
}
