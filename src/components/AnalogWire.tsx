import { Fragment } from 'react'
import { buildWirePath, wireRuns } from '../utils/wirePath'
import type { RouteEnds } from '../utils/wirePath'
import { ANALOG_PERIOD, ANALOG_STOPS, FLOW_SPEED, shadeOf } from '../utils/wireLook'
import type { Pt } from '../utils/geometry'

// An analog wire: one unbroken line whose shades travel along it — long soft swells of light, the
// way the sound goes (the user's call, 2026-10-31). SVG has no gradient along a path, but a wire is
// straight runs at right angles: each run is drawn on its own, its stroke a repeating gradient
// pointing along it, phased by how far along the wire the run starts, so the swells carry on round
// the corners. The browser slides them by itself (SMIL, like SoundWaves' ripples): no React and no
// script while they move. The movement is shared: a run's gradient takes its moving
// gradientTransform from one of the SwellClock's eight (`href` — four ways a run can go, at two
// sizes), so the whole canvas runs eight animations, not one per run (measured headless, 64 wires:
// one per run cost ~2.3 times the old dashes). Stereo: two such lines side by side.

/** The four ways a run can go, as the clock's gradients are named */
type Way = 'right' | 'left' | 'down' | 'up'
const WAYS: Record<Way, Pt> = { right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, down: { x: 0, y: 1 }, up: { x: 0, y: -1 } }
const wayOf = (dir: Pt): Way => dir.x > 0 ? 'right' : dir.x < 0 ? 'left' : dir.y > 0 ? 'down' : 'up'
const clockId = (way: Way, thick: boolean) => `lsc-swell-${way}${thick ? '-wide' : ''}`

/**
 * The shared movement: one gradient per way and size, sliding a period along that way, over and
 * over (drawn once, under the canvas — it paints nothing).
 */
export function SwellClock() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        {[false, true].map((thick) => (Object.keys(WAYS) as Way[]).map((way) => {
          const period = ANALOG_PERIOD * (thick ? 2 : 1)
          // FLOW_SPEED at any size: zoomed out a period takes twice as long
          const dur    = `${period / FLOW_SPEED}s`
          return (
            <linearGradient key={clockId(way, thick)} id={clockId(way, thick)}>
              <animateTransform
                attributeName="gradientTransform"
                type="translate"
                from="0 0"
                to={`${WAYS[way].x * period} ${WAYS[way].y * period}`}
                dur={dur}
                repeatCount="indefinite"
              />
            </linearGradient>
          )
        }))}
      </defs>
    </svg>
  )
}

interface Props {
  /** The wire's id: its gradients' ids are made from it */
  id: string
  points: Pt[]
  ends: RouteEnds
  /** The wire's width; stereo, each line a little thinner */
  width: number
  /** Its colour (a CSS colour or variable): the shades are of it */
  color: string
  stereo: boolean
  /** Zoomed out: the swells twice as long (as fast) */
  thick: boolean
  /** No flow (at Beginner, a wire whose sound reaches nothing): a plain line in its colour */
  still: boolean
}

export function AnalogWire({ id, points, ends, width, color, stereo, thick, still }: Props) {
  const sides  = stereo ? [-0.85 * width, 0.85 * width] : [0]
  const lineW  = stereo ? 0.8 * width : width
  const period = ANALOG_PERIOD * (thick ? 2 : 1)
  const safe   = id.replace(/[^\w-]/g, '_')

  if (still) {
    return sides.map((side, s) => (
      <path key={s} d={buildWirePath(points, ends, 8, side)} fill="none" stroke={color} strokeWidth={lineW} />
    ))
  }
  return sides.map((side) => wireRuns(points, ends, 8, side)).map((side, s) => side.map((run, i) => {
    const gid = `lsc-shade-${safe}-${s}-${i}`
    // The gradient's 0 is where the wire starts, measured along the run's own direction
    const x1  = run.from.x - run.dir.x * run.at
    const y1  = run.from.y - run.dir.y * run.at
    return (
      <Fragment key={`${s}-${i}`}>
        <linearGradient
          id={gid}
          href={`#${clockId(wayOf(run.dir), thick)}`}
          gradientUnits="userSpaceOnUse"
          spreadMethod="repeat"
          x1={x1} y1={y1}
          x2={x1 + run.dir.x * period} y2={y1 + run.dir.y * period}
        >
          {ANALOG_STOPS.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} style={{ stopColor: shadeOf(color, stop.light) }} />
          ))}
        </linearGradient>
        <path d={run.d} fill="none" stroke={`url(#${gid})`} strokeWidth={lineW} />
      </Fragment>
    )
  }))
}
