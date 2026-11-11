import { useSignalStore } from '../store/signalStore'
import { useMediaQuery, DEEPER_RAIL_QUERY, TABLET_QUERY } from './useMediaQuery'

/** The element palette's width: tiles in two columns, or an icon rail at tablet width. */
export const PALETTE_WIDTH      = 240
export const PALETTE_RAIL_WIDTH = 64

/**
 * How much of the canvas's left side the palette covers (it slides over the canvas; 0 when hidden)
 * — in Dive deeper, its drawer of subjects (a rail up to a wider width: `useRail`).
 */
export function usePaletteWidth(): number {
  const open = useSignalStore((s) => s.paletteOpen)
  const rail = useRail()
  return open ? (rail ? PALETTE_RAIL_WIDTH : PALETTE_WIDTH) : 0
}

/** Whether the palette — in Dive deeper, the subjects' drawer — is a rail of icons. */
export function useRail(): boolean {
  const deeper   = useSignalStore((s) => s.deeper)
  const isTablet = useMediaQuery(TABLET_QUERY)
  const deepRail = useMediaQuery(DEEPER_RAIL_QUERY)
  return deeper ? deepRail : isTablet
}
