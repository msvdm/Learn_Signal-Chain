import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'
import type { Dot } from '../wave'
import type { ShapeId } from '../subjects'

// How a Deep dive scene moves (D46): its painter, made from its picture once it is in the page
// and handed to the player, which calls it on every picture — outside React.

/**
 * Draws a scene at a phase (degrees, 0 … 360) — called by the player on every picture, outside
 * React (movement never goes through React). `step`: the step shown; what a later step adds is not
 * on screen, so it is not moved. `shape`: the shape picked, at the step that has them.
 */
export type Painter = (deg: number, step: number, shape?: ShapeId) => void

export interface SceneProps {
  /** The step shown (from 1): its parts and every earlier step's are on screen */
  step: number
  /** The shape picked, at the step that has them (`Subject.shapes`) */
  shape?: ShapeId
  /** The scene hands the player its painter once its picture is in the page (null when it leaves) */
  onPainter: (painter: Painter | null) => void
}

/** Makes a scene's painter from its picture, and hands it to the player. */
export function usePainter(
  root: RefObject<SVGGElement | null>,
  onPainter: SceneProps['onPainter'],
  make: (find: Finder) => Painter,
) {
  useLayoutEffect(() => {
    const g = root.current
    if (!g) return
    onPainter(make(finderIn(g)))
    return () => onPainter(null)
  }, [root, onPainter, make])
}

/** Finds a scene's moving parts by their `data-p` name. */
export interface Finder {
  <T extends SVGElement = SVGElement>(name: string): T
  /** A group's children, in order (its particles, a coil's turns) */
  all<T extends SVGElement = SVGElement>(name: string): T[]
  /** Fills a group with one small circle per dot (a cloud of air) and hands them back */
  dots(name: string, dots: readonly Dot[], r?: number): SVGCircleElement[]
}

function finderIn(root: SVGGElement): Finder {
  const find = (<T extends SVGElement>(name: string) => {
    const el = root.querySelector<T>(`[data-p="${name}"]`)
    if (!el) throw new Error(`Deep dive: no part named ${name}`)
    return el
  }) as Finder
  find.all = <T extends SVGElement>(name: string) => Array.from(find(name).children) as T[]
  find.dots = (name, dots, r = 2) => {
    const circles = dots.map((dot) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      c.setAttribute('r', String(r))
      c.setAttribute('cx', dot.x.toFixed(1))
      c.setAttribute('cy', dot.y.toFixed(1))
      return c
    })
    // Replaced, never added to: the picture is made again when the scene is (a hot reload, StrictMode)
    find(name).replaceChildren(...circles)
    return circles
  }
  return find
}

/** Writes a number into an attribute, to a tenth of a unit. */
export function put(el: SVGElement, attr: string, value: number) {
  el.setAttribute(attr, value.toFixed(1))
}
