import type { Facing } from '../data/nodeRegistry'
import { PORT_TOP } from './cardGeometry'
import type { Pt } from './geometry'

const MIN_EXIT = 40

/**
 * The sides of its cards a wire leaves (`from`, its output's) and enters (`to`, its input's) by —
 * right and left unless a card is flipped (portFacing).
 */
export interface RouteEnds {
  from?: Facing
  to?: Facing
}

const STEP: Record<Facing, Pt> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } }
const upright = (f: Facing) => f === 'top' || f === 'bottom'
const outOf   = (p: Pt, f: Facing): Pt => ({ x: p.x + STEP[f].x * MIN_EXIT, y: p.y + STEP[f].y * MIN_EXIT })

/**
 * Corner points of the orthogonal route through a series of flow-coordinate points.
 *
 * Rules:
 * - The first segment exits rightward from the source handle with a minimum
 *   horizontal departure of MIN_EXIT px so the wire never doubles back immediately.
 * - Every subsequent segment uses an H→V→H elbow (horizontal then vertical then
 *   horizontal) so all turns are at right angles.
 * - Two points produce the simplest possible elbow; additional waypoints add
 *   extra corner segments as the user places them.
 */
export function orthogonalRoute(points: Pt[], ends: RouteEnds = {}): Pt[] {
  const from = ends.from ?? 'right'
  const to   = ends.to ?? 'left'
  if (from !== 'right' || to !== 'left') return turnedRoute(points, from, to)
  const route: Pt[] = [points[0]]
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const pivot = i === 0
      ? Math.max(a.x + MIN_EXIT, (a.x + b.x) / 2)
      : (a.x + b.x) / 2
    route.push({ x: pivot, y: a.y }, { x: pivot, y: b.y }, b)
  }
  return withoutRepeats(route)
}

/** Drop zero-length segments so corner rounding sees real turns only */
function withoutRepeats(route: Pt[]): Pt[] {
  return route.filter((p, i) => i === 0 || p.x !== route[i - 1].x || p.y !== route[i - 1].y)
}

/**
 * The route of a wire from or to a flipped card: straight out of its output's side and into its
 * input's, MIN_EXIT long each, and right-angled elbows between — a wire leaving or entering
 * upright turns once (vertical, then horizontal), between two sides H→V→H, between top and bottom
 * V→H→V. A side port facing away from where the wire goes or comes from (a speaker turned toward
 * the band, fed from the desk on its left) is reached over its card: the wire runs MIN_EXIT above
 * the card's top (its port line is PORT_TOP below it).
 */
function turnedRoute(points: Pt[], from: Facing, to: Facing): Pt[] {
  const a    = points[0]
  const b    = points[points.length - 1]
  const mids = [outOf(a, from), ...points.slice(1, -1), outOf(b, to)]
  const route: Pt[] = [a, mids[0]]
  for (let i = 0; i < mids.length - 1; i++) {
    const p = mids[i]
    const q = mids[i + 1]
    const leavesUpright = i === 0 && upright(from)
    const entersUpright = i === mids.length - 2 && upright(to)
    // A flipped output facing left with the wire going right, or a flipped input facing right with
    // the wire coming from the left: over the card (an ordinary port's wire goes back as it always has)
    const leavesBack  = i === 0 && from === 'left' && q.x > p.x
    const entersBack  = i === mids.length - 2 && to === 'right' && p.x < q.x
    if (leavesBack || entersBack) {
      const over = Math.min(leavesBack ? a.y : Infinity, entersBack ? b.y : Infinity) - PORT_TOP - MIN_EXIT
      route.push({ x: p.x, y: over }, { x: q.x, y: over }, q)
    } else if (leavesUpright && entersUpright) {
      const midY = (p.y + q.y) / 2
      route.push({ x: p.x, y: midY }, { x: q.x, y: midY }, q)
    } else if (leavesUpright) {
      route.push({ x: p.x, y: q.y }, q)
    } else if (entersUpright) {
      route.push({ x: q.x, y: p.y }, q)
    } else {
      const midX = (p.x + q.x) / 2
      route.push({ x: midX, y: p.y }, { x: midX, y: q.y }, q)
    }
  }
  route.push(b)
  return withoutRepeats(route)
}

/** A unit step's left-hand side on screen, as the wire travels (y grows downward): right → down */
const sideOf = (d: Pt): Pt => ({ x: -d.y, y: d.x })
const unit   = (from: Pt, to: Pt): Pt => {
  const len = Math.hypot(to.x - from.x, to.y - from.y) || 1
  return { x: (to.x - from.x) / len, y: (to.y - from.y) / len }
}
/** Which way a route turns at a corner: 1 toward sideOf(in), −1 away, 0 straight on */
const turnOf = (a: Pt, b: Pt): number => Math.sign(Math.round(a.x * b.y - a.y * b.x))

