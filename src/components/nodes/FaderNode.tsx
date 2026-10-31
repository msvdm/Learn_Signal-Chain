import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { VerticalFader } from '../controls/VerticalFader'
import type { FaderTaper } from '../controls/VerticalFader'
import { StableText } from '../controls/StableText'
import { useSignalStore } from '../../store/signalStore'
import { useStage } from '../../hooks/useGraphSignal'
import { useParams } from '../../hooks/useParams'
import { faderBusOf } from '../../graph/queries'
import { FADER_MIN_DB, FADER_MAX_DB, FADER_MARKS, faderPosition, faderDbAt } from '../../utils/faderTaper'

// A free-standing fader, its cap as tall as a free-standing knob is wide and the On Off Switch's button
// (GainNode's KNOB, SwitchNode's BUTTON: 110 px — the user's calls, 2026-10-31: the same shape, only its
// size): every part scaled alike
const SIZE        = 110 / 34 / 2.4
const FADER_H     = Math.round(440 * SIZE)
const FADER_SCALE = 2.4 * SIZE
// The track starts this far above the port line, so the wires meet it near the top, like a desk
const PORT_LINE   = Math.round(60 * SIZE)

// A desk fader's uneven scale: fine steps around unity, the quiet end squeezed together
const TAPER: FaderTaper = { toPosition: faderPosition, fromPosition: faderDbAt }

// All the way down: −∞, the signal muted
const format = (v: number) => (v <= FADER_MIN_DB ? '−∞' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} dB`)

/**
 * A plain fader (its cap black, white on the dark theme), or — wired straight after a stereo
 * bus — the Main Fader: one handle for the whole mix, with the bus's Left and Right outputs moved
 * onto it (its cap red). An Aux Bus's fader is blue, mono or stereo; a Matrix Bus's magenta.
 * Drawn as a bare fader (no card).
 */
export function FaderNode({ id }: CardProps) {
  const p                = useParams(id, 'fader')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const stage            = useStage(id)

  const faderDb = p('faderDb')
  const main    = stage?.role === 'main-fader'
  // An Aux Bus's fader is blue, mono or stereo (a stereo one is its Main Fader too); a Matrix Bus's magenta
  const bus     = useSignalStore((s) => faderBusOf(id, s)?.typeKey)
  const cap     = bus === 'aux-bus' ? 'blue' : bus === 'matrix-bus' ? 'magenta' : main ? 'red' : 'plain'

  return (
    <FreeControl
      nodeId={id}
      typeKey="fader"
      label={useNodeName(id, 'fader')}
      portLine={PORT_LINE}
      value={<StableText reserve={['−00.5 dB', '−98 dB']} align="center">{format(faderDb)}</StableText>}
    >
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
        capColor={cap}
      />
    </FreeControl>
  )
}
