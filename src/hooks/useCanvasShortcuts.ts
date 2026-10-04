import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useSignalStore } from '../store/signalStore'
import type { Pt } from '../utils/layoutHelpers'
import type { Direction } from '../utils/nodeGroup'
import { pressedInside, typingInField } from '../utils/shortcut'
import { useLatestRef } from './useLatestRef'

export interface CanvasActions {
  duplicateNodes: (ids: string[], dir: Direction) => void
  copyNodes: (ids: string[]) => void
  cutNodes: (ids: string[]) => void
  pasteAt: (at: Pt | null) => void
  removeSelected: (ids: string[]) => void
}

/**
 * The canvas keys. Esc cancels the wire being drawn, otherwise closes the help popover, otherwise
 * drops the selection. Ctrl / ⌘ + C, X, V (at the mouse when it is over the canvas), D (duplicate
 * to the right), A (select everything), Z (undo), Shift+Z or Y (redo); Delete / Backspace removes
 * the selection. Not while typing in a field — nor, except Esc, in an open menu or dialog.
 */
export function useCanvasShortcuts(wrapperRef: RefObject<HTMLDivElement | null>, actions: CanvasActions) {
  const { screenToFlowPosition } = useReactFlow()
  const actionsRef = useLatestRef(actions)
  // Last mouse position on screen — Ctrl+V pastes there when it is over the canvas
  const lastMouseRef = useRef<Pt | null>(null)

  useEffect(() => {
    function onMove(e: MouseEvent) {
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
    }

    function onKey(e: KeyboardEvent) {
      if (typingInField(e)) return
      const store = useSignalStore.getState()
      if (e.key === 'Escape') {
        if (store.wire) store.cancelWire()
        else if (store.activeTooltipId) store.setActiveTooltip(null, null)
        else store.setSelection([])
        return
      }
      if (pressedInside(e, '[role="menu"], [role="dialog"]')) return
      const a   = actionsRef.current
      const ids = store.selectedNodeIds
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (ids.length > 0) { e.preventDefault(); a.removeSelected(ids) }
        return
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 'z') (e.shiftKey ? store.redo : store.undo)()
      else if (key === 'y') store.redo()
      else if (key === 'c' && ids.length > 0) a.copyNodes(ids)
      else if (key === 'x' && ids.length > 0) a.cutNodes(ids)
      else if (key === 'd' && ids.length > 0) a.duplicateNodes(ids, 'right')
      else if (key === 'v') {
        const m    = lastMouseRef.current
        const over = m && wrapperRef.current?.contains(document.elementFromPoint(m.x, m.y))
        a.pasteAt(over ? screenToFlowPosition(m) : null)
      } else if (key === 'a') store.setSelection(store.nodes.map((n) => n.id))
      else return
      e.preventDefault()
    }

    document.addEventListener('mousemove', onMove)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousemove', onMove)
      window.removeEventListener('keydown', onKey)
    }
  }, [actionsRef, screenToFlowPosition, wrapperRef])
}
