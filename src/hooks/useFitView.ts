import { useCallback, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { FitViewOptions } from '@xyflow/react'
import { usePaletteWidth } from './usePaletteWidth'

/**
 * "Show everything": the elements fitted into the part of the canvas the palette leaves free, never
 * above 100%. `fitSoon` fits once the cards just added are drawn and measured (`more` narrows it to
 * some elements, limits the zoom, …).
 */
export function useFitView() {
  const paletteWidth = usePaletteWidth()
  const { fitView }  = useReactFlow()
  const fitViewOptions = useMemo(() => ({
    padding: { top: 0.1, right: 0.1, bottom: 0.1, left: `${paletteWidth + 48}px` } as const,
    maxZoom: 1,
    duration: 300,
  }), [paletteWidth])
  const fitSoon = useCallback((more: FitViewOptions = {}) => {
    setTimeout(() => fitView({ ...fitViewOptions, ...more }), 50)
  }, [fitView, fitViewOptions])
  return { fitViewOptions, fitSoon }
}
