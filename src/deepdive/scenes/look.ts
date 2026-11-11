// The colours a Deep dive scene is drawn in (D46): the app's own, by what they show — and the
// stage's shared filters and arrow heads.

/** What is drawn in ink: the particles of air, a string, a cone, a wire */
export const INK    = 'var(--lsc-fg)'
/** The parts of a device, in three greys */
export const PART   = 'var(--lsc-fg-dim)'
export const PART_2 = 'var(--lsc-fg-muted)'
export const PART_3 = 'var(--lsc-fg-fainter)'
export const FAINT  = 'var(--lsc-border)'
/** What starts the movement and what marks the phase: the light blue of the Parametric equalizer's first band (the transport bar keeps the app's purple) */
export const MOVER  = 'var(--lsc-phase)'
/** The air itself, as a haze */
export const AIR    = 'var(--lsc-phase)'
/** Which way something travels: a speed, a wave's direction, a nerve's pulse */
export const FLOW   = 'var(--lsc-eq-mid)'
/** A signal drawn over time — the logo's green wave, a good signal's green */
export const TRACE  = 'var(--signal-good)'

/** The stage's shared filters and arrow heads (DeepDiveView draws them once) */
export const CLOUD      = 'url(#lsc-dd-cloud)'
export const CLOUD_MASK = 'url(#lsc-dd-cloud-mask)'
export const ARROW      = 'url(#lsc-dd-arrow)'
export const ARROW_INK  = 'url(#lsc-dd-arrow-ink)'
