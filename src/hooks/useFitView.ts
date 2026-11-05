import { useCallback, useMemo } from 'react'
import { getViewportForBounds, useReactFlow, useStore } from '@xyflow/react'
import type { FitViewOptions, Node as FlowNode } from '@xyflow/react'
import { usePaletteWidth } from './usePaletteWidth'

/** Zoomed out at most this far while the chain fits on screen at it… */
const MIN_ZOOM = 0.15
/** …further on a bigger one, as far as it takes to see it whole, a little past that — never below this */
const FLOOR_ZOOM = 0.02
const MARGIN = 0.9

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
    // (The canvas's own limit, useMinZoom, follows the chain: a fit is never stopped short of it)
    minZoom: FLOOR_ZOOM,
    maxZoom: 1,
    duration: 300,
  }), [paletteWidth])
  const fitSoon = useCallback((more: FitViewOptions = {}) => {
    setTimeout(() => fitView({ ...fitViewOptions, ...more }), 50)
  }, [fitView, fitViewOptions])
  return { fitViewOptions, fitSoon }
}

/**
 * How far the canvas zooms out: 15%, or as far as it takes to see every element at once (as
 * "Show everything" fits them, with a little room round them) when that is further.
 */
export function useMinZoom(nodes: FlowNode[]): number {
  const { getNodesBounds } = useReactFlow()
  const { fitViewOptions } = useFitView()
  const width  = useStore((s) => s.width)
  const height = useStore((s) => s.height)
  return useMemo(() => {
    if (nodes.length === 0 || !width || !height) return MIN_ZOOM
    const fit = getViewportForBounds(getNodesBounds(nodes), width, height, FLOOR_ZOOM, 1, fitViewOptions.padding).zoom
    return Math.max(FLOOR_ZOOM, Math.min(MIN_ZOOM, fit * MARGIN))
  }, [nodes, width, height, getNodesBounds, fitViewOptions.padding])
}
