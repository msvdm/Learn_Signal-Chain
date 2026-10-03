import type { ReactNode, CSSProperties } from 'react'
import { Power, X } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { NODE_REGISTRY, getPorts, helpKeyOf, isNodeStereo } from '../../data/nodeRegistry'
import { useGraphSignal } from '../../hooks/useSignalChain'
import { nodeAcceptsWire } from '../../utils/connectionRules'
import { chainColorsOf } from '../../utils/chainColors'
import { HEADER_H, PORT_TOP, PORT_GAP, CARD_MIN_W, CARD_MIN_H } from '../../utils/layoutHelpers'
import { NodePort } from './NodePort'
import { OverviewFace } from './OverviewFace'

// Bypassing these makes no sense — the control itself is the state, or the node is a source / end point
const NO_BYPASS_TYPES = new Set([
  'mic', 'line-in', 'instrument', 'speaker', 'active-speaker', 'amp',
  'fader', 'switch', 'gain', 'relay', 'pan', 'adc', 'dac', 'pad',
  'master-bus', 'matrix-bus', 'audio-interface',
])

// Side padding of the body: the port rings reach 14px into the card, so content starts clear of them
const BODY_PAD_X = 20

interface NodeWrapperProps {
  nodeId: string
  typeKey: string
  icon: ReactNode
  label: string
  /** Kept for API compatibility with older node components; no longer drawn. */
  accentColor?: string
  children?: ReactNode
  /** Ports the node renders itself (dynamic bus inputs). Registry inputs are then skipped. */
  customInputs?: ReactNode
  /** Number of custom input ports, so the card grows tall enough to hold them. */
  customInputCount?: number
  /** Horizontal alignment of the body content. */
  align?: 'stretch' | 'start' | 'center'
  className?: string
  style?: CSSProperties
}

/**
 * The single card shell every node uses.
 * Width follows the content (controls, graphs); text wraps to fit.
 * The 56px header keeps the first port line at the same height on every card,
 * so wires between cards stay straight no matter how tall each card is.
 */
