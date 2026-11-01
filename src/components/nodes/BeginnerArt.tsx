// Beginner's drawings of whole devices (D20): a small mixing desk and a USB audio interface, in the
// line style of the icons, drawn as big as their box allows.

/** A knob: its circle, and its pointer turned `deg` from straight up. */
function Knob({ x, y, r, deg }: { x: number; y: number; r: number; deg: number }) {
  const a = (deg * Math.PI) / 180
  return (
    <g>
      <circle cx={x} cy={y} r={r} />
      <path d={`M${x} ${y}L${(x + Math.sin(a) * r * 0.8).toFixed(2)} ${(y - Math.cos(a) * r * 0.8).toFixed(2)}`} />
    </g>
  )
}

/** A fader: its slot, and its cap at `cap` (covering the slot). */
function Fader({ x, top, bottom, cap }: { x: number; top: number; bottom: number; cap: number }) {
  return (
    <g>
      <path d={`M${x} ${top}V${bottom}`} strokeWidth="1" />
      <rect x={x - 6} y={cap} width="12" height="7" rx="1.5" fill="var(--lsc-node-bg)" />
    </g>
  )
}

/** The drawing's size in a box: as big as it fits, its shape kept. */
const fitted = (box: { w: number; h: number }, w: number, h: number) => {
  const scale = Math.min(box.w / w, box.h / h)
  return { width: Math.floor(w * scale), height: Math.floor(h * scale) }
}

// Six channels: each knob's turn (degrees) and where its fader sits
const CHANNELS = [
  { knobs: [-30, 20, 0], cap: 116 },
  { knobs: [10, -45, 30], cap: 108 },
  { knobs: [45, 0, -20], cap: 122 },
  { knobs: [-10, 30, 60], cap: 104 },
  { knobs: [25, -20, 0], cap: 114 },
  { knobs: [-50, 10, 40], cap: 110 },
]

/**
 * A small mixing desk from above: the sockets along its back, six channel strips (three knobs, a
 * button and a fader each), and the master section — the Monitor and Phones knobs, the Main faders.
 */
export function MixerDrawing({ box }: { box: { w: number; h: number } }) {
  return (
    <svg
      viewBox="0 0 240 150" {...fitted(box, 240, 150)} aria-hidden
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <rect x="2" y="2" width="236" height="146" rx="10" />
      <path d="M2 26H238" />
      {CHANNELS.map(({ knobs, cap }, i) => {
        const x = 22 + i * 26
        return (
          <g key={x}>
            <circle cx={x} cy="14" r="4.5" />
            <circle cx={x} cy="14" r="1.2" />
            {knobs.map((deg, k) => <Knob key={k} x={x} y={40 + k * 18} r={6.5} deg={deg} />)}
            <rect x={x - 5} y="88" width="10" height="5" rx="1.5" />
            <Fader x={x} top={102} bottom={140} cap={cap} />
          </g>
        )
      })}
      <path d="M170 34V140" strokeWidth="1" strokeDasharray="2 3" />
      <Knob x={204} y={46} r={10} deg={35} />
      <Knob x={204} y={76} r={7} deg={-25} />
      <Fader x={192} top={102} bottom={140} cap={108} />
      <Fader x={216} top={102} bottom={140} cap={108} />
    </svg>
  )
}

/** An XLR / jack combo socket: the ring, the jack's hole in the middle, the XLR's three pins. */
function Combo({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="15" />
      <circle cx={x} cy={y} r="5" />
      <g strokeWidth="1.2">
        <circle cx={x - 8} cy={y - 7} r="1.4" /><circle cx={x + 8} cy={y - 7} r="1.4" /><circle cx={x} cy={y + 10} r="1.4" />
      </g>
    </g>
  )
}

/**
 * A USB audio interface from the front: two inputs, each with its gain knob, the 48V button, the
 * big monitor knob, the USB socket's sign and the headphone socket.
 */
export function InterfaceDrawing({ box }: { box: { w: number; h: number } }) {
  return (
    <svg
      viewBox="0 0 240 130" {...fitted(box, 240, 130)} aria-hidden
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <rect x="6" y="14" width="228" height="96" rx="12" />
      <path d="M26 110v8M214 110v8" strokeWidth="5" />
      <Combo x={44} y={50} />
      <Combo x={92} y={50} />
      <Knob x={44} y={90} r={8} deg={-30} />
      <Knob x={92} y={90} r={8} deg={20} />
      <rect x="122" y="44" width="18" height="10" rx="2" />
      <circle cx="131" cy="35" r="2" />
      <Knob x={172} y={62} r={22} deg={40} />
      {[-135, -90, -45, 0, 45, 90, 135].map((deg) => {
        const a = (deg * Math.PI) / 180
        const at = (r: number) => `${(172 + Math.sin(a) * r).toFixed(2)} ${(62 - Math.cos(a) * r).toFixed(2)}`
        return <path key={deg} d={`M${at(26)}L${at(29)}`} strokeWidth="1.2" />
      })}
      {/* The USB sign: a trident */}
      <path d="M214 56V28M211 32L214 27L217 32M214 47L208 42V38.5M214 51L220 46V42" strokeWidth="1.3" />
      <circle cx="208" cy="36.5" r="2" strokeWidth="1.3" />
      <rect x="218.5" y="38.5" width="3" height="3" strokeWidth="1.3" />
      <circle cx="214" cy="88" r="7" />
      <circle cx="214" cy="88" r="2.5" />
    </svg>
  )
}
