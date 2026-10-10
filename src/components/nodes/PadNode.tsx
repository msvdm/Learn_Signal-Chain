import type { CardProps } from './cardProps'
import { useTranslation } from '../../i18n/useTranslation'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { NamedButton } from './NamedButton'

/**
 * Pad: turns the signal down by 20 dB while it is on (a passive circuit: no hiss of its own), for a
 * microphone too loud for the Preamp — "−20 dB" lit while on, "OFF" when not.
 */
export function PadNode({ id }: CardProps) {
  const p                = useParams(id, 'pad')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()
  const engaged = p('engaged')
  return <NamedButton id={id} typeKey="pad" on={engaged} tone="hot" words={t.nodes.pad} onToggle={() => updateNodeParams(id, { engaged: !engaged })} />
}

/**
 * Phantom power: "48V", lit red while on (a desk's 48V light), greyed out when off. It passes the signal on unchanged; a
 * condenser microphone before it (ahead of the Preamp) gets its power from it — without, it sends
 * nothing (D21).
 */
export function PhantomNode({ id }: CardProps) {
  const p                = useParams(id, 'phantom')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const { t }            = useTranslation()
  const on   = p('on')
  const word = t.nodes.phantom.button
  return <NamedButton id={id} typeKey="phantom" on={on} tone="clipping" words={{ on: word, off: word }} onToggle={() => updateNodeParams(id, { on: !on })} />
}
