// Icons lucide does not have (24 × 24). See nodeLook.ts.
import { useId } from 'react'

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

/**
 * A voice (the Vocal): a head in profile, speaking — three waves leave its open mouth. Drawn after
 * the user's picture, in a thinner line than the other icons (their call); drawn small (the palette,
 * a header) a little heavier, or the line fades.
 */
export function VocalIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={size < 24 ? 1.5 : 1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.03 20.25L3.55 20.25C3.6 19.87 3.84 18.66 3.89 17.97C3.93 17.28 3.93 16.7 3.82 16.1C3.71 15.5 3.62 15.26 3.23 14.39C2.85 13.52 1.83 11.66 1.5 10.87C1.17 10.09 1.28 10.1 1.25 9.7C1.22 9.31 1.23 8.87 1.3 8.51C1.36 8.14 1.49 7.83 1.63 7.52C1.78 7.2 1.96 6.89 2.15 6.62C2.34 6.34 2.52 6.12 2.76 5.87C3 5.63 3.31 5.36 3.59 5.15C3.87 4.94 4.14 4.78 4.45 4.61C4.76 4.45 5.12 4.28 5.44 4.16C5.76 4.04 6.04 3.97 6.39 3.91C6.73 3.85 7 3.8 7.51 3.8C8.03 3.8 8.91 3.82 9.5 3.91C10.08 4 10.51 4.12 11.03 4.34C11.55 4.56 12.17 4.91 12.61 5.22C13.04 5.53 13.37 5.85 13.66 6.21C13.96 6.57 14.2 7.02 14.36 7.36C14.53 7.7 14.59 7.9 14.66 8.26C14.72 8.63 14.75 9.19 14.75 9.55C14.74 9.9 14.65 10.24 14.63 10.38L16.21 13.13L14.81 13.56C14.84 13.63 14.92 13.85 14.95 13.98C14.98 14.12 15.03 14.25 14.99 14.37C14.96 14.48 14.91 14.57 14.72 14.68C14.54 14.8 14.01 15 13.87 15.07C13.97 15.11 14.34 15.24 14.5 15.34C14.66 15.43 14.79 15.52 14.84 15.63C14.88 15.74 14.77 15.86 14.75 15.99C14.72 16.12 14.71 16.22 14.7 16.39C14.69 16.57 14.72 16.84 14.7 17.03C14.69 17.21 14.66 17.34 14.61 17.48C14.56 17.61 14.49 17.72 14.38 17.81C14.28 17.91 14.12 17.98 13.96 18.04C13.8 18.1 13.65 18.13 13.42 18.15C13.18 18.17 12.86 18.17 12.56 18.17C12.26 18.18 11.82 18.16 11.61 18.2C11.4 18.23 11.38 18.29 11.3 18.4C11.22 18.5 11.19 18.52 11.14 18.83C11.1 19.14 11.05 20.01 11.03 20.25Z" />
      <path d="M17.88 14.36A1.7 1.7 0 0 1 17.88 16.36M19.58 12.96A3.9 3.9 0 0 1 19.58 17.76M21.44 11.77A6.1 6.1 0 0 1 21.44 18.94" />
    </svg>
  )
}

/** A laptop (the Computer): its screen, the base flaring out under it and the touchpad. After the user's picture. */
export function LaptopIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="11" rx="0.75" />
      <path d="M3 15L0.9 19.75H23.1L21 15M10 17.4H14" />
    </svg>
  )
}

/** A DAW: a computer screen with a recording's waveform on it. */
export function DawIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <path d="M6 9.5v1M8.5 7.5v5M11 8.5v3M13.5 6.5v7M16 8v4M18 9.5v1" strokeWidth="1.5" />
    </svg>
  )
}

/** A mixing desk from above: three channel strips, each a knob and a fader. */
export function MixerIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <path d="M7 7.5h.01M12 7.5h.01M17 7.5h.01" strokeWidth="2.6" />
      <path d="M7 11v7M12 11v7M17 11v7" strokeWidth="1" />
      <path d="M5.5 15.5h3M10.5 12.5h3M15.5 14h3" strokeWidth="2.2" />
    </svg>
  )
}

/**
 * A stage box: a panel of sockets, the snake leaving it straight out of its side — in a thinner
 * line than lucide's, as it stands bare on the canvas (the user's call).
 */
export function StageBoxIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="4.5" width="15" height="13" rx="1.5" />
      <g strokeWidth="1.25">
        <circle cx="5.25" cy="8.75" r="1.25" /><circle cx="9" cy="8.75" r="1.25" /><circle cx="12.75" cy="8.75" r="1.25" />
        <circle cx="5.25" cy="13.25" r="1.25" /><circle cx="9" cy="13.25" r="1.25" /><circle cx="12.75" cy="13.25" r="1.25" />
      </g>
      <path d="M16.5 11H22.5" strokeWidth="2" />
    </svg>
  )
}
