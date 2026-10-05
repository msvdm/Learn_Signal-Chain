import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { VerticalFader } from '../controls/VerticalFader'
import type { FaderTaper } from '../controls/VerticalFader'
import { StableText } from '../controls/StableText'
import { VerticalMeterPair } from '../SignalMeter'
import { useSignalStore } from '../../store/signalStore'
import { useStage } from '../../hooks/useGraphSignal'
import { useStereoLevels } from '../../hooks/useStereoLevels'
import { useParams } from '../../hooks/useParams'
import { FADER_MIN_DB, FADER_MAX_DB, FADER_MARKS, faderPosition, faderDbAt } from '../../utils/faderTaper'

// A free-standing fader, big enough to read zoomed out
const FADER_H     = 440
const FADER_SCALE = 2.4
// The track starts this far above the port line, so the wires meet it near the top, like a desk
const PORT_LINE   = 60

// A desk fader's uneven scale: fine steps around unity, the quiet end squeezed together
const TAPER: FaderTaper = { toPosition: faderPosition, fromPosition: faderDbAt }

const format = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} dB`

/**
 * A plain fader, or — wired straight after a stereo bus — the Main Fader: one handle for
 * the whole mix, with the bus's Left and Right outputs moved onto it (and L / R meters beside it).
 * Drawn as a bare fader (no card).
 */
export function FaderNode({ id }: CardProps) {
  const p                = useParams(id, 'fader')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const stage            = useStage(id)
  const levels           = useStereoLevels(id)

  const faderDb = p('faderDb')
  const main    = stage?.role === 'main-fader'

  return (
    <FreeControl
      nodeId={id}
      typeKey="fader"
      label={useNodeName(id, 'fader')}
      portLine={PORT_LINE}
      value={<StableText reserve={['−00.5 dB', '−100 dB']} align="center">{format(faderDb)}</StableText>}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <VerticalFader
          value={faderDb}
          min={FADER_MIN_DB}
          max={FADER_MAX_DB}
          taper={TAPER}
          marks={FADER_MARKS}
          formatValue={format}
          onChange={(v) => updateNodeParams(id, { faderDb: v })}
          height={FADER_H}
          scale={FADER_SCALE}
          showReadout={false}
          capColor={main ? 'red' : 'black'}
        />
        {main && <VerticalMeterPair l={levels.output.l} r={levels.output.r ?? levels.output.l} height={FADER_H} domain={levels.outDomain} />}
      </div>
    </FreeControl>
  )
}
