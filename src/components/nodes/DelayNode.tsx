import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { useParams } from '../../hooks/useParams'
import { ParamKnob } from '../controls/ParamKnob'
import { StableText } from '../controls/StableText'
import { DELAY_MAX_MS } from '../../data/nodeRegistry'

// A free-standing knob, big enough to read zoomed out — the Pan's size
const KNOB = 110

// A tenth of a millisecond a step, 400px of drag for the whole sweep (2px a step)
const STEP    = 0.1
const DRAG_PX = 400

const formatDelay = (ms: number) => `${ms.toFixed(1)} ms`

/**
 * The Delay knob (Advanced): holds the signal back 0 … DELAY_MAX_MS, its level unchanged. Two copies
 * of one signal a little apart in time no longer line up on a bus; with the Phase switch it lines
 * them up again (phase alignment) — real sound shows it (the render). Drawn as the Pan knob: a
 * bare knob in its light grey, its name and value under it.
 */
export function DelayNode({ id }: CardProps) {
  const p     = useParams(id, 'delay')
  const label = useNodeName(id, 'delay')

  return (
    <FreeControl
      nodeId={id}
      typeKey="delay"
      label={label}
      portLine={KNOB / 2}
      textScale={2}
      value={<StableText reserve={[formatDelay(DELAY_MAX_MS)]} align="center">{formatDelay(p('delayMs'))}</StableText>}
    >
      <ParamKnob
        nodeId={id}
        typeKey="delay"
        param="delayMs"
        min={0}
        max={DELAY_MAX_MS}
        step={STEP}
        dragPx={DRAG_PX}
        label={label}
        formatValue={formatDelay}
        color="var(--lsc-knob-pan)"
        size={KNOB}
        showReadout={false}
      />
    </FreeControl>
  )
}
