import { PORT_TOP } from './layoutHelpers'

type Rect = { x: number; y: number; w: number; h: number }

export const SLOT_W = 200
export const SLOT_H = 132
const SLOT_GAP      = 80
const HEADLINE_H    = 110   // headline + sub-text block above the slots
const HEADLINE_GAP  = 48

export type GhostSlotKind = 'source' | 'preamp' | 'output'

export interface EmptyStateLayout {
  slots: { kind: GhostSlotKind; step: number; rect: Rect }[]
  /** Horizontal connector lines between slots / the master bus, at the port line. */
  lines: { x1: number; x2: number; y: number }[]
  headline: Rect
  /** Everything the camera should frame on an empty canvas. */
  bounds: Rect
}

/**
 * Flow-space geometry of the "start here" outline:
 * Source → Preamp → [Master Bus] → Output, or Source → Preamp → Output when there
 * is no fixed Master Bus (Beginner).
 */
export function emptyStateLayout(master: Rect | null): EmptyStateLayout {
  const top    = master?.y ?? 0
  const lineY  = top + PORT_TOP + 2
  const step   = SLOT_W + SLOT_GAP
  const srcX   = master ? master.x - 2 * step : 0
  const preX   = srcX + step
  const outX   = master ? master.x + master.w + SLOT_GAP : preX + step

  const slots: EmptyStateLayout['slots'] = [
    { kind: 'source', step: 1, rect: { x: srcX, y: top, w: SLOT_W, h: SLOT_H } },
    { kind: 'preamp', step: 2, rect: { x: preX, y: top, w: SLOT_W, h: SLOT_H } },
    { kind: 'output', step: 3, rect: { x: outX, y: top, w: SLOT_W, h: SLOT_H } },
  ]

  const lines = master
    ? [
        { x1: srcX + SLOT_W, x2: preX, y: lineY },
        { x1: preX + SLOT_W, x2: master.x, y: lineY },
        { x1: master.x + master.w, x2: outX, y: lineY },
      ]
    : [
        { x1: srcX + SLOT_W, x2: preX, y: lineY },
        { x1: preX + SLOT_W, x2: outX, y: lineY },
      ]

  const left   = srcX
  const right  = outX + SLOT_W
  const bottom = Math.max(top + SLOT_H, master ? master.y + master.h : 0)
  const headline = { x: left, y: top - HEADLINE_GAP - HEADLINE_H, w: right - left, h: HEADLINE_H }

  return {
    slots,
    lines,
    headline,
    bounds: { x: left, y: headline.y, w: right - left, h: bottom - headline.y },
  }
}
