import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react'
import { X } from 'lucide-react'
import { useShallow } from 'zustand/shallow'
import { useSignalStore } from '../../store/signalStore'
import { getHealth, healthColor, sumSignalsToDb } from '../../signal/levels'
import { levelOf, outDomainOf, peakOf } from '../../signal/engine'
import { signalIn } from '../../hooks/useGraphSignal'
import { SIGNAL_LEVEL, atLeast } from '../../data/levels'
import { graphOf, outputKey } from '../../graph/graph'
import type { GraphView } from '../../graph/graph'
import { nodeAcceptsWire, portAcceptsWire } from '../../graph/connectionRules'
import { outputKind, wiresIntoPort } from '../../graph/queries'
import { PORT_TOP, PORT_GAP, PORT_REACH } from '../../utils/layoutHelpers'
import { sideLetter } from '../../utils/nodeName'
import { UnplugMenu } from '../UnplugMenu'
import { MATRIX_PORT, portFacing } from '../../data/nodeRegistry'
import type { Facing, PortLabel, SignalEdge } from '../../data/nodeRegistry'
import { useTranslation } from '../../i18n/useTranslation'

/** The wires on this port: plugged into it — on an Amplifier's other input, the stereo wire split into both (D27). */
function wiresOn(graph: GraphView, nodeId: string, portId: string, type: 'source' | 'target'): SignalEdge[] {
  return type === 'source'
    ? graphOf(graph).from(nodeId).filter((e) => e.sourceHandle === portId)
    : wiresIntoPort(nodeId, portId, graph)
}

/** React Flow's side for each way a port faces */
const POSITION: Record<Facing, Position> = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom }

/** Where an output's L / R letter goes: right of the ring, just above its wire (left of it, facing left; beside it, top or bottom) */
function letterPlace(facing: Facing, top: number | string, send: boolean): CSSProperties {
  const away  = send ? -36 : -24
  const above = typeof top === 'number' ? top - 17 : `calc(${top} - 17px)`
  switch (facing) {
    case 'right':  return { top: above, right: away }
    case 'left':   return { top: above, left: away }
    case 'top':    return { top: -24, left: 'calc(50% + 18px)' }
    case 'bottom': return { bottom: -24, left: 'calc(50% + 18px)' }
  }
}

/** Where a port's name goes: beside the ring, above its wire (beside it, on a top or bottom edge) */
function namePlace(facing: Facing, top: number | string): CSSProperties {
  const above = typeof top === 'number' ? top - 19 : `calc(${top} - 19px)`
  switch (facing) {
    case 'right':  return { top: above, left: 'calc(100% + 18px)' }
    case 'left':   return { top: above, right: 'calc(100% + 18px)' }
    case 'top':    return { top: -24, left: 'calc(50% + 18px)' }
    case 'bottom': return { bottom: -24, left: 'calc(50% + 18px)' }
  }
}

interface NodePortProps {
  nodeId: string
  portId: string
  type: 'source' | 'target'
  /** Its port line (0 = the first, just below the header) */
  row: number
  /** Halfway down its card's side instead (a Sound output: NodePort `middle` in the registry) */
  middle?: boolean
  /** Its name, beside its ring (NodePort `label` in the registry: the Guitar Amp's DI Out) */
  label?: PortLabel
  /** Another port of its stack on the line above / below */
  near: { above: boolean; below: boolean }
}

/**
 * One input or output port on a node card.
 * - The ring colour is the health of the signal on this port (grey when unconnected; at Beginner
 *   the wires' one colour when plugged — D20).
 * - While a wire is being drawn, free inputs that can take it pulse in the accent colour.
 * - Hovering a connected input turns it into a × — click it to unplug the wire (not while drawing one).
 *   A bus input holding several wires opens a list instead, so you pick which wire to unplug.
 *   Outputs never do: clicking an output always starts a new wire, so one signal can feed several inputs.
 * - An output that carries one side of a stereo mix (a bus's L / R output, or an effect fed one)
 *   shows a small L / R letter beside the dot.
 */