export function NodeWrapper({
  nodeId,
  typeKey,
  icon,
  label,
  children,
  customInputs,
  customInputCount,
  align = 'stretch',
  className = '',
  style,
}: NodeWrapperProps) {
  const setActiveTooltip = useSignalStore((s) => s.setActiveTooltip)
  const setSelectedNode  = useSignalStore((s) => s.setSelectedNode)
  const activeTooltipId  = useSignalStore((s) => s.activeTooltipId)
  const selectedNodeId   = useSignalStore((s) => s.selectedNodeId)
  const toggleBypassNode = useSignalStore((s) => s.toggleBypassNode)
  const removeNode       = useSignalStore((s) => s.removeNode)
  const setNodeStereo    = useSignalStore((s) => s.setNodeStereo)
  // Joined into a string so the card only re-renders when its chains change
  const chainColors      = useSignalStore((s) => chainColorsOf(nodeId, s.nodes, s.edges).join(' '))
  const wireSource       = useSignalStore((s) => s.wireSource)
  const edges            = useSignalStore((s) => s.edges)
  const nodes            = useSignalStore((s) => s.nodes)
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === nodeId))
  const overview         = useSignalStore((s) => s.overview)
  const { stages }       = useGraphSignal()
  const { t, fmt }       = useTranslation()

  const isBypassed = node?.bypassed ?? false
  const canBypass  = !NO_BYPASS_TYPES.has(typeKey)
  const helpKey    = node ? helpKeyOf(node, stages[nodeId]) : typeKey
  const hasHelp    = Boolean(t.theory[helpKey])
  const helpOpen   = activeTooltipId === nodeId
  const selected   = selectedNodeId === nodeId || helpOpen

  const ports      = getPorts(node ?? { typeKey, params: {} }, { nodes, edges })
  const canStereo  = NODE_REGISTRY[typeKey]?.stereo === 'optional'
  const stripe     = chainColors ? chainColors.split(' ') : []
  const inputs  = customInputs ? [] : ports.inputs
  const outputs = ports.outputs

  // Tall enough for the longest stack of ports
  const portRows  = Math.max(inputs.length, customInputCount ?? 0, outputs.length, 1)
  const minHeight = Math.max(CARD_MIN_H, PORT_TOP + (portRows - 1) * PORT_GAP + 24)

  // In overview the controls stay in place, invisible, so the card keeps its exact size
  const hideInOverview: CSSProperties = overview ? { visibility: 'hidden', opacity: 0 } : {}

  // While a wire is being drawn, label this card if it can take the wire
  const isWireTarget = wireSource !== null && node !== undefined &&
    nodeAcceptsWire(node, wireSource, edges, nodes)

  const borderColor = isBypassed ? 'var(--signal-hot)' : selected ? 'var(--lsc-accent)' : 'var(--lsc-border)'

  function toggleHelp() {
    if (helpOpen) {
      setActiveTooltip(null, null)
    } else {
      setActiveTooltip(nodeId, helpKey)
      setSelectedNode(nodeId)
    }
  }

  return (
    <div
      className={`lsc-node-card select-none ${selected ? 'lsc-selected' : ''} ${className}`}
      style={{
        position: 'relative',
        width: 'max-content',
        minWidth: CARD_MIN_W,
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--lsc-node-bg)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--lsc-radius-lg)',
        boxShadow: selected
          ? '0 0 0 3px var(--lsc-accent-bg), var(--lsc-shadow-node)'
          : 'var(--lsc-shadow-node)',
        color: 'var(--lsc-fg)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        pointerEvents: 'auto',
        ...style,
      }}
    >
      {/* "{Node} input" label while this card is a valid wire target */}
      {isWireTarget && (
        <span
          style={{
            position: 'absolute', left: -12, top: -30,
            padding: '4px 8px', borderRadius: 6,
            background: 'var(--lsc-accent)', color: '#fff',
            fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {fmt(t.connecting.input, { node: label })}
        </span>
      )}

      {/* Chain colour stripe — one segment per source feeding this card */}
      {stripe.length > 0 && (
        <div
          aria-hidden
          style={{
            position: 'absolute', top: 0, left: 10, right: 10, height: 3,
            display: 'flex', borderRadius: '0 0 3px 3px', overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {stripe.map((c) => <span key={c} style={{ flex: 1, background: c }} />)}
        </div>
      )}

      {/* Ports */}
      {inputs.map((port, i) => (
        <NodePort key={port.id} nodeId={nodeId} portId={port.id} type="target" index={i} title={port.label} />
      ))}
      {customInputs}
      {outputs.map((port, i) => (
        <NodePort key={port.id} nodeId={nodeId} portId={port.id} type="source" index={i} title={port.label} />
      ))}

      {/* Header — fixed height keeps the port line aligned across cards */}
      <div
        className="lsc-fade"
        style={{
          ...hideInOverview,
          position: 'relative',
          minHeight: HEADER_H,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 10px 0 12px',
          borderBottom: '1px solid var(--lsc-border-soft)',
          flexShrink: 0,
        }}
      >
        <span className="lsc-node-icon" style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>
        {/* Short titles stay on one line (the card grows); long ones wrap */}
        <span
          style={{
            flex: '0 1 auto', width: 'max-content', maxWidth: 132,
            fontSize: 'var(--node-text-md)', fontWeight: 600, lineHeight: 1.15,
            padding: '6px 0',
          }}
        >
          {label}
        </span>
        {/* "Bypassed" tag sits on the header's bottom line — it never changes the card's size */}
        {isBypassed && (
          <span
            style={{
              position: 'absolute', left: 12, bottom: 0, transform: 'translateY(50%)', zIndex: 2,
              fontSize: 11, fontWeight: 700, lineHeight: 1.4, whiteSpace: 'nowrap',
              padding: '0 6px', borderRadius: 9999,
              background: 'linear-gradient(var(--signal-hot-bg), var(--signal-hot-bg)), var(--lsc-node-bg)',
              color: 'var(--signal-hot)',
              border: '1px solid var(--signal-hot-border)',
              pointerEvents: 'none',
            }}
          >
            {t.nodeControls.bypassedShort}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {/* Help · On/Off (processing elements only) · Remove */}
        <div className="nodrag nopan" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {hasHelp && (
            <button
              className="lsc-node-btn"
              title={t.tooltip.help}
              onClick={toggleHelp}
              style={{
                ...headerBtn,
                fontSize: 12, fontWeight: 700,
                borderColor: helpOpen ? 'var(--lsc-accent)' : 'var(--lsc-border)',
                background: helpOpen ? 'var(--lsc-accent)' : 'transparent',
                color: helpOpen ? '#fff' : 'var(--lsc-fg-muted)',
              }}
            >
              ?
            </button>
          )}
          {canBypass && (
            <button
              className="lsc-node-btn"
              title={isBypassed ? t.nodeControls.turnOn : t.nodeControls.turnOff}
              aria-pressed={!isBypassed}
              onClick={() => toggleBypassNode(nodeId)}
              style={{
                ...headerBtn,
                borderColor: isBypassed ? 'var(--signal-hot-border)' : 'var(--signal-good-border)',
                background: isBypassed ? 'var(--signal-hot-bg)' : 'var(--signal-good-bg)',
                color: isBypassed ? 'var(--signal-hot)' : 'var(--signal-good)',
              }}
            >
              <Power size={12} strokeWidth={2.5} />
            </button>
          )}
          <button
            className="lsc-node-btn lsc-node-btn-remove"
            title={t.nodeControls.remove}
            onClick={() => removeNode(nodeId)}
            style={{ ...headerBtn, borderColor: 'var(--lsc-border)', background: 'transparent', color: 'var(--lsc-fg-muted)' }}
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Mono | Stereo switch — not dimmed by bypass, it changes the wiring */}
      {canStereo && node && (
        <div className="lsc-fade" style={{ padding: `10px ${BODY_PAD_X}px 0`, ...hideInOverview }}>
          <StereoToggle
            stereo={isNodeStereo(node)}
            onChange={(on) => setNodeStereo(nodeId, on)}
            labels={[t.stereo.mono, t.stereo.stereo]}
            hint={t.stereo.toggleHint}
          />
        </div>
      )}

      {/* Body — dimmed when bypassed; centred in cards bigger than their controls */}
      <div
        className="lsc-fade"
        style={{
          flex: 1,
          padding: `10px ${BODY_PAD_X}px 12px`,
          display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center',
          alignItems: align === 'center' ? 'center' : align === 'start' ? 'flex-start' : 'stretch',
          opacity: isBypassed ? 0.5 : 1,
          ...hideInOverview,
        }}
      >
        {children}
      </div>

      {/* Overview (zoomed out): name + output level, drawn over the hidden controls, under the ports */}
      <OverviewFace
        nodeId={nodeId}
        label={label}
        shown={overview}
        bypassed={isBypassed}
        hasOutput={outputs.length > 0}
      />
    </div>
  )
}

/** Two-part switch: Mono | Stereo. */
function StereoToggle({ stereo, onChange, labels, hint }: {
  stereo: boolean
  onChange: (stereo: boolean) => void
  labels: [string, string]
  hint: string
}) {
  return (
    <div
      className="nodrag nopan"
      role="radiogroup"
      title={hint}
      style={{
        display: 'flex', padding: 2, gap: 2,
        borderRadius: 9999, background: 'var(--lsc-sunken)',
        border: '1px solid var(--lsc-border-soft)',
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
              flex: 1, padding: '2px 10px', borderRadius: 9999, border: 'none',
              fontSize: 11, fontWeight: 700, lineHeight: 1.5, letterSpacing: '0.02em',
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

const headerBtn: CSSProperties = {
  width: 22, height: 22, flexShrink: 0, borderRadius: 9999, padding: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderWidth: 1, borderStyle: 'solid',
  transition: 'background 0.1s, color 0.1s, border-color 0.1s',
}