/** A right-angled route moved `by` px sideways (toward sideOf its travel), every run parallel to its own */
export function besideRoute(route: Pt[], by: number): Pt[] {
  return route.map((p, i) => {
    const a = i > 0 ? unit(route[i - 1], p) : null
    const b = i < route.length - 1 ? unit(p, route[i + 1]) : null
    const na = a && sideOf(a)
    const nb = b && sideOf(b)
    // A corner: both runs' sides; straight on (or the ends): one
    const n = na && nb && a && b && turnOf(a, b) !== 0 ? { x: na.x + nb.x, y: na.y + nb.y } : (na ?? nb)!
    return { x: p.x + n.x * by, y: p.y + n.y * by }
  })
}

/**
 * Build an orthogonal SVG path with rounded corners (radius shrinks on short segments). `side`
 * draws it that far beside its route (besideRoute), its corners round about the same points as
 * the route's — two sides of one route stay the same distance apart all along (a stereo digital
 * wire: two lines).
 */
export function buildWirePath(points: Pt[], ends: RouteEnds = {}, radius = 8, side = 0): string {
  const route = sideRoute(points, ends, side)
  if (!route) return ''
  let d = `M ${route[0].x} ${route[0].y}`
  for (let i = 1; i < route.length; i++) {
    const c = cornerAt(route, i, radius, side)
    d += c ? ` L ${c.before.x} ${c.before.y}${c.arc}` : ` L ${route[i].x} ${route[i].y}`
  }
  return d
}

/** One straight run of a wire, drawn on its own (`d`: from where the last corner ended, round its own end corner) */
export interface WireRun {
  d: string
  /** Where the run starts on its route (the corner point, before rounding) */
  from: Pt
  /** Which way it goes (a unit step) */
  dir: Pt
  /** How far along the route `from` is (px; corners counted square) */
  at: number
}

/**
 * A wire as its straight runs, each its own path — an analog wire's shades are a gradient along
 * each run, phased by `at` so they carry on round the corners (components/ChainEdge.tsx). Rounded
 * and moved sideways as buildWirePath draws it.
 */
export function wireRuns(points: Pt[], ends: RouteEnds = {}, radius = 8, side = 0): WireRun[] {
  const route = sideRoute(points, ends, side)
  if (!route) return []
  const runs: WireRun[] = []
  let start = route[0]
  let at = 0
  for (let i = 1; i < route.length; i++) {
    const prev = route[i - 1]
    const c = cornerAt(route, i, radius, side)
    const d = `M ${start.x} ${start.y}` + (c ? ` L ${c.before.x} ${c.before.y}${c.arc}` : ` L ${route[i].x} ${route[i].y}`)
    runs.push({ d, from: prev, dir: unit(prev, route[i]), at })
    start = c?.after ?? route[i]
    at += Math.hypot(route[i].x - prev.x, route[i].y - prev.y)
  }
  return runs
}

/** The route a wire is drawn along, `side` px beside its own; null when there is none */
function sideRoute(points: Pt[], ends: RouteEnds, side: number): Pt[] | null {
  if (points.length < 2) return null
  const centre = orthogonalRoute(points, ends)
  return side ? besideRoute(centre, side) : centre
}

/**
 * The rounded corner at route[i] (none at the last point, or where the radius comes to 0): where
 * the curve starts and ends, and the curve as path text.
 */
function cornerAt(route: Pt[], i: number, radius: number, side: number): { before: Pt; after: Pt; arc: string } | null {
  const prev = route[i - 1], cur = route[i], next = route[i + 1]
  if (!next) return null
  const inLen  = Math.hypot(cur.x - prev.x, cur.y - prev.y)
  const outLen = Math.hypot(next.x - cur.x, next.y - cur.y)
  // The centre's corner radius, less on the inside of the turn and more on the outside
  const around = radius && Math.max(0, radius - side * turnOf(unit(prev, cur), unit(cur, next)))
  const r = Math.min(around, inLen / 2, outLen / 2)
  if (r <= 0) return null
  const before = { x: cur.x - Math.sign(cur.x - prev.x) * r, y: cur.y - Math.sign(cur.y - prev.y) * r }
  const after  = { x: cur.x + Math.sign(next.x - cur.x) * r, y: cur.y + Math.sign(next.y - cur.y) * r }
  return { before, after, arc: ` Q ${cur.x} ${cur.y} ${after.x} ${after.y}` }
}