export function NodePort({ nodeId, portId, type, row, middle = false, label, near }: NodePortProps) {
  const { t } = useTranslation()
  const removeEdge = useSignalStore((s) => s.removeEdge)
  const [hovered, setHovered]   = useState(false)
  const [menuAt, setMenuAt]     = useState<DOMRect | null>(null)
  const updateNodeInternals     = useUpdateNodeInternals()

  // Each piece is read on its own, so the port is redrawn only when one of them changes
  const connected = useSignalStore(useShallow((s) => wiresOn(s, nodeId, portId, type)))

  // The side of the card it sits on (a flipped card's ports face another way): once it turns, React
  // Flow re-reads the port so its wires leave from where it is now
  const facing = useSignalStore((s) => {
    const node = graphOf(s).node(nodeId)
    return node ? portFacing(node, type) : type === 'source' ? 'right' : 'left'
  })
  const lastFacing = useRef(facing)
  useEffect(() => {
    if (lastFacing.current === facing) return
    lastFacing.current = facing
    updateNodeInternals(nodeId)
  }, [facing, nodeId, updateNodeInternals])

  const ringColor = useSignalStore((s) => {
    const plugged = wiresOn(s, nodeId, portId, type)
    if (plugged.length === 0) return 'var(--lsc-card-edge)'
    // Beginner judges no signal (D20): a plugged port is the wires' one colour
    if (!atLeast(s.complexityLevel, SIGNAL_LEVEL)) return 'var(--lsc-wire-neutral)'
    const { wires, stages } = signalIn(s)
    // An input holding several wires shows the health of their sum (clipping from the peaks)
    const signals = type === 'source'
      ? [wires.get(outputKey(nodeId, portId))]
      : plugged.map((e) => wires.get(outputKey(e.source, e.sourceHandle)))
    const db   = sumSignalsToDb(signals.map(levelOf))
    const peak = sumSignalsToDb(signals.map(peakOf))
    // Judged in the domain of the output the signal comes from (dBu or dBFS)
    const from = type === 'source' ? { id: nodeId, port: portId } : { id: plugged[0].source, port: plugged[0].sourceHandle }
    return healthColor(getHealth(db, outDomainOf(stages[from.id], from.port), peak))
  })

  const wiring        = useSignalStore((s) => s.wire !== null)
  const isValidTarget = useSignalStore((s) => {
    const node = graphOf(s).node(nodeId)
    return type === 'target' && s.wire !== null && node !== undefined &&
      nodeAcceptsWire(node, s.wire.source, s.edges, s.nodes, s.complexityLevel) && portAcceptsWire(node, portId, s.edges, s.wire.source, s.nodes)
  })

  const canUnplug  = type === 'target' && !wiring && connected.length > 0
  const showUnplug = canUnplug && (hovered || menuAt !== null)
  // L / R on an output carrying one side; "L+R" on a send (both sides on one wire), in the Matrix's
  // colour while it feeds a Matrix Bus
  const isSend     = type === 'source' && portId === MATRIX_PORT
  const toMatrix   = useSignalStore((s) => isSend && s.edges.some((e) =>
    e.source === nodeId && e.sourceHandle === MATRIX_PORT && graphOf(s).node(e.target)?.typeKey === 'matrix-bus'))
  // (At Beginner, where no signal is worked out, what the wiring makes of the output)
  const sideKind   = useSignalStore((s) => type !== 'source' ? undefined
    : atLeast(s.complexityLevel, SIGNAL_LEVEL) ? signalIn(s).wires.get(outputKey(nodeId, portId))?.kind
    : outputKind(nodeId, portId, s))
  const side       = isSend ? 'L+R' : sideLetter(sideKind)
  const top        = middle ? '50%' : PORT_TOP + row * PORT_GAP
  // On a top or bottom edge (a card on its side): in the middle of it, where React Flow puts it
  const upright    = facing === 'top' || facing === 'bottom'
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
        position={POSITION[facing]}
        className={className}
        style={{ ...reach, ...(upright ? {} : { top }), borderColor: isValidTarget || showUnplug ? undefined : ringColor }}
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
            // Beside the ring, just above the wire leaving it (beside it, on a top or bottom edge)
            position: 'absolute', ...letterPlace(facing, top, isSend),
            fontSize: 10, fontWeight: 800, lineHeight: 1,
            color: toMatrix ? 'var(--lsc-wire-matrix)' : 'var(--lsc-fg-muted)', pointerEvents: 'none',
          }}
        >
          {side}
        </span>
      )}
      {label && (
        <span
          aria-hidden
          style={{
            position: 'absolute', ...namePlace(facing, top),
            fontSize: 11, fontWeight: 800, lineHeight: 1, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
            color: 'var(--lsc-fg-muted)', pointerEvents: 'none',
          }}
        >
          {t.ports[label]}
        </span>
      )}
      {menuAt && <UnplugMenu wires={connected} anchor={menuAt} onClose={() => setMenuAt(null)} />}
    </>
  )
}
