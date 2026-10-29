import { SOUND_PORT } from '../data/nodeRegistry'
import type { SignalEdge } from '../data/nodeRegistry'
import type { SignalDomain } from '../signal/levels'

// How a wire is drawn, by what it carries (the user's call, 2026-10-29): an analog cable in dashes
// (index.css signal-line-animated), a digital one in dashes and dots like Morse code, and sound in
// the air as waves spreading straight to the microphone (components/SoundWaves.tsx). Its colour says
// where the sound goes (D24); its look, what kind of connection it is.

export type WireLook = 'analog' | 'digital' | 'sound'

/**
 * What a wire carries: sound in the air (from a Sound output, into a microphone); digital, where its
 * output sends numbers (`domain`: the engine's — after a converter, a DAW, a Decoder) or it is a USB
 * wire (`usb`: known from the wiring alone, at Beginner too); else an analog signal.
 */
export function wireLook(edge: Pick<SignalEdge, 'sourceHandle'>, domain: SignalDomain, usb: boolean): WireLook {
  if (edge.sourceHandle === SOUND_PORT) return 'sound'
  return usb || domain === 'digital' ? 'digital' : 'analog'
}

/** A digital wire's dashes and dots (px at `unit` 1, a 3 px wire): a dash, two dots, a dash, a dot */
const MORSE = [8, 8, 0, 8, 0, 8, 8, 8, 0, 12]

/** The px its flow animation moves the dashes in one loop (index.css signal-flow-digital) */
export const DIGITAL_FLOW = 240

/**
 * A digital wire's dash pattern, `unit` times its size at 100% (a dot is a dash of 0 with round
 * ends). At units 1, 2 and 4 its period divides DIGITAL_FLOW, so the flow loops smoothly.
 */
export function morseDash(unit: number): string {
  return MORSE.map((n) => n * unit).join(' ')
}

/** One period of the Morse pattern at `unit` (px). */
export function morsePeriod(unit: number): number {
  return MORSE.reduce((a, b) => a + b, 0) * unit
}
