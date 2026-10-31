import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { KnobControl } from '../controls/KnobControl'
import { StableText } from '../controls/StableText'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { useStage } from '../../hooks/useGraphSignal'
import { GAIN_OFF_DB } from '../../signal/gains'
import { widestFormat } from '../../utils/readout'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { louder } from '../../signal/levels'
import { MeterBars, STRIP_W } from '../SignalMeter'
import { Readings } from './BareMeter'

// A free-standing knob, big enough to read zoomed out
const KNOB = 110

// Its meter's height: from the knob's top to the bottom of its reading
const METER_H = 220

const formatPreamp = (v: number) => `+${v} dB`
const formatGain   = (v: number) => (v <= GAIN_OFF_DB ? '−∞' : `${v > 0 ? '+' : ''}${v} dB`)

/**
 * Right after a microphone (effects such as a Pad may sit in between) this is the Preamp:
 * 0…+60 dB to lift mic level up to line level. Anywhere else it is a plain gain stage:
 * −∞…+20 dB, turning any signal up or down. Each mode keeps its own setting.
 * Drawn as a bare knob (no card), its meter on its right — what leaves it, as a desk's input meter
 * after the Preamp: the sources have none (D34) — and under its name the Peak, RMS, Noise and
 * health word (Readings). It is there from Intermediate only, where the meters are real (D20).
 */
export function GainNode({ id }: CardProps) {
  const p                = useParams(id, 'gain')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const stage            = useStage(id)

  const preamp = stage?.role === 'preamp'
  const label  = useNodeName(id, 'gain')

  const knob = preamp
    ? { param: 'preampDb', value: p('preampDb'), min: 0, max: 60, format: formatPreamp }
    : { param: 'gainDb', value: p('gainDb'), min: GAIN_OFF_DB, max: 20, format: formatGain }

  return (
    <FreeControl
      nodeId={id}
      typeKey="gain"
      label={label}
      portLine={KNOB / 2}
      textScale={2}
      beside={<GainMeter id={id} />}
      footer={<GainReadings id={id} />}
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
        color="var(--lsc-accent)"
        size={KNOB}
        showReadout={false}
      />
    </FreeControl>
  )
}

/**
 * The upright meter beside the knob: what leaves it (L and R bars for a stereo signal), no frame —
 * as wide in mono as in stereo, so the knob never moves
 */
function GainMeter({ id }: { id: string }) {
  const m = useStereoLevels(id).output
  return (
    <div style={{ width: STRIP_W, height: METER_H, display: 'flex', justifyContent: 'center' }}>
      <MeterBars l={m.l} r={m.r} domain={m.domain} nodeId={id} at="out" moving />
    </div>
  )
}

/** Its Peak, RMS, Noise and health word, under its name (a stereo signal's louder side) */
function GainReadings({ id }: { id: string }) {
  const m = useStereoLevels(id).output
  return <Readings nodeId={id} domain={m.domain} out={m.r ? louder(m.l, m.r) : m.l} health={m.health} />
}
