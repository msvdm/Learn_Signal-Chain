import { useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useSignalStore } from '../store/signalStore'
import type { SignalEdge } from '../store/signalStore'
import { initialParams, isTypeKey } from '../data/nodeRegistry'
import type { TypeKey } from '../data/nodeRegistry'
import { activeDragTypeKey } from '../utils/dragState'
import { GRID, MIN_NODE_GAP, PORT_TOP, usualSize, resolveOverlap, makeRoomForInsert, findEdgeAtPoint } from '../utils/layoutHelpers'
import { hasFreeSides, sidesAlong } from '../graph/freeSides'
import type { Pt } from '../utils/geometry'
import { wireTakesCard } from '../graph/connectionRules'
import { isHiddenWire } from '../graph/interfaceLink'
import type { ParsedChain } from '../utils/chainFile'
import { useCanvasLayout } from './useCanvasLayout'
import { useChainFile } from './useChainFile'
import { useFitView } from './useFitView'

/**
 * Dropping onto the canvas: a palette tile becomes a card where it is dropped (cursor on its port
 * line, nudged clear of other cards), or goes in the middle of the wire it is dropped on; a saved
 * chain (.json or picture) dropped from the computer is added there. `preview` is where a dragged
 * tile would land; call `onMeasured` with every card size React Flow measures.
 */
export function usePaletteDrop(insertChainAt: (read: ParsedChain, at: Pt) => void) {
  const { screenToFlowPosition } = useReactFlow()
  const layout      = useCanvasLayout()
  const chainFile   = useChainFile()
  const { fitSoon } = useFitView()
  const [preview, setPreview] = useState<{ typeKey: TypeKey; pos: Pt } | null>(null)
  // A card just dropped onto a wire: the cards around it make room once its real size is known
  const pendingInsertRef = useRef<string | null>(null)

  /**
   * Where a card dropped at `raw` goes if it lands on a wire (null if it doesn't). On the wire's first
   * run, along its source's port line: right of the source and top-aligned with it, so the wires on
   * both sides stay straight, and the chain after it makes room (`straight`). Further along (a wire
   * turning down to a PFL Bus): where it is dropped, clear of the other cards. An On Off Switch
   * further along sits on the wire where it is dropped, its points along it (`sides`, the wire's
   * way there: in from behind, out ahead; its bends kept — `bendsBefore`).
   */
  function insertSlot(raw: Pt, typeKey: TypeKey): {
    edge: SignalEdge; pos: Pt; straight: boolean; sides?: ReturnType<typeof sidesAlong>; bendsBefore?: number
  } | null {
    // Edges from Zustand: always in sync, unlike getEdges() which can lag
    const view  = useSignalStore.getState()
    const cards = layout.layoutSnapshot(view.nodes)
    const hit   = findEdgeAtPoint(raw, view.edges.filter((e) => !isHiddenWire(e)), cards, view, view.complexityLevel)
    const edge  = hit?.edge
    const src   = edge && cards.find((n) => n.id === edge.source)
    if (!hit || !edge || !src || !wireTakesCard(typeKey, edge, view, view.complexityLevel)) return null
    if (!hit.firstRun && hasFreeSides(typeKey)) {
      const size  = usualSize(typeKey, view.complexityLevel, view.overview)
      const { from, to } = hit.run
      const sides = sidesAlong({ x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) })
      // Its points on the wire: across a level run, its port line on it; up or down one, its middle
      const pos   = from.y === to.y
        ? { x: Math.round(raw.x - size.w / 2), y: from.y - PORT_TOP }
        : { x: Math.round(from.x - size.w / 2), y: Math.round(raw.y - size.h / 2) }
      return { edge, pos, straight: false, sides, bendsBefore: hit.bendsBefore }
    }
    if (!hit.firstRun) {
      const size = usualSize(typeKey, view.complexityLevel, view.overview)
      return { edge, pos: resolveOverlap(layout.dropOrigin(raw), size, cards), straight: false }
    }
    const srcRight = src.position.x + src.size.w
    const minX     = Math.round((srcRight + MIN_NODE_GAP) / GRID) * GRID
    return { edge, pos: { x: Math.max(minX, layout.dropOrigin(raw).x), y: src.position.y }, straight: true }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const typeKey = activeDragTypeKey
    if (!typeKey) return
    const raw = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    // Over a wire, the preview shows where the card will really go
    setPreview({ typeKey, pos: insertSlot(raw, typeKey)?.pos ?? layout.dropOrigin(raw) })
  }

  function onDragLeave(e: React.DragEvent) {
    const rt = e.relatedTarget as Node | null
    if (rt && (e.currentTarget as Element).contains(rt)) return
    setPreview(null)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setPreview(null)
    // A saved chain (.json or picture) dropped from the computer goes where it is dropped
    const file = e.dataTransfer.files[0]
    if (file) {
      const at = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      chainFile.readFile(file).then((read) => { if (read) insertChainAt(read, at) })
      return
    }
    const typeKey = e.dataTransfer.getData('application/lsc-node-type')
    if (!isTypeKey(typeKey)) return
    const raw    = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const newId  = `${typeKey}-${Date.now()}`
    const store  = useSignalStore.getState()
    const params = initialParams(typeKey, store.complexityLevel)

    const slot = insertSlot(raw, typeKey)
    if (slot) {
      // One step: a Fader dropped on a bus's L / R wire becomes the Main Fader, and a card
      // dropped on a Mix wire sits between the bus and its Main Fader without unplugging it
      store.insertOnWire({ id: newId, typeKey, position: slot.pos, params: { ...params, ...slot.sides }, bypassed: false }, slot.edge.id, slot.bendsBefore)
      // The cards around it move once React Flow has measured it (onMeasured): a type not
      // dropped before has no known size yet. The card stays hidden until then, so no overlap shows.
      if (slot.straight) pendingInsertRef.current = newId
      return
    }

    const finalPos = resolveOverlap(layout.dropOrigin(raw), usualSize(typeKey, store.complexityLevel, store.overview), layout.layoutSnapshot())
    store.addNode({ id: newId, typeKey, position: finalPos, params, bypassed: false })
  }

  /** A card dropped onto a wire has its real size now: the cards around it move out of its way. */
  function onMeasured(nodeId: string, size: { width: number; height: number }) {
    if (nodeId !== pendingInsertRef.current) return
    pendingInsertRef.current = null
    const { nodes, edges, setPositions } = useSignalStore.getState()
    const placed = layout.layoutSnapshot(nodes)
      .map((n) => (n.id === nodeId ? { ...n, size: { w: size.width, h: size.height } } : n))
    setPositions(makeRoomForInsert(nodeId, placed, edges))
    fitSoon({ duration: 400 })
  }

  return { preview, onDragOver, onDragLeave, onDrop, onMeasured }
}
