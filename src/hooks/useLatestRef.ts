import { useLayoutEffect, useRef } from 'react'

/**
 * A ref that always holds the latest committed `value`, so document/window listeners can
 * read current state without re-subscribing. Synced in a layout effect (not during render):
 * it runs in the same commit, before the browser can dispatch the next mouse or key event.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value)
  useLayoutEffect(() => { ref.current = value })
  return ref
}
