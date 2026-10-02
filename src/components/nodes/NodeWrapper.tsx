import type { ReactNode, CSSProperties } from 'react'
import { Power, X } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { getPorts } from '../../data/nodeRegistry'
import { nodeAcceptsWire } from '../../utils/connectionRules'
import { HEADER_H, PORT_TOP, PORT_GAP } from '../../utils/layoutHelpers'
import { NodePort } from './NodePort'

// Bypassing these makes no sense — the control itself is the state, or the node is a source / end point
const NO_BYPASS_TYPES = new Set([
  'mic', 'line-in', 'instrument', 'speaker', 'active-speaker', 'amp',
  'fader', 'switch', 'potentiometer', 'gain', 'relay', 'pan', 'adc', 'dac', 'pad',
  'master-bus', 'audio-interface',
])

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
  const wireSource       = useSignalStore((s) => s.wireSource)
  const edges            = useSignalStore((s) => s.edges)
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === nodeId))
  const { t, fmt }       = useTranslation()

  const isBypassed = node?.bypassed ?? false
  const canBypass  = !NO_BYPASS_TYPES.has(typeKey)
  const hasHelp    = Boolean(t.theory[typeKey])
  const helpOpen   = activeTooltipId === nodeId
  const selected   = selectedNodeId === nodeId || helpOpen

  const ports   = getPorts(node ?? { typeKey, params: {} })
  const inputs  = customInputs ? [] : ports.inputs
  const outputs = ports.outputs

  // Tall enough for the longest stack of ports
  const portRows  = Math.max(inputs.length, customInputCount ?? 0, outputs.length, 1)
  const minHeight = PORT_TOP + (portRows - 1) * PORT_GAP + 24

  // While a wire is being drawn, label this card if it can take the wire
  const isWireTarget = wireSource !== null && node !== undefined &&
    nodeAcceptsWire(node, wireSource, edges)

  const borderColor = isBypassed ? 'var(--signal-hot)' : selected ? 'var(--lsc-accent)' : 'var(--lsc-border)'

  function toggleHelp() {
    if (helpOpen) {
      setActiveTooltip(null, null)
    } else {
      setActiveTooltip(nodeId, typeKey)
      setSelectedNode(nodeId)
    }
  }

  return (
    <div
      className={`lsc-node-card select-none ${selected ? 'lsc-selected' : ''} ${className}`}
      style={{
        position: 'relative',
        width: 'max-content',
        minWidth: 160,
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
        style={{
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

      {/* Body — dimmed when bypassed */}
      <div
        style={{
          padding: '10px 12px 12px',
          display: 'flex', flexDirection: 'column', gap: 8,
          alignItems: align === 'center' ? 'center' : align === 'start' ? 'flex-start' : 'stretch',
          opacity: isBypassed ? 0.5 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {children}
      </div>
    </div>
  )
}

const headerBtn: CSSProperties = {
  width: 22, height: 22, flexShrink: 0, borderRadius: 9999, padding: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderWidth: 1, borderStyle: 'solid',
  transition: 'background 0.1s, color 0.1s, border-color 0.1s',
}
