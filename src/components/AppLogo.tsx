// Made by scripts/make-icons.py: edit the geometry there and run it again, not here.
/**
 * The app's logo: sound arrives (a green wave), a hand sets the level (a purple knob),
 * the result leaves through a fader (a yellow cap with a red top: too hot).
 * The mark's colours are the same in both themes; the tile behind it takes the
 * canvas and border colours of the theme the app is in.
 */
export function AppLogo({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg
      viewBox="0 0 512 512" width={size} height={size}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="512" height="512" rx="112" fill="var(--lsc-canvas)" />
      <rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="var(--lsc-border)" strokeWidth="12" />
      <g fill="#24232b" stroke="#24232b" strokeLinecap="round">
      <circle cx="90.6" cy="256" r="24.5" stroke="none" />
      <path d="M126.6 225.8 A47.0 47.0 0 0 1 126.6 286.2" fill="none" strokeWidth="32.0" />
      <path d="M158.3 199.2 A88.4 88.4 0 0 1 158.3 312.8" fill="none" strokeWidth="32.0" />
      <circle cx="274.8" cy="256" r="65.9" stroke="none" />
      <path d="M407.3 157.3 V338.7" fill="none" strokeWidth="32.0" />
      <rect x="367.9" y="165.8" width="79.0" height="116.6" rx="18.9" stroke="none" />
      </g>
      <circle cx="90.6" cy="256" r="18.8" fill="#4ade80" />
      <path d="M126.6 225.8 A47.0 47.0 0 0 1 126.6 286.2" fill="none" stroke="#4ade80" strokeWidth="20.7" strokeLinecap="round" />
      <path d="M158.3 199.2 A88.4 88.4 0 0 1 158.3 312.8" fill="none" stroke="#4ade80" strokeWidth="20.7" strokeLinecap="round" />
      <circle cx="274.8" cy="256" r="60.2" fill="#9a7fd4" />
      <path d="M274.8 256 L298.5 222.1" stroke="#fbfaf7" strokeWidth="16.9" strokeLinecap="round" />
      <path d="M407.3 157.3 V338.7" fill="none" stroke="#facc15" strokeWidth="20.7" strokeLinecap="round" />
      <rect x="373.5" y="171.4" width="67.7" height="105.3" rx="13.2" fill="#facc15" />
      <path d="M373.5 184.6 Q373.5 171.4 386.7 171.4 H428.0 Q441.2 171.4 441.2 184.6 V199.6 H373.5 Z" fill="#f87171" />
      <path d="M382.9 231.6 H431.8" stroke="#24232b" strokeWidth="7.5" strokeLinecap="round" />
    </svg>
  )
}
