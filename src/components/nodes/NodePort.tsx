import { useState } from 'react'
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react'
import { X } from 'lucide-react'
import { useSignalStore } from '../../store/signalStore'
import { useGraphSignal, getHealth } from '../../hooks/useSignalChain'
import { healthColor } from '../../hooks/useGainStaging'
import { useTranslation } from '../../i18n/useTranslation'
import { nodeAcceptsWire, portAcceptsWire } from '../../utils/connectionRules'
import { PORT_TOP, PORT_GAP } from '../../utils/layoutHelpers'
import { sideLetter } from '../../utils/nodeName'
import { UnplugMenu } from '../UnplugMenu'
import { MATRIX_PORT } from '../../data/nodeRegistry'

interface NodePortProps {
  nodeId: string
  portId: string
  type: 'source' | 'target'
  /** Position in the stack of ports on this side (0 = top, just below the header). */
  index: number
  title?: string
}

/**
 * One input or output port on a node card.
 * - The ring colour is the health of the signal on this port (grey when unconnected).
 * - While a wire is being drawn, free inputs that can take it pulse in the accent colour.
 * - Hovering a connected input turns it into a × — click it to unplug the wire (not while drawing one).
 *   A bus input holding several wires opens a list instead, so you pick which wire to unplug.
 *   Outputs never do: clicking an output always starts a new wire, so one signal can feed several inputs.
 * - An output that carries one side of a stereo mix (a bus's L / R output, or an effect fed one)
 *   shows a small L / R letter beside the dot.
 */
export function NodePort({ nodeId, portId, type, index, title }: NodePortProps) {
  const { portSignal, wires, stages } = useGraphSignal()
  const edges      = useSignalStore((s) => s.edges)
  const wireSource = useSignalStore((s) => s.wireSource)
  const removeEdge = useSignalStore((s) => s.removeEdge)
  const nodes      = useSignalStore((s) => s.nodes)
  const node       = nodes.find((n) => n.id === nodeId)
  const { t }      = useTranslation()
  const [hovered, setHovered]   = useState(false)
  const [menuAt, setMenuAt]     = useState<DOMRect | null>(null)
  const updateNodeInternals     = useUpdateNodeInternals()

  const connected = type === 'source'
    ? edges.filter((e) => e.source === nodeId && e.sourceHandle === portId)
    : edges.filter((e) => e.target === nodeId && e.targetHandle === portId)

  let ringColor = 'var(--lsc-border)'
  if (connected.length > 0) {
    // An input holding several wires shows the health of their sum
    const db = type === 'source'
      ? (portSignal.get(`${nodeId}:${portId}`) ?? -Infinity)
      : 20 * Math.log10(connected.reduce((sum, e) => {
          const wireDb = portSignal.get(`${e.source}:${e.sourceHandle}`) ?? -Infinity
          return sum + (isFinite(wireDb) ? Math.pow(10, wireDb / 20) : 0)
        }, 0))
    // Judged in the domain of the card the signal comes from (dBu or dBFS)
    const from = type === 'source' ? nodeId : connected[0].source
    ringColor = healthColor(getHealth(db, stages[from]?.domain))
  }

  const isValidTarget = type === 'target' && wireSource !== null && node !== undefined &&
    nodeAcceptsWire(node, wireSource, edges, nodes) && portAcceptsWire(node, portId, edges, wireSource)

  const canUnplug  = type === 'target' && wireSource === null && connected.length > 0
  const showUnplug = canUnplug && (hovered || menuAt !== null)
  // L / R on an output carrying one side; "L+R" on a Matrix send (both sides on one wire)
  const isSend     = type === 'source' && portId === MATRIX_PORT
  const side       = isSend ? 'L+R' : type === 'source' ? sideLetter(wires.get(`${nodeId}:${portId}`)?.kind) : null
  const top        = PORT_TOP + index * PORT_GAP

  function unplug(e: React.MouseEvent) {
    if (connected.length > 1) {
      setMenuAt((e.currentTarget as HTMLElement).getBoundingClientRect())
    } else {
      connected.forEach((edge) => removeEdge(edge.id))
    }
  }

  const className = ['lsc-port', isValidTarget && 'lsc-port-target', showUnplug && 'lsc-port-remove']
    .filter(Boolean).join(' ')

  return (
    <>
      <Handle
        id={portId}
        type={type}
        position={type === 'source' ? Position.Right : Position.Left}
        title={showUnplug ? (connected.length > 1 ? t.unplugMenu.title : t.nodeControls.unplug) : title}
        className={className}
        style={{ top, borderColor: isValidTarget || showUnplug ? undefined : ringColor }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        // The ring grows while hovered or while a wire looks for an input. Once its size settles,
        // have React Flow re-read it so wires end at the ring's edge, not where the bigger ring was.
        onTransitionEnd={(e) => {
          if (e.propertyName === 'width' && e.target === e.currentTarget) updateNodeInternals(nodeId)
        }}
        // Only set when unplugging — otherwise React Flow keeps its own click handling
        {...(canUnplug ? { onClick: unplug } : {})}
      >
        {showUnplug && <X size={22} strokeWidth={3} />}
      </Handle>
      {side && (
        <span
          aria-hidden
          style={{
            // Right of the ring, just above the wire leaving it
            position: 'absolute', top: top - 17, right: isSend ? -36 : -24,
            fontSize: 10, fontWeight: 800, lineHeight: 1,
            color: isSend ? 'var(--lsc-matrix-send)' : 'var(--lsc-fg-muted)', pointerEvents: 'none',
          }}
        >
          {side}
        </span>
      )}
      {menuAt && <UnplugMenu wires={connected} anchor={menuAt} onClose={() => setMenuAt(null)} />}
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
