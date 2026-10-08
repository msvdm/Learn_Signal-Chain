import type { CardProps } from './cardProps'
import { useTranslation } from '../../i18n/useTranslation'
import { useNodeName } from '../../hooks/useNodeName'
import { NodeWrapper } from './NodeWrapper'
import { useSignalStore } from '../../store/signalStore'
import { useParams } from '../../hooks/useParams'
import { PORT_GAP, PORT_TOP, cardMinSize } from '../../utils/layoutHelpers'

// The face is drawn in the card's own pixels (inside its 1px border), so the symbol's lines meet
// the ports: input A on the first port line, B on the next, the output level with A
const SIZE      = cardMinSize('relay')
const W         = SIZE.w - 2
const Y_A       = PORT_TOP
const Y_B       = PORT_TOP + PORT_GAP
const Y_PIVOT   = (Y_A + Y_B) / 2            // the arm turns here, half way between the contacts
const X_CONTACT = Math.round(W * 0.4)
const X_PIVOT   = Math.round(W * 0.6)
const X_BEND    = W - 36                     // the output steps up to its port here
const BEND_R    = 8
// From A to B the arm turns through twice its angle to the horizontal
const SWING     = (2 * Math.atan2((Y_B - Y_A) / 2, X_PIVOT - X_CONTACT) * 180) / Math.PI

// The A / B buttons above the symbol (zoomed in), clear of the ports' reach
const BUTTON_TOP = 10
const BUTTON_H   = 38
const BUTTON_GAP = 10
const BUTTON_X   = 20
// The symbol itself is a button too: a click flips it (the only control zoomed out)
const HIT_X      = 30
const HIT_PAD    = 22

// Zoomed in: lines as thin as a card's drawing; zoomed out as thick as the wires (useFlowElements)
const STROKE      = { normal: 3, overview: 8 }
const CONTACT_R   = { normal: 5, overview: 10 }

/**
 * The Relay Switch (type `relay`): two inputs, A (top) and B, one output — the chosen input goes
 * out, the other is cut off. Drawn as a relay's symbol whose arm swings to the chosen contact:
 * zoomed in under its A / B buttons, zoomed out the symbol alone, no card around it (like the
 * Gain knob), and a click on it flips it. An aux send's pre-fader (A) or post-fader (B) copy is
 * one use; skipping a group of elements is another.
 */
export function RelayNode({ id }: CardProps) {
  const p                = useParams(id, 'relay')
  const updateNodeParams = useSignalStore((s) => s.updateNodeParams)
  const overview         = useSignalStore((s) => s.overview)
  const { t }            = useTranslation()
  const onB              = p('selectedInput') === 'b'
  const choose           = (input: 'a' | 'b') => updateNodeParams(id, { selectedInput: input })

  const stroke  = overview ? STROKE.overview : STROKE.normal
  const r       = overview ? CONTACT_R.overview : CONTACT_R.normal
  // The path the signal takes in the card's colour, the input cut off faint
  const live    = 'var(--lsc-fg)'
  const cut     = 'var(--lsc-fg-fainter)'
  const hole    = overview ? 'var(--lsc-canvas)' : 'var(--lsc-node-bg)'
  const buttonW = (W - 2 * BUTTON_X - BUTTON_GAP) / 2

  const face = (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* A and B: lit like a desk's buttons — hidden zoomed out, where the symbol is the control */}
      <div className="nodrag nopan" style={{ visibility: overview ? 'hidden' : 'visible' }}>
        {(['a', 'b'] as const).map((input, i) => {
          const on = (input === 'b') === onB
          return (
            <button
              key={input}
              aria-pressed={on}
              onClick={() => choose(input)}
              style={{
                position: 'absolute', top: BUTTON_TOP, left: BUTTON_X + i * (buttonW + BUTTON_GAP),
                width: buttonW, height: BUTTON_H, padding: 0, pointerEvents: 'auto',
                fontSize: 20, fontWeight: 800, lineHeight: 1,
                borderRadius: 'var(--lsc-radius-md)',
                border: `2px solid ${on ? 'var(--signal-good)' : 'var(--lsc-border)'}`,
                background: on ? 'var(--signal-good-bg)' : 'var(--lsc-sunken)',
                color: on ? 'var(--signal-good-text)' : 'var(--lsc-fg-muted)',
                cursor: on ? 'default' : 'pointer',
                transition: 'background 0.1s, border-color 0.1s, color 0.1s',
              }}
            >
              {input === 'a' ? t.nodes.relay.a : t.nodes.relay.b}
            </button>
          )
        })}
      </div>

      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }} fill="none" strokeLinecap="round">
        {/* The inputs, from their ports to their contacts */}
        <path d={`M0 ${Y_A}H${X_CONTACT}`} stroke={onB ? cut : live} strokeWidth={stroke} />
        <path d={`M0 ${Y_B}H${X_CONTACT}`} stroke={onB ? live : cut} strokeWidth={stroke} />
        {/* The output, from the pivot up to its port */}
        <path
          d={`M${X_PIVOT} ${Y_PIVOT}H${X_BEND - BEND_R}Q${X_BEND} ${Y_PIVOT} ${X_BEND} ${Y_PIVOT - BEND_R}`
            + `V${Y_A + BEND_R}Q${X_BEND} ${Y_A} ${X_BEND + BEND_R} ${Y_A}H${W}`}
          stroke={live} strokeWidth={stroke} strokeLinejoin="round"
        />
        {/* The arm: drawn to A, swung round the pivot to B */}
        <line
          x1={X_PIVOT} y1={Y_PIVOT} x2={X_CONTACT} y2={Y_A}
          stroke={live} strokeWidth={stroke}
          style={{
            transformOrigin: `${X_PIVOT}px ${Y_PIVOT}px`,
            transform: onB ? `rotate(${-SWING}deg)` : 'none',
            transition: 'transform 160ms ease-in-out',
          }}
        />
        {/* The contacts and the pivot, over the lines */}
        <circle cx={X_CONTACT} cy={Y_A} r={r} fill={hole} stroke={onB ? cut : live} strokeWidth={stroke * 0.75} />
        <circle cx={X_CONTACT} cy={Y_B} r={r} fill={hole} stroke={onB ? live : cut} strokeWidth={stroke * 0.75} />
        <circle cx={X_PIVOT} cy={Y_PIVOT} r={r} fill={hole} stroke={live} strokeWidth={stroke * 0.75} />
      </svg>

      {/* A click on the symbol flips it, at every zoom */}
      <button
        className="nodrag nopan"
        aria-label={t.nodes.relay.toggle}
        onClick={() => choose(onB ? 'a' : 'b')}
        style={{
          position: 'absolute', left: HIT_X, width: W - 2 * HIT_X,
          top: Y_A - HIT_PAD, height: Y_B - Y_A + 2 * HIT_PAD,
          padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', pointerEvents: 'auto',
        }}
      />
    </div>
  )

  return (
    <NodeWrapper
      nodeId={id}
      typeKey="relay"
      label={useNodeName(id, 'relay')}
      faceOnly
      overviewLevel={false}
      overviewBare
      ownFace={face}
    />
  )
}
