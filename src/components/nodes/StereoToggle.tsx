/** The face's switch (`big`): its text size and its height (px) — a face's words are drawn to be read zoomed out */
const BIG_TEXT = 22
/** Its buttons' line (1.5 × the text) and padding, the switch's own padding and border */
export const BIG_TOGGLE_H = 47

/** Two-part switch: Mono | Stereo — a card's (small), or on a face drawn at every zoom (`big`: the Aux Bus, D31). */
export function StereoToggle({ stereo, onChange, labels, big = false }: {
  stereo: boolean
  onChange: (stereo: boolean) => void
  labels: [string, string]
  big?: boolean
}) {
  return (
    <div
      className="nodrag nopan"
      role="radiogroup"
      style={{
        display: 'flex', padding: 2, gap: 2,
        borderRadius: 9999, background: 'var(--lsc-sunken)',
        border: '1px solid var(--lsc-border-soft)',
        ...(big ? { pointerEvents: 'auto', height: BIG_TOGGLE_H, boxSizing: 'border-box' } : {}),
      }}
    >
      {labels.map((text, i) => {
        const active = (i === 1) === stereo
        return (
          <button
            key={text}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(i === 1)}
            style={{
              flex: 1, padding: big ? '4px 18px' : '2px 10px', borderRadius: 9999, border: 'none',
              fontSize: big ? BIG_TEXT : 11, fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.02em',
              background: active ? 'var(--lsc-accent)' : 'transparent',
              color: active ? '#fff' : 'var(--lsc-fg-muted)',
              cursor: active ? 'default' : 'pointer',
              transition: 'background 0.1s, color 0.1s',
            }}
          >
            {text}
          </button>
        )
      })}
    </div>
  )
}
