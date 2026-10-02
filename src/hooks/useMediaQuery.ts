import { useSyncExternalStore } from 'react'

/** Live result of a CSS media query, e.g. useMediaQuery('(max-width: 1024px)'). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

/** Tablet layout: palette collapses to an icon rail, header drops the tagline. */
export const TABLET_QUERY = '(max-width: 1024px)'
