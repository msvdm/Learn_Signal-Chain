import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * An element's height (px, its layout box — a zoom of the canvas does not change it), kept up to
 * date as it resizes; 0 until it is first measured.
 */
export function useHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return height
}
