// Icons lucide does not have (24 × 24). See nodeLook.ts.
import { useId } from 'react'

/**
 * A jack plug (Line Input): tip, ring and sleeve, the handle and its cable — filled, tilted with the
 * tip up-left. Drawn upright, then turned.
 */
export function JackPlugIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" stroke="none">
      <g transform="rotate(-45 12 12)">
        <path d="M10.2 1.85V0.45A1.8 1.8 0 0 1 13.8 0.45V1.85Z" />
        <rect x="10.2" y="3.15" width="3.6" height="2.3" />
        <path d="M10.2 6.75H13.8V11.35H15.4V16.35A3.4 3.4 0 0 1 8.6 16.35V11.35H10.2Z" />
        <path d="M11.05 18.75H12.95V25.8A0.95 0.95 0 0 1 11.05 25.8Z" />
      </g>
    </svg>
  )
}

/** A high-pass filter's response: flat, rolling off at the low end. Wider than tall. */
export function HighPassIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.7)} viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M3 13 C3 1 9 1 12 1 L22 1" />
    </svg>
  )
}

/**
 * A dynamics card's transfer curve (level in → level out) in a rounded frame, the way the
 * graphs on the cards and in manuals draw it: `d` is the curve, from the bottom edge to the right.
 */
function TransferIcon({ size = 24, d }: { size?: number; d: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="3" />
      <path d={d} />
    </svg>
  )
}

/** Noise Gate: nothing below the threshold (a straight drop), then the signal passes. */
export function GateIcon({ size }: { size?: number }) {
  return <TransferIcon size={size} d="M10 21V12L22 6.5" />
}

/** Compressor: one-to-one up to the threshold, then a gentler slope. */
export function CompressorIcon({ size }: { size?: number }) {
  return <TransferIcon size={size} d="M2.9 20.1L12 10L22 6.5" />
}

/** Limiter: one-to-one up to the ceiling, then flat — nothing gets past it. */
export function LimiterIcon({ size }: { size?: number }) {
  return <TransferIcon size={size} d="M2.9 20.1L12 10H22" />
}

/** A rotary knob (Gain): one circle and its pointer, a line from the centre. */
export function KnobIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12L17.3 6.7" />
    </svg>
  )
}

/** A guitar amp (combo): a cabinet with a row of knobs on top and a grille of thin crossed lines. */
export function GuitarAmpIcon({ size = 24 }: { size?: number }) {
  const clip = useId()
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <clipPath id={clip}><rect x="4" y="9" width="16" height="11" /></clipPath>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 8h18" />
      <path d="M6.5 5.5h.01M9.5 5.5h.01M12.5 5.5h.01" />
      {/* The grille: diagonals both ways, 2 apart, cut to the front panel */}
      <path d={GRILLE} strokeWidth="0.3" clipPath={`url(#${clip})`} />
    </svg>
  )
}

const GRILLE = Array.from({ length: 15 }, (_, i) => {
  const x = i * 2 - 9
  return `M${x} 21L${x + 13} 8M${x + 13} 21L${x} 8`
}).join('')

/**
 * An electric guitar (Instrument): a single-cut body, three pickups and two knobs, a long neck up to
 * the right ending in a one-sided triangle — one edge carrying on from the neck's, the tuning pegs
 * along the other. Drawn upright round (0, 0), then turned.
 */
export function GuitarIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="-15.5 -15.5 31 31" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <g transform="translate(0.96 -1.28) rotate(45)">
        {/* Body, from the neck's left side round to its right, the cutaway last: the same either side
            of the neck's line but for the cutaway, so it never looks crooked */}
        <path d="M-0.9 -0.2C-3.2 -1.4 -5.6 0.6 -5.6 3.2C-5.6 5 -4.8 6.2 -4.8 7.4C-4.8 8.6 -7.6 10 -7.6 12.6C-7.6 15.8 -4.2 18 0 18C4.2 18 7.6 15.8 7.6 12.6C7.6 10 4.8 8.6 4.8 7.4C4.8 5.6 5.6 2.2 4.2 1.4C3 0.7 1.8 2.6 0.9 3.8" />
        {/* Neck, its end on the body */}
        <path d="M-0.9 8.4V-9.6H0.9V8.4Z" />
        {/* Headstock: a one-sided triangle, its tuning pegs along the slope */}
        <path d="M-0.9 -9.6L-3 -11.4L0.9 -18.4V-9.6" />
        <path d="M-2.3 -12.66L-3.26 -13.2M-1.48 -14.13L-2.44 -14.67M-0.66 -15.6L-1.62 -16.14M0.16 -17.07L-0.8 -17.61" />
        {/* Three pickups, across the neck's line */}
        <path d="M-1.6 9.8H1.6M-1.6 11.8H1.6M-1.6 13.8H1.6" />
        {/* Volume and tone knobs */}
        <path d="M2.2 15.6h.01M3.9 14.5h.01" strokeWidth="1.8" />
      </g>
    </svg>
  )
}

