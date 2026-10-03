import type { NodeProps, Node } from '@xyflow/react'
import { FreeControl } from './FreeControl'
import { KnobControl } from '../controls/KnobControl'
import { StableText } from '../controls/StableText'
import { useSignalStore } from '../../store/signalStore'
import { useGraphSignal, GAIN_OFF_DB } from '../../hooks/useSignalChain'
import { useTranslation } from '../../i18n/useTranslation'
import { widestFormat } from '../../utils/readout'

interface GraphGainData extends Record<string, unknown> {
  color?: string
  label?: string
}

// A free-standing knob, big enough to read zoomed out
const KNOB = 110

const formatPreamp = (v: number) => `+${v} dB`
const formatGain   = (v: number) => (v <= GAIN_OFF_DB ? '−∞' : `${v > 0 ? '+' : ''}${v} dB`)

/**
 * Right after a microphone (effects such as a Pad may sit in between) this is the Preamp:
 * 0…+60 dB to lift mic level up to line level. Anywhere else it is a plain gain stage:
 * −∞…+20 dB, turning any signal up or down. Each mode keeps its own setting.
 * Drawn as a bare knob (no card).
 */
export function GainNode({ id, data }: NodeProps<Node<GraphGainData>>) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { stages }       = useGraphSignal()
  const { t }            = useTranslation()

  const preamp = stages[id]?.preamp ?? false
  const label  = data.label ?? (preamp ? t.nodes.preamp.label : t.palette.items.gain)

  const knob = preamp
    ? { param: 'preampDb', value: (node?.params.preampDb as number) ?? 40, min: 0, max: 60, format: formatPreamp }
    : { param: 'gainDb', value: (node?.params.gainDb as number) ?? 0, min: GAIN_OFF_DB, max: 20, format: formatGain }

  return (
    <FreeControl
      nodeId={id}
      typeKey="gain"
      label={label}
      portLine={KNOB / 2}
      value={
        <StableText reserve={[widestFormat(knob.min, knob.max, 1, knob.format)]} align="center">
          {knob.format(knob.value)}
        </StableText>
      }
    >
      <KnobControl
        key={knob.param}
        value={knob.value}
        min={knob.min}
        max={knob.max}
        label={label}
        formatValue={knob.format}
        onChange={(v) => updateNodeParams(id, { [knob.param]: v })}
        color="var(--signal-good)"
        size={KNOB}
        showReadout={false}
      />
    </FreeControl>
  )
}
