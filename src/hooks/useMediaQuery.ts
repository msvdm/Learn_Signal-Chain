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

/** Tablet layout: palette collapses to an icon rail. */
export const TABLET_QUERY = '(max-width: 1024px)'

/**
 * Wide enough for the header's tagline and every button's text label (the longest is Bulgarian,
 * about 1250px). Narrower, the tagline goes and Snap to grid / Light-Dark show only their icons.
 */
export const WIDE_HEADER_QUERY = '(min-width: 1280px)'
