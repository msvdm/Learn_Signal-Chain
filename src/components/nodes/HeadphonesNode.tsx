import { HeadphoneOff, Headphones } from 'lucide-react'
import type { CardProps } from './cardProps'
import { BareOutput } from './BareOutput'
import type { OutputLook } from './BareOutput'

// Its icon: the palette's (NODE_LOOK) — red when blown, crossed out with no Gain before it
const PLAYS: OutputLook   = { Icon: Headphones }
const BLOWN: OutputLook   = { Icon: Headphones, color: 'var(--signal-clipping-text)' }
const NO_GAIN: OutputLook = { Icon: HeadphoneOff, color: 'var(--signal-hot-text)' }

/**
 * Headphones: no card around them (D28) — their icon, their name, their meter in dB SPL (D13). No
 * knob of their own: a Gain right before them sets their level, and with none they are silent,
 * crossed out ('needsGain'); fed from an Amplifier they blow (red). What is wrong is said under
 * the icon (conditionText.tsx), a bad sound or a hum too.
 */
export function HeadphonesNode({ id }: CardProps) {
  return (
    <BareOutput
      id={id} typeKey="headphones"
      look={({ condition }) => condition === 'blown' ? BLOWN : condition === 'needsGain' ? NO_GAIN : PLAYS}
    />
  )
}
