import { Volume2, VolumeX } from 'lucide-react'
import type { CardProps } from './cardProps'
import { BareOutput } from './BareOutput'
import type { OutputLook } from './BareOutput'

// Its icon: the palette's (NODE_LOOK) — crossed out with no amplifier before it
const PLAYS: OutputLook = { Icon: Volume2 }
const NO_AMP: OutputLook = { Icon: VolumeX, color: 'var(--signal-hot-text)' }

/**
 * Passive speaker: no card around it (D28) — its icon, its name, its meter in dB SPL (D13). It has
 * no amplifier inside: fed without an Amplifier before it, it stays silent, crossed out, and says
 * so; fed a digital signal it says so too (conditionText.tsx). A signal clipped on its way here
 * says "Bad sound" (`distorted`: its meter may be green); a hum from a ground loop shows too.
 */
export function SpeakerNode({ id }: CardProps) {
  return (
    <BareOutput
      id={id} typeKey="speaker"
      look={({ condition, verdict }) => condition === 'needsAmp' || verdict === 'needs-amp' ? NO_AMP : PLAYS}
    />
  )
}
