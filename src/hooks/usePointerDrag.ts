import { useEffect, useRef } from 'react'
import { useLatestRef } from './useLatestRef'

/**
 * A press on a control: only the main button counts — a right-click opens the element's menu
 * instead — and it is kept from the canvas (no card drag, no pan, no text selection).
 * False for any other button: do nothing then.
 */
export function takePress(e: React.PointerEvent): boolean {
  if (e.button !== 0) return false
  e.stopPropagation()
  e.preventDefault()
  return true
}

/**
 * Dragging a control (knob, fader, slider, EQ dot): `start(state)` from its pointer-down, then
 * `move` gets every pointer move anywhere on the page, with `state`, until the button is released.
 * `move` and `end` may change every render; the latest is used.
 */
export function usePointerDrag<T>(move: (e: PointerEvent, state: T) => void, end?: () => void) {
  const state     = useRef<T | null>(null)
  const handlers  = useLatestRef({ move, end })

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (state.current !== null) handlers.current.move(e, state.current)
    }
    const onUp = () => {
      if (state.current === null) return
      state.current = null
      handlers.current.end?.()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [handlers])

  return {
    start: (s: T) => { state.current = s },
    /** A drag is under way */
    active: () => state.current !== null,
  }
}
