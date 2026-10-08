import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useSignalStore } from '../store/signalStore'
import { newEdge } from '../graph/edits'
import { enforceGap } from '../utils/layoutHelpers'
import type { Pt } from '../utils/geometry'
import { wirePassesThroughNode } from '../utils/wireValidation'
import { nodeAcceptsWire, portAcceptsWire } from '../utils/connectionRules'
import { useCanvasLayout } from './useCanvasLayout'

/** The loose end of the wire being drawn: the cursor, the input it would land on, and whether it crosses a card. */
export interface WireCursor {
  pos: Pt
  /** The centre of the input under the cursor (the wire snaps to it) */
  snap: Pt | null
  /** The wire would run through another card */
  warning: boolean
}

/** The react-flow handle element at a screen point. */
function handleUnder(clientX: number, clientY: number): HTMLElement | null {
  return (
    document.elementsFromPoint(clientX, clientY)
      .find((el) => el.classList.contains('react-flow__handle')) as HTMLElement
  ) ?? null
}

/** Flow-coordinate centre of a handle DOM element. */
function handleFlowPos(el: HTMLElement, toFlow: (p: Pt) => Pt): Pt {
  const r = el.getBoundingClientRect()
  return toFlow({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
}

/**
 * The click that follows a press the canvas used — a wire started or ended, an element removed —
 * must not reach the cards: on the input just plugged in, NodePort's click would unplug it again.
 * Set `.current` during the press; the click is stopped before anything else sees it.
 */
export function useSwallowClick(): MutableRefObject<boolean> {
  const swallow = useRef(false)
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!swallow.current) return
      swallow.current = false
      e.stopPropagation()
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  return swallow
}

/**
 * Wiring, like a pen tool (never a drag). The canvas follows the mouse: over a port it is in
 * Connect mode, off every port back in Select mode (never while a wire is drawn).
 * Click an output to start a wire, click empty space to add a corner, click an input that takes it
 * to finish; right-click (or Esc, useCanvasShortcuts) cancels.
 * The wire's source and corners are the store's (`wire`); only its loose end, which follows the
 * cursor, is kept here. Listens in the capture phase, before React Flow's own handlers.
 */
export function useWireDrawing(
  wrapperRef: RefObject<HTMLDivElement | null>,
  swallowClick: MutableRefObject<boolean>,
): WireCursor | null {
  const { screenToFlowPosition } = useReactFlow()
  const layout = useCanvasLayout()
  const [cursor, setCursor] = useState<WireCursor | null>(null)

  // Hovering a port switches to Connect mode; moving away switches back.
  // While a wire is drawn, the cursor is tracked for the live preview instead.
  useEffect(() => {
    function followMouse(e: MouseEvent) {
      // A button is held: a node, slider or the canvas is being dragged — don't switch mid-drag
      if (e.buttons !== 0) return
      const { leftTool, toolMode, setToolMode } = useSignalStore.getState()
      // The Remove tool never wires: a click on a port removes its element
      if (leftTool === 'remove') {
        if (toolMode === 'connect') setToolMode('select')
        return
      }
      // Back at once: a delay would show Connect mode's look (no wire to click) between a port
      // and what is next to it — the unplug × and the wire it sits on flickered with a cross
      const overPort = handleUnder(e.clientX, e.clientY) !== null
      if (overPort !== (toolMode === 'connect')) setToolMode(overPort ? 'connect' : 'select')
    }

    function onMove(e: MouseEvent) {
      const { wire } = useSignalStore.getState()
      if (!wire) { followMouse(e); return }
      const pos      = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const hEl      = handleUnder(e.clientX, e.clientY)
      const onTarget = hEl?.classList.contains('target') ? hEl : null
      const snap     = onTarget ? handleFlowPos(onTarget, screenToFlowPosition) : null
      // The wire ends on its target's edge — only other cards in the way count as crossing
      const exclude = onTarget ? [wire.source.nodeId, onTarget.dataset.nodeid!] : [wire.source.nodeId]
      const warning = wirePassesThroughNode([wire.start, ...wire.waypoints, snap ?? pos], layout.layoutSnapshot(), exclude)
      setCursor({ pos, snap, warning })
    }

    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [screenToFlowPosition, layout])

  useEffect(() => {
    /** A new wire from the output `hEl`. */
    function startFrom(hEl: HTMLElement, at: Pt) {
      useSignalStore.getState().startWire(
        { nodeId: hEl.dataset.nodeid!, handleId: hEl.dataset.handleid! },
        handleFlowPos(hEl, screenToFlowPosition),
      )
      setCursor({ pos: at, snap: null, warning: false })
    }

    function onDown(e: MouseEvent) {
      if (e.button !== 0) return
      const store = useSignalStore.getState()
      // (A press the Remove tool used: keep its click swallowed)
      if (store.leftTool === 'remove' && swallowClick.current) { e.stopPropagation(); return }
      swallowClick.current = false
      const targetEl = e.target as Element
      // Only clicks on the canvas itself — not the palette, header or popovers (or a reshape handle)
      if (!wrapperRef.current?.contains(targetEl)) return
      if (targetEl.closest('.lsc-overlay')) return
      if (store.toolMode !== 'connect') return

      const { wire } = store
      const hEl      = handleUnder(e.clientX, e.clientY)
      const flowPos  = screenToFlowPosition({ x: e.clientX, y: e.clientY })

      if (!wire) {
        if (hEl?.classList.contains('source')) {
          e.stopPropagation()
          swallowClick.current = true
          startFrom(hEl, flowPos)
        } else if (hEl?.classList.contains('target')) {
          // An input's click unplugs its wire (NodePort) — keep React Flow from starting a drag-connection
          e.stopPropagation()
        }
        return
      }

      // Wire is being drawn — intercept ALL left-clicks on the canvas
      e.stopPropagation()
      // A press on a port also eats its click: on the input just plugged, that click would unplug it again
      if (hEl) swallowClick.current = true

      if (hEl?.classList.contains('target')) {
        const { nodes, edges } = store
        const targetNodeId     = hEl.dataset.nodeid!
        const targetHandleId   = hEl.dataset.handleid!
        const targetNode       = nodes.find((n) => n.id === targetNodeId)
        const { source }       = wire

        const allowed = targetNode !== undefined &&
          nodeAcceptsWire(targetNode, source, edges, nodes) &&
          portAcceptsWire(targetNode, targetHandleId, edges, source)

        if (!allowed) {
          if (targetNodeId !== source.nodeId) {
            hEl.classList.add('lsc-handle-rejected')
            setTimeout(() => hEl.classList.remove('lsc-handle-rejected'), 600)
          }
          return
        }

        store.addEdge(newEdge({
          source:       source.nodeId,
          sourceHandle: source.handleId,
          target:       targetNodeId,
          targetHandle: targetHandleId,
          waypoints:    wire.waypoints.length > 0 ? wire.waypoints : undefined,
        }))
        // (The wires before this one)
        store.setPositions(enforceGap(source.nodeId, targetNodeId, layout.layoutSnapshot(), edges))
        store.cancelWire()
        return
      }

      if (hEl?.classList.contains('source')) {
        startFrom(hEl, flowPos)
        return
      }

      // Click in empty space → commit a corner waypoint
      store.addWireCorner(flowPos)
    }

    function onContext(e: MouseEvent) {
      const { toolMode, wire, cancelWire } = useSignalStore.getState()
      if (toolMode !== 'connect' || !wire) return
      e.preventDefault()
      // The right-click only cancels the wire: it must not open the element's menu too
      e.stopPropagation()
      cancelWire()
    }

    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('contextmenu', onContext, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('contextmenu', onContext, true)
    }
  }, [screenToFlowPosition, layout, wrapperRef, swallowClick])

  return cursor
}
