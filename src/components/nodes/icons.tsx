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
