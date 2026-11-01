import { useSignalStore } from '../store/signalStore'
import { useMediaQuery, TABLET_QUERY } from './useMediaQuery'

/** The element palette's width: tiles in two columns, or an icon rail at tablet width. */
export const PALETTE_WIDTH      = 240
export const PALETTE_RAIL_WIDTH = 64

/** How much of the canvas's left side the palette covers (it slides over the canvas; 0 when hidden). */
export function usePaletteWidth(): number {
  const open     = useSignalStore((s) => s.paletteOpen)
  const isTablet = useMediaQuery(TABLET_QUERY)
  return open ? (isTablet ? PALETTE_RAIL_WIDTH : PALETTE_WIDTH) : 0
}
