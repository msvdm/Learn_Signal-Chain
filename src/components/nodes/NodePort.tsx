import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { X } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { getHealthStyle } from '../../hooks/useGainStaging'
import { useTranslation } from '../../i18n/useTranslation'
import { nodeAcceptsWire, portAcceptsWire } from '../../utils/connectionRules'
import { PORT_TOP, PORT_GAP } from '../../utils/layoutHelpers'

interface NodePortProps {
  nodeId: string
  portId: string
  type: 'source' | 'target'
  /** Position in the stack of ports on this side (0 = top, on the header's port line). */
  index: number
  title?: string
}

/**
 * One input or output port on a node card.
 * - The ring colour is the health of the signal on this port (grey when unconnected).
 * - While a wire is being drawn, free inputs that can take it pulse in the accent colour.
 * - Hovering a connected input turns it into a × — click it to unplug the wire (not while drawing one).
 *   Outputs never do: clicking an output always starts a new wire, so one signal can feed several inputs.
 */
export function NodePort({ nodeId, portId, type, index, title }: NodePortProps) {
  const { portSignal } = useGraphSignal()
  const edges      = useSignalStore((s) => s.edges)
  const wireSource = useSignalStore((s) => s.wireSource)
  const removeEdge = useSignalStore((s) => s.removeEdge)
  const node       = useSignalStore((s) => s.nodes.find((n) => n.id === nodeId))
  const { t }      = useTranslation()
  const [hovered, setHovered] = useState(false)

  const connected = type === 'source'
    ? edges.filter((e) => e.source === nodeId && e.sourceHandle === portId)
    : edges.filter((e) => e.target === nodeId && e.targetHandle === portId)

  let ringColor = 'var(--lsc-border)'
  if (connected.length > 0) {
    const db = type === 'source'
      ? portSignal.get(`${nodeId}:${portId}`)
      : portSignal.get(`${connected[0].source}:${connected[0].sourceHandle}`)
    ringColor = getHealthStyle(getHealth(db ?? -Infinity)).color
  }

  const isValidTarget = type === 'target' && wireSource !== null && node !== undefined &&
    nodeAcceptsWire(node, wireSource, edges) && portAcceptsWire(node, portId, edges, wireSource)

  const canUnplug  = type === 'target' && wireSource === null && connected.length > 0
  const showUnplug = canUnplug && hovered

  const className = ['lsc-port', isValidTarget && 'lsc-port-target', showUnplug && 'lsc-port-remove']
    .filter(Boolean).join(' ')

  return (
    <Handle
      id={portId}
      type={type}
      position={type === 'source' ? Position.Right : Position.Left}
      title={showUnplug ? t.nodeControls.unplug : title}
      className={className}
      style={{ top: PORT_TOP + index * PORT_GAP, borderColor: isValidTarget || showUnplug ? undefined : ringColor }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // Only set when unplugging — otherwise React Flow keeps its own click handling
      {...(canUnplug ? { onClick: () => connected.forEach((e) => removeEdge(e.id)) } : {})}
    >
      {showUnplug && <X size={12} strokeWidth={3} />}
    </Handle>
  )
}

/** Dynamic input ports for buses: one per connected channel + one free slot for the next wire. */
export function BusInputPorts({ nodeId, connectedHandles }: { nodeId: string; connectedHandles: string[] }) {
  const used = new Set(connectedHandles)
  let free = 1
  while (used.has(`in-${free}`)) free++
  const handles = [...new Set(connectedHandles), `in-${free}`]
  return (
    <>
      {handles.map((handleId, i) => (
        <NodePort key={handleId} nodeId={nodeId} portId={handleId} type="target" index={i} />
      ))}
    </>
  )
}
