import type { CardProps } from './cardProps'
import { useNodeName } from '../../hooks/useNodeName'
import { FreeControl } from './FreeControl'
import { VerticalFader } from '../controls/VerticalFader'
import type { FaderTaper } from '../controls/VerticalFader'
import { StableText } from '../controls/StableText'
import { useSignalStore } from '../../store/signalStore'
import { useStage } from '../../hooks/useGraphSignal'
import { useParams } from '../../hooks/useParams'
import { FADER_MIN_DB, FADER_MAX_DB, FADER_MARKS, faderPosition, faderDbAt } from '../../utils/faderTaper'

// A free-standing fader, big enough to read zoomed out
const FADER_H     = 440
const FADER_SCALE = 2.4
// The track starts this far above the port line, so the wires meet it near the top, like a desk
const PORT_LINE   = 60

// A desk fader's uneven scale: fine steps around unity, the quiet end squeezed together
const TAPER: FaderTaper = { toPosition: faderPosition, fromPosition: faderDbAt }

// All the way down: −∞, the signal muted
const format = (v: number) => (v <= FADER_MIN_DB ? '−∞' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} dB`)

/**
 * A plain fader, or — wired straight after a stereo bus — the Main Fader: one handle for
 * the whole mix, with the bus's Left and Right outputs moved onto it (its cap red).
 * Drawn as a bare fader (no card).
 */
export function FaderNode({ id }: CardProps) {
  const p                = useParams(id, 'fader')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const stage            = useStage(id)

  const faderDb = p('faderDb')
  const main    = stage?.role === 'main-fader'

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
        capColor={main ? 'red' : 'black'}
      />
    </FreeControl>
  )
}
