import { useState } from 'react'
import { useLatestRef } from './useLatestRef'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any handler shape
type Handlers = Record<string, (...args: any[]) => unknown>

/**
 * The same handlers as functions that never change, each calling the latest version passed in.
 * For what is handed to React Flow: it passes its node handlers on to every card, so a new
 * function on each render would redraw every card on the canvas.
 */
export function useStableHandlers<T extends Handlers>(handlers: T): T {
  const latest   = useLatestRef(handlers)
  const [stable] = useState(() => Object.fromEntries(
    Object.keys(handlers).map((key) => [key, (...args: unknown[]) => latest.current[key](...args)]),
  ) as T)
  return stable
}
