import { SOUND_PORT } from '../data/nodeRegistry'
import type { SignalEdge } from '../data/nodeRegistry'
import type { SignalDomain } from '../signal/levels'

// How a wire is drawn, by what it carries (the user's call, 2026-10-29): an analog cable an unbroken
// line, swells of light travelling along it (since 2026-10-31; components/AnalogWire.tsx), a digital one in dashes and dots like Morse code, and sound in
// the air as waves spreading straight to the microphone (components/SoundWaves.tsx). Its colour says
// where the sound goes (D24); its look, what kind of connection it is. A digital wire is all right
// angles — square dots, rectangular dashes, sharp corners —, a stereo one two such lines side by side
// (the user's call, 2026-10-31).

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

/**
 * A digital wire's dashes and dots (px at `unit` 1, a 3 px wire, square ends): a dash, two dots, a
 * dash, a dot — rectangles and squares, as sharp as the numbers they carry (the user's call, 2026-10-31)
 */
const MORSE = [11, 5, 3, 5, 3, 5, 11, 5, 3, 9]

/**
 * How fast every wire's movement goes, px a second at any zoom: an analog wire's swells, a digital
 * one's dashes (index.css signal-flow-digital: DIGITAL_FLOW px in 3 s) and sound's ripples (the
 * user's call, 2026-10-31: "consistent")
 */
export const FLOW_SPEED = 80

/** The px its flow animation moves the dashes in one loop (index.css signal-flow-digital) */
export const DIGITAL_FLOW = 240

/**
 * A digital wire's dash pattern, `unit` times its size at 100%, on a `width` px line (3 × `unit`
 * when not given): every dash and dot grows by what the line is wider, its gap shrinks by as much,
 * so a dot stays a square. At units 1, 2 and 4 its period divides DIGITAL_FLOW, so the flow loops
 * smoothly.
 */
export function morseDash(unit: number, width = 3 * unit): string {
  const wider = width - 3 * unit
  return MORSE.map((n, i) => n * unit + (i % 2 === 0 ? wider : -wider)).join(' ')
}

/** A digital wire's corners: right angles, no rounding (buildWirePath's radius) */
export const DIGITAL_CORNER = 0

/** One period of the Morse pattern at `unit` (px). */
export function morsePeriod(unit: number): number {
  return MORSE.reduce((a, b) => a + b, 0) * unit
}

/**
 * An analog wire is one unbroken line whose shades travel along it (the user's call, 2026-10-31:
 * option P, "cleaner is always better"): long soft swells of light, ANALOG_PERIOD px apart (zoomed
 * out twice that), moving FLOW_SPEED px a second. Each straight run carries them as a
 * repeating gradient the browser slides along (components/ChainEdge.tsx).
 */
export const ANALOG_PERIOD = 150

/** How light the wire is `u` of the way through a period (0 its darkest … 1 its lightest; the swell at 0) */
export function analogShade(u: number): number {
  return 0.08 + 0.8 * ((1 + Math.cos(2 * Math.PI * u)) / 2) ** 2
}

/** The gradient's stops over one period: where, and how light (analogShade) */
export const ANALOG_STOPS: readonly { offset: number; light: number }[] =
  Array.from({ length: 17 }, (_, i) => ({ offset: i / 16, light: analogShade(i / 16) }))

/**
 * A shade of a wire's colour (a CSS colour, its variable too): from its darkest (60 % of it, the
 * rest black) at 0 to its lightest (40 %, the rest white) at 1.
 */
export function shadeOf(color: string, light: number): string {
  return `color-mix(in srgb, color-mix(in srgb, ${color} 60%, black), color-mix(in srgb, ${color} 40%, white) ${Math.round(light * 100)}%)`
}
