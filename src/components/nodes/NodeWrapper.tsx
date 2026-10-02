import type { ReactNode, CSSProperties } from 'react'
import { Power, X, Lock } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'
import { useTranslation } from '../../i18n/useTranslation'
import { NODE_REGISTRY } from '../../data/nodeRegistry'
import { nodeAcceptsWire, portIsFree } from '../../utils/connectionRules'
import { HEADER_H, PORT_TOP, PORT_GAP } from '../../utils/layoutHelpers'
import { NodePort } from './NodePort'

// Bypassing these makes no sense — the control itself is the state, or the node is a source / end point
const NO_BYPASS_TYPES = new Set([
  'mic', 'line-in', 'instrument', 'speaker', 'active-speaker', 'amp',
  'fader', 'switch', 'potentiometer', 'gain', 'relay', 'pan', 'adc', 'dac', 'pad',
  'master-bus', 'audio-interface',
])

// Inputs are created at runtime (one per connected channel + one free slot)
const DYNAMIC_INPUT_TYPES = new Set(['master-bus', 'mono-bus', 'stereo-bus', 'audio-interface'])

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
  const complexityLevel  = useSignalStore((s) => s.complexityLevel)
  const wireSource       = useSignalStore((s) => s.wireSource)
  const edges            = useSignalStore((s) => s.edges)
  const node             = useSignalStore((s) => s.nodes.find((n) => n.id === nodeId))
  const { t, fmt }       = useTranslation()

  const isBypassed = node?.bypassed ?? false
  // master-bus is the fixed anchor in intermediate/advanced — it cannot be removed or moved
  const isFixed    = typeKey === 'master-bus' && complexityLevel !== 'beginner'
  const canRemove  = !isFixed
  const canBypass  = !NO_BYPASS_TYPES.has(typeKey)
  const hasHelp    = Boolean(t.theory[typeKey])
  const helpOpen   = activeTooltipId === nodeId
  const selected   = selectedNodeId === nodeId || helpOpen

  const def     = NODE_REGISTRY[typeKey]
  const inputs  = customInputs ? [] : (def?.inputs ?? [])
  const outputs = def?.outputs ?? []

  // Tall enough for the longest stack of ports
  const portRows  = Math.max(inputs.length, customInputCount ?? 0, outputs.length, 1)
  const minHeight = PORT_TOP + (portRows - 1) * PORT_GAP + 24

  // While a wire is being drawn, label this card if it can take the wire
  const hasFreeInput = DYNAMIC_INPUT_TYPES.has(typeKey) ||
    inputs.some((p) => portIsFree(nodeId, p.id, edges))
  const isWireTarget = wireSource !== null && node !== undefined && hasFreeInput &&
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

      {/* Floating mini-toolbar — shown on hover / selection (CSS) */}
      {(canBypass || canRemove) && (
        <div
          className="lsc-node-toolbar nodrag nopan"
          style={{ position: 'absolute', left: 0, bottom: '100%', paddingBottom: 6 }}
        >
          <div
            style={{
              display: 'flex', gap: 2, padding: 3, borderRadius: 8,
              background: 'var(--lsc-header)', border: '1px solid var(--lsc-border)',
              boxShadow: 'var(--lsc-shadow-popup)',
            }}
          >
            {canBypass && (
              <button
                title={t.nodeControls.bypassed}
                onClick={() => toggleBypassNode(nodeId)}
                style={{
                  ...toolbarBtn,
                  color: isBypassed ? 'var(--signal-hot)' : 'var(--lsc-fg)',
                  background: isBypassed ? 'var(--signal-hot-bg)' : undefined,
                }}
              >
                <Power size={13} />
                {t.nodeControls.bypass}
              </button>
            )}
            {canRemove && (
              <button
                title={t.nodeControls.remove}
                onClick={() => removeNode(nodeId)}
                style={{ ...toolbarBtn, color: 'var(--signal-clipping)' }}
              >
                <X size={13} />
                {t.nodeControls.removeShort}
              </button>
            )}
          </div>
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
        style={{
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
          {isBypassed && (
            <span
              style={{
                display: 'block', marginTop: 3, width: 'max-content',
                fontSize: 11, fontWeight: 700, lineHeight: 1.4,
                padding: '0 6px', borderRadius: 9999,
                background: 'var(--signal-hot-bg)', color: 'var(--signal-hot)',
                border: '1px solid var(--signal-hot-border)',
              }}
            >
              {t.nodeControls.bypassedShort}
            </span>
          )}
        </span>
        <span style={{ flex: 1 }} />
        {isFixed && (
          <span
            title={t.emptyState.fixedHint}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--lsc-fg-muted)', flexShrink: 0 }}
          >
            <Lock size={11} />
            {t.emptyState.fixed}
          </span>
        )}
        {hasHelp && (
          <button
            className="nodrag nopan"
            title={t.tooltip.help}
            onClick={toggleHelp}
            style={{
              width: 22, height: 22, flexShrink: 0, borderRadius: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, padding: 0,
              border: `1px solid ${helpOpen ? 'var(--lsc-accent)' : 'var(--lsc-border)'}`,
              background: helpOpen ? 'var(--lsc-accent)' : 'transparent',
              color: helpOpen ? '#fff' : 'var(--lsc-fg-muted)',
            }}
          >
            ?
          </button>
        )}
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

const toolbarBtn: CSSProperties = {
  height: 28, padding: '0 10px', borderRadius: 6,
  display: 'flex', alignItems: 'center', gap: 5,
  fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
  border: 'none', background: 'transparent',
}
