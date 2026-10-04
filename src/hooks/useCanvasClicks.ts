import { useEffect, useRef } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import { useStoreApi } from '@xyflow/react'
import type { Node as FlowNode, NodeChange } from '@xyflow/react'
import { useSignalStore } from '../store/signalStore'

/** What is used, not selected, when clicked inside a card: its controls and ports. */
const INTERACTIVE = '.nodrag, button, input, select, textarea, a, [role="slider"], .react-flow__handle'

/** The element (card or control) or wire a Remove-tool click lands on, if any. */
function removeTargetOf(target: EventTarget | null): { node?: string; edge?: string } | null {
  const el = target as Element | null
  if (!el?.closest || el.closest('.lsc-overlay, .react-flow__panel')) return null
  const node = el.closest('.react-flow__node')?.getAttribute('data-id')
  if (node) return { node }
  const edge = el.closest('.react-flow__edge')?.getAttribute('data-id')
  return edge ? { edge } : null
}

/** A click selects in Select mode (Connect mode is over a port or while wiring), not with the Remove tool. */
function canSelect(): boolean {
  const { toolMode, leftTool } = useSignalStore.getState()
  return toolMode === 'select' && leftTool !== 'remove'
}

/**
 * What a left-click on the canvas does, by the left-click tool (CanvasTools). Selecting is ours, not
 * React Flow's: a click on an element's empty part selects it (the Select tool, Ctrl / ⌘ or Shift
 * add or drop it), React Flow's selection box adds what it touches, dragging never selects. The
 * Remove tool removes the element or wire pressed. Returns React Flow's handlers.
 */
export function useCanvasClicks(
  wrapperRef: RefObject<HTMLDivElement | null>,
  swallowClick: MutableRefObject<boolean>,
) {
  const flowStore = useStoreApi()
  // Where the last press started and whether it was on a control (see onNodeClick)
  const pressRef = useRef<{ x: number; y: number; onControl: boolean } | null>(null)

  // Capture phase, before React Flow's own handlers
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      pressRef.current = { x: e.clientX, y: e.clientY, onControl: Boolean((e.target as Element).closest?.(INTERACTIVE)) }
      // Remove tool: a press on an element or wire removes it. Pointer events come first — knobs
      // and faders listen to them — so nothing inside the card reacts to the press.
      const { leftTool, removeNode, removeEdge } = useSignalStore.getState()
      if (e.button !== 0 || leftTool !== 'remove') return
      // A removed element takes its click with it — a flag left from that press must not eat this one
      swallowClick.current = false
      if (!wrapperRef.current?.contains(e.target as Element)) return
      const hit = removeTargetOf(e.target)
      if (!hit) return
      e.preventDefault()
      e.stopPropagation()
      swallowClick.current = true
      if (hit.node) removeNode(hit.node)
      else if (hit.edge) removeEdge(hit.edge)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [wrapperRef, swallowClick])

  /**
   * A click on an element selects it — only on its empty parts: using a knob, slider, button or
   * port is not selecting the card. The Select tool (or Ctrl / ⌘ / Shift) adds it to the
   * selection, or drops it again.
   */
  function onNodeClick(e: React.MouseEvent, node: FlowNode) {
    // Judged by where the press started: a knob drag that ends off the knob clicks the card itself
    const press = pressRef.current
    const moved = press ? Math.hypot(e.clientX - press.x, e.clientY - press.y) > 4 : false
    if (!canSelect() || press?.onControl || moved || (e.target as Element).closest(INTERACTIVE)) return
    const { selectedNodeIds: selected, leftTool, setSelection } = useSignalStore.getState()
    const toggle = leftTool === 'select' || e.ctrlKey || e.metaKey || e.shiftKey
    if (!toggle) setSelection([node.id])
    else setSelection(selected.includes(node.id) ? selected.filter((id) => id !== node.id) : [...selected, node.id])
  }

  /**
   * Dragging an element of the selection moves the whole selection; dragging any other element
   * moves just that one (React Flow drags it alone) and does not select it — the old selection is dropped.
   */
  function onNodeDragStart(e: React.MouseEvent, node: FlowNode) {
    const { selectedNodeIds: selected, setSelection } = useSignalStore.getState()
    if (selected.includes(node.id)) return
    // Ctrl-drag: React Flow takes the selection along with it
    if (e.ctrlKey || e.metaKey) setSelection([...selected, node.id])
    else if (selected.length > 0) setSelection([])
  }

  /**
   * React Flow selects on any click inside a card and when a drag starts; only its selection box
   * counts (its rectangle is set before the box's first change). Clicks: onNodeClick.
   */
  function selectFromBox(changes: NodeChange[]) {
    if (flowStore.getState().userSelectionRect === null) return
    let selection: Set<string> | null = null
    for (const c of changes) {
      if (c.type !== 'select') continue
      selection ??= new Set(useSignalStore.getState().selectedNodeIds)
      if (c.selected) selection.add(c.id)
      else selection.delete(c.id)
    }
    if (selection) useSignalStore.getState().setSelection([...selection])
  }

  function onPaneClick() {
    if (!canSelect()) return
    const { setSelection, setHelp } = useSignalStore.getState()
    setSelection([])
    setHelp(null)
  }

  return { onNodeClick, onNodeDragStart, selectFromBox, onPaneClick }
}
