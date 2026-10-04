// Icons lucide does not have (24 × 24). See nodeLook.ts.

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

/** A guitar amp (combo): a cabinet with a row of knobs on top and one round speaker. */
export function GuitarAmpIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 8h18" />
      <path d="M6.5 5.5h.01M9.5 5.5h.01M12.5 5.5h.01" />
      <circle cx="12" cy="14.5" r="4" />
      <circle cx="12" cy="14.5" r="1" />
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
