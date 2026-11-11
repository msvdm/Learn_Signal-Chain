import { useSignalStore } from '../store/signalStore'
import { useMediaQuery, DEEP_DIVE_RAIL_QUERY, TABLET_QUERY } from './useMediaQuery'

/** The element palette's width: tiles in two columns, or an icon rail at tablet width. */
export const PALETTE_WIDTH      = 240
export const PALETTE_RAIL_WIDTH = 64

/**
 * How much of the canvas's left side the palette covers (it slides over the canvas; 0 when hidden)
 * — in Deep dive, its drawer of subjects (a rail up to a wider width: `useRail`).
 */
export function usePaletteWidth(): number {
  const open = useSignalStore((s) => s.paletteOpen)
  const rail = useRail()
  return open ? (rail ? PALETTE_RAIL_WIDTH : PALETTE_WIDTH) : 0
}

/** Whether the palette — in Deep dive, the subjects' drawer — is a rail of icons. */
export function useRail(): boolean {
  const deepDive = useSignalStore((s) => s.deepDive)
  const isTablet = useMediaQuery(TABLET_QUERY)
  const deepRail = useMediaQuery(DEEP_DIVE_RAIL_QUERY)
  return deepDive ? deepRail : isTablet
}
