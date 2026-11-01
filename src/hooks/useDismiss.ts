import { useEffect } from 'react'
import type { RefObject } from 'react'
import { useLatestRef } from './useLatestRef'

/**
 * Closes a popup (a menu, a list) on a mouse press outside `ref`, and on Escape with `escape`.
 * `capture`: the press is seen before anything else handles it, so even one that stops its own
 * events (a wire's reshape handle) closes it; without it (the header's menus), such a press does not.
 * Off while `open` is false. `onClose` may change every render; the latest is called.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  { open = true, escape = false, capture = false } = {},
) {
  const close = useLatestRef(onClose)
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close.current()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close.current()
    }
    document.addEventListener('mousedown', onDown, capture)
    if (escape) document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown, capture)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, close, open, escape, capture])
}
