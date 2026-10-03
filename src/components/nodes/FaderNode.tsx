import type { NodeProps, Node } from '@xyflow/react'
import { FreeControl } from './FreeControl'
import { VerticalFader } from '../controls/VerticalFader'
import { StableText } from '../controls/StableText'
import { VerticalMeterPair } from '../SignalMeter'
import { useSignalStore } from '../../store/signalStore'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useTranslation } from '../../i18n/useTranslation'
import { widestFormat } from '../../utils/readout'

interface GraphFaderData extends Record<string, unknown> {
  color?: string
  label?: string
}

// A free-standing fader, big enough to read zoomed out
const FADER_H     = 260
const FADER_SCALE = 2
// The track starts this far above the port line, so the wires meet it near the top, like a desk
const PORT_LINE   = 60

const MIN = -80
const MAX = 10
const format = (v: number) => (v <= MIN ? '−∞' : `${v > 0 ? '+' : ''}${v} dB`)

/**
 * A plain fader, or — wired straight after a stereo bus — the Main Fader: one handle for
 * the whole mix, with the bus's Left and Right outputs moved onto it (and L / R meters beside it).
 * Drawn as a bare fader (no card).
 */
export function FaderNode({ id, data }: NodeProps<Node<GraphFaderData>>) {
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === id))
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { stages }       = useGraphSignal()
  const levels           = useStereoLevels(id)
  const { t }            = useTranslation()

  const faderDb = (node?.params.faderDb as number) ?? 0
  const main    = stages[id]?.mainFader ?? false

  return (
    <FreeControl
      nodeId={id}
      typeKey="fader"
      label={data.label ?? (main ? t.nodes['main-fader'].label : t.nodes.fader.label)}
      portLine={PORT_LINE}
      value={<StableText reserve={[widestFormat(MIN, MAX, 1, format)]} align="center">{format(faderDb)}</StableText>}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <VerticalFader
          value={faderDb}
          min={MIN}
          max={MAX}
          step={1}
          formatValue={format}
          onChange={(v) => updateNodeParams(id, { faderDb: v })}
          height={FADER_H}
          scale={FADER_SCALE}
          showReadout={false}
        />
        {main && <VerticalMeterPair dbL={levels.out} dbR={levels.outR ?? levels.out} height={FADER_H} />}
      </div>
    </FreeControl>
  )
}
