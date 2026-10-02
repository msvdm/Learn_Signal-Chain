import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useSignalStore } from '../../store/signalStore'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { getHealthStyle } from '../../hooks/useGainStaging'
import { useTranslation } from '../../i18n/useTranslation'
import { nodeAcceptsWire, portIsFree } from '../../utils/connectionRules'
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
 * - In Move mode, hovering a connected port shows a small × to remove its wires.
 */
export function NodePort({ nodeId, portId, type, index, title }: NodePortProps) {
  const { portSignal } = useGraphSignal()
  const edges      = useSignalStore((s) => s.edges)
  const wireSource = useSignalStore((s) => s.wireSource)
  const toolMode   = useSignalStore((s) => s.toolMode)
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
    nodeAcceptsWire(node, wireSource, edges) && portIsFree(nodeId, portId, edges)

  const top  = PORT_TOP + index * PORT_GAP
  const side = type === 'source' ? 'right' : 'left'

  return (
    <>
      <Handle
        id={portId}
        type={type}
        position={type === 'source' ? Position.Right : Position.Left}
        title={title}
        className={`lsc-port${isValidTarget ? ' lsc-port-target' : ''}`}
        style={{ top, borderColor: isValidTarget ? undefined : ringColor }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {toolMode === 'select' && hovered && connected.length > 0 && (
        <button
          className="nodrag nopan lsc-handle-delete"
          style={{ top, [side]: -25, transform: 'translateY(-50%)' }}
          title={t.nodeControls.remove}
          onClick={() => connected.forEach((e) => removeEdge(e.id))}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          ×
        </button>
      )}
    </>
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
