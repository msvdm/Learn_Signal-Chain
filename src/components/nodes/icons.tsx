// Icons lucide does not have, drawn in its style (24 × 24, round caps). See nodeLook.ts.

/** A jack plug (Line Input), in lucide's style. */
export function JackPlugIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <g transform="rotate(-45 12 12)">
        <line x1="10.5" y1="22" x2="10.5" y2="20" />
        <line x1="13.5" y1="22" x2="13.5" y2="20" />
        <rect x="8.5" y="13" width="7" height="7.5" rx="1.5" />
        <line x1="10" y1="13" x2="10" y2="11" />
        <line x1="14" y1="13" x2="14" y2="11" />
        <line x1="10" y1="11" x2="14" y2="11" />
        <path d="M10 11 L10 6.5 Q10 4 12 4 Q14 4 14 6.5 L14 11" />
        <line x1="10" y1="8.5" x2="14" y2="8.5" />
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
