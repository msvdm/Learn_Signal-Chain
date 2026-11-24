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
 * Deep dive's drawer is a rail of icons up to here (D46): the steps' row holds a subject's
 * shapes too, which Bulgarian needs 1169px for beside the wide drawer.
 */
export const DEEP_DIVE_RAIL_QUERY = '(max-width: 1279px)'

// The header's widths, measured on its longest text (Bulgarian, four level buttons since Dive
// deepDive — D46): each step leaves it some 45px to spare.

/**
 * Wide enough for the header's tagline and the level stepper's usual letters (Bulgarian needs
 * 1232px). Narrower, the tagline goes, the title wraps and the stepper's buttons are smaller.
 */
export const WIDE_HEADER_QUERY = '(min-width: 1280px)'

/** Wide enough for the long lines between the stepper's buttons (1280px); narrower, short ones. */
export const ROOMY_HEADER_QUERY = '(min-width: 1340px)'

/**
 * Wide enough for Snap to grid's and Light / Dark's words too (1476px). Narrower, they show only
 * their icons.
 */
export const HEADER_LABELS_QUERY = '(min-width: 1520px)'