/** A dull tone: flat, then the high notes falling away (an instrument without a DI Box). Wider than tall. */
export function DullToneIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.6)} viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M2 3 L12 3 C17 3 19 8 22 12" />
    </svg>
  )
}

/** A signal generator: a circle with a sine wave inside, the way circuit drawings show one. */
export function GeneratorIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M5 12C6.8 6 10.2 6 12 12S17.2 18 19 12" />
    </svg>
  )
}

// What a sound looks like over time, for the buttons that pick one (the Generator's Sound). Wider
// than tall (24 × 14).

function SoundPicture({ size = 24, d }: { size?: number; d: string }) {
  return (
    <svg width={size} height={Math.round(size * 14 / 24)} viewBox="0 0 24 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

/** A steady tone: an even wave, its peaks barely above its average. */
export function SineIcon({ size }: { size?: number }) {
  return <SoundPicture size={size} d="M2 7C3.7 1.5 5.3 1.5 7 7S10.3 12.5 12 7S15.3 1.5 17 7S20.3 12.5 22 7" />
}

/** Hiss: a wave with no pattern. */
export function NoiseIcon({ size }: { size?: number }) {
  return <SoundPicture size={size} d="M2 8L3.5 4L5 10L6.5 2.5L8 11L9.5 5L11 12L12.5 3L14 9.5L15.5 1.5L17 10.5L18.5 4.5L20 11.5L22 6" />
}

/** Clicks: short pulses with silence between them. */
export function ClickIcon({ size }: { size?: number }) {
  return <SoundPicture size={size} d="M2 12H5L6 2L7 12H11L12 2L13 12H17L18 2L19 12H22" />
}

// The converters, as their symbol is drawn: a box cut by a diagonal, a wave (analog) in one half
// and a line over a dashed line (digital) in the other — what comes in at the top left, what goes
// out at the bottom right.

/** A wave from `x`, `y` (its start; 8.4 wide): up, then down. */
const wave = (x: number, y: number) => {
  const at = (dx: number, dy: number) => `${(x + dx * 0.923).toFixed(2)} ${(y + dy).toFixed(2)}`
  return `M${at(0, 0)}C${at(0.6, -0.8)} ${at(1.3, -1.3)} ${at(2.1, -1.3)}C${at(3.2, -1.3)} ${at(3.9, -0.6)} ${at(4.6, 0)}`
    + `S${at(6, 1.2)} ${at(7.1, 1.2)}C${at(7.9, 1.2)} ${at(8.6, 0.7)} ${at(9.1, 0)}`
}

/** The digital mark from `x`, `y` (6.7 wide): a line, and a dashed line under it — gaps as wide as the lines. */
const digital = (x: number, y: number) => `M${x} ${y}H${x + 6.7}M${x} ${y + 3.2}H${x + 2.55}M${x + 4.15} ${y + 3.2}H${x + 6.7}`

function ConverterIcon({ size = 24, inside }: { size?: number; inside: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="3" />
      <path d={`M20.5 3.5L3.5 20.5${inside}`} />
    </svg>
  )
}

/** Analog to Digital Converter: a wave in, the digital mark out. */
export function AdcIcon({ size }: { size?: number }) {
  return <ConverterIcon size={size} inside={`${wave(4.4, 6.8)}${digital(12.4, 14.6)}`} />
}

/** Digital to Analog Converter: the digital mark in, a wave out. */
export function DacIcon({ size }: { size?: number }) {
  return <ConverterIcon size={size} inside={`${digital(4.8, 5.4)}${wave(11, 17)}`} />
}

/** A relay switch's symbol (the Relay Switch): two inputs with their contacts, the arm on the top one, the output. */
export function RelayIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1.5 7.5H7.2M1.5 16.5H7.2M16.8 12H22.5M15.4 10.9L10.2 7.9" />
      <circle cx="8.8" cy="7.5" r="1.6" />
      <circle cx="8.8" cy="16.5" r="1.6" />
      <circle cx="15.2" cy="12" r="1.6" />
    </svg>
  )
}
