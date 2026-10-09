import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react'
import { X } from 'lucide-react'
import { useShallow } from 'zustand/shallow'
import { useSignalStore } from '../../store/signalStore'
import { getHealth, healthColor, sumSignalsToDb } from '../../signal/levels'
import { graphSignal, levelOf, peakOf } from '../../signal/engine'
import { graphOf } from '../../graph/graph'
import type { GraphView } from '../../graph/graph'
import { nodeAcceptsWire, portAcceptsWire } from '../../graph/connectionRules'
import { PORT_TOP, PORT_GAP, PORT_REACH } from '../../utils/layoutHelpers'
import { sideLetter } from '../../utils/nodeName'
import { UnplugMenu } from '../UnplugMenu'
import { MATRIX_PORT } from '../../data/nodeRegistry'
import type { SignalEdge } from '../../data/nodeRegistry'

/** The wires plugged into this port. */
function wiresOn(graph: GraphView, nodeId: string, portId: string, type: 'source' | 'target'): SignalEdge[] {
  return type === 'source'
    ? graphOf(graph).from(nodeId).filter((e) => e.sourceHandle === portId)
    : graphOf(graph).into(nodeId).filter((e) => e.targetHandle === portId)
}

interface NodePortProps {
  nodeId: string
  portId: string
  type: 'source' | 'target'
  /** Its port line (0 = the first, just below the header) */
  row: number
  /** Another port of its stack on the line above / below */
  near: { above: boolean; below: boolean }
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
export function NodePort({ nodeId, portId, type, row, near }: NodePortProps) {
  const removeEdge = useSignalStore((s) => s.removeEdge)
  const [hovered, setHovered]   = useState(false)
  const [menuAt, setMenuAt]     = useState<DOMRect | null>(null)
  const updateNodeInternals     = useUpdateNodeInternals()

  // Each piece is read on its own, so the port is redrawn only when one of them changes
  const connected = useSignalStore(useShallow((s) => wiresOn(s, nodeId, portId, type)))

  const ringColor = useSignalStore((s) => {
    const plugged = wiresOn(s, nodeId, portId, type)
    if (plugged.length === 0) return 'var(--lsc-border)'
    const { wires, stages } = graphSignal(s.nodes, s.edges, s.measured)
    // An input holding several wires shows the health of their sum (clipping from the peaks)
    const signals = type === 'source'
      ? [wires.get(`${nodeId}:${portId}`)]
      : plugged.map((e) => wires.get(`${e.source}:${e.sourceHandle}`))
    const db   = sumSignalsToDb(signals.map(levelOf))
    const peak = sumSignalsToDb(signals.map(peakOf))
    // Judged in the domain of the card the signal comes from (dBu or dBFS)
    const from = type === 'source' ? nodeId : plugged[0].source
    return healthColor(getHealth(db, stages[from]?.domain, peak))
  })

  const wiring        = useSignalStore((s) => s.wire !== null)
  const isValidTarget = useSignalStore((s) => {
    const node = graphOf(s).node(nodeId)
    return type === 'target' && s.wire !== null && node !== undefined &&
      nodeAcceptsWire(node, s.wire.source, s.edges, s.nodes) && portAcceptsWire(node, portId, s.edges, s.wire.source)
  })

  const canUnplug  = type === 'target' && !wiring && connected.length > 0
  const showUnplug = canUnplug && (hovered || menuAt !== null)
  // L / R on an output carrying one side; "L+R" on a Matrix send (both sides on one wire)
  const isSend     = type === 'source' && portId === MATRIX_PORT
  const sideKind   = useSignalStore((s) => type === 'source' ? graphSignal(s.nodes, s.edges, s.measured).wires.get(`${nodeId}:${portId}`)?.kind : undefined)
  const side       = isSend ? 'L+R' : sideLetter(sideKind)
  const top        = PORT_TOP + row * PORT_GAP
  // The area the mouse finds the port in (index.css): PORT_REACH around it, up to half way to the
  // port above or below, so each part of the room between two ports belongs to the nearer one
  const shared = Math.min(PORT_REACH, PORT_GAP / 2)
  const reach = {
    '--lsc-port-reach': `${PORT_REACH}px`,
    '--lsc-port-up':    `${near.above ? shared : PORT_REACH}px`,
    '--lsc-port-down':  `${near.below ? shared : PORT_REACH}px`,
  } as CSSProperties

  function unplug(e: React.MouseEvent) {
    if (connected.length > 1) {
      setMenuAt((e.currentTarget as HTMLElement).getBoundingClientRect())
    } else {
      connected.forEach((edge) => removeEdge(edge.id))
    }
  }

  const className = ['lsc-port', isValidTarget && 'lsc-port-target', canUnplug && 'lsc-port-unplug', showUnplug && 'lsc-port-remove']
    .filter(Boolean).join(' ')

  return (
    <>
      <Handle
        id={portId}
        type={type}
        position={type === 'source' ? Position.Right : Position.Left}
        className={className}
        style={{ ...reach, top, borderColor: isValidTarget || showUnplug ? undefined : ringColor }}
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
