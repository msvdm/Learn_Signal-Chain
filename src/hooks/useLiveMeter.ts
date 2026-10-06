import { useEffect } from 'react'
import type { RefObject } from 'react'
import { useSignalStore } from '../store/signalStore'
import { READINGS_LEVEL, atLeast } from '../data/levels'
import { unwiredSource } from '../graph/queries'
import { graphSignal } from '../signal/engine'
import type { LiveStage } from '../signal/moving'
import { liveStageOf } from '../signal/moving'
import { SLICE_S } from '../audio/meters'
import { LOOP_S } from '../audio/sounds'
import { useLatestRef } from './useLatestRef'

// The meters move (decision D10): the last render recorded how every card's signal moves over one loop
// (signal/moving.ts), and this plays it back in time with the clock, round and round — the loop is
// everything the chain plays. One animation loop outside React writes the moving values straight
// into the meters, the turning-down bars and the marks on the curves (each registers a painter:
// useLiveMeter); no card redraws for movement. It plays from Intermediate up, once a source is
// wired — also when the system asks for reduced motion: moving meters are what the app shows (the
// user's call; with them still, a computer with animations off saw nothing move); a hidden tab gets
// no frames.
//
// Cheap on purpose: 30 pictures a second (a DAW's meters update about as often), only the meters on
// screen (an IntersectionObserver) and only what changed (components/meterPaint.ts).

/** Pictures a second while it plays */
const FPS = 30

interface Entry {
  nodeId: string
  /** What it paints: painted only while some of it is on screen */
  el: RefObject<Element | null>
  observed: Element | null
  onScreen: boolean
  paint: (live: LiveStage | undefined, i: number | null) => void
}

const entries = new Set<Entry>()
const byElement = new Map<Element, Entry>()
/** Each card's movement, ready to play (rebuilt when the chain or the render changes) */
let stages = new Map<string, LiveStage>()
let frame = 0
let lastPaint = -Infinity
let playing = false
/** Where the loop started: every meter plays the same moment of it */
const origin = performance.now()

const visibility = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver((changes) => {
      for (const c of changes) {
        const e = byElement.get(c.target)
        if (e) e.onScreen = c.isIntersecting
      }
    })
  : null

/** Keep an entry's element observed (React may hand its ref a new element). */
function observe(e: Entry) {
  const el = e.el.current
  if (el === e.observed) return
  if (e.observed) {
    visibility?.unobserve(e.observed)
    byElement.delete(e.observed)
  }
  e.observed = el
  // Until the observer has looked, take it as on screen
  e.onScreen = true
  if (el) {
    byElement.set(el, e)
    visibility?.observe(el)
  }
}

function sliceAt(now: number): number {
  const loops = (now - origin) / 1000 / LOOP_S
  return Math.floor((loops - Math.floor(loops)) * LOOP_S / SLICE_S)
}

function tick(now: number) {
  frame = requestAnimationFrame(tick)
  if (now - lastPaint < 1000 / FPS - 4) return
  lastPaint = now
  const i = sliceAt(now)
  for (const e of entries) {
    observe(e)
    if (e.onScreen) e.paint(stages.get(e.nodeId), i)
  }
}

/** Every card that moves: the render's movement, moved by the number engine's step since it. */
function rebuild() {
  const { nodes, edges, measured } = useSignalStore.getState()
  stages = new Map()
  if (!measured?.moving) return
  const shown = graphSignal(nodes, edges, measured)
  for (const node of nodes) {
    // A source plays once it is wired to something (D11: no connection, no signal)
    if (unwiredSource(node.id, { nodes, edges })) continue
    const stage = shown.stages[node.id]
    const m = measured.stages.get(node.id)
    const moving = measured.moving.get(node.id)
    if (stage && m && moving) stages.set(node.id, liveStageOf(stage, m, moving))
  }
}

/** Start or stop playing, as the level and the render say. */
function update() {
  const { complexityLevel } = useSignalStore.getState()
  const should = atLeast(complexityLevel, READINGS_LEVEL) && stages.size > 0
  if (should === playing) return
  playing = should
  document.documentElement.classList.toggle('lsc-meters-live', playing)
  if (playing) {
    frame = requestAnimationFrame(tick)
  } else {
    cancelAnimationFrame(frame)
    for (const e of entries) e.paint(undefined, null)
  }
}

useSignalStore.subscribe((s, prev) => {
  if (s.nodes === prev.nodes && s.edges === prev.edges && s.measured === prev.measured && s.complexityLevel === prev.complexityLevel) return
  rebuild()
  update()
})
rebuild()
update()

/**
 * Paint a meter while the chain plays: `paint(live, i)` gets its card's movement and the slice of
 * the loop to show (`i` null, or `live` undefined: show the still picture). Called outside React,
 * on every picture while `el` is on screen: write to the DOM only (refs), never set state. No
 * `nodeId` (hidden, or never moving): it stays still.
 */
export function useLiveMeter(nodeId: string | undefined, el: RefObject<Element | null>, paint: (live: LiveStage | undefined, i: number | null) => void) {
  const latest = useLatestRef(paint)
  useEffect(() => {
    if (nodeId === undefined) return
    const entry: Entry = { nodeId, el, observed: null, onScreen: true, paint: (live, i) => latest.current(live, i) }
    entries.add(entry)
    return () => {
      entries.delete(entry)
      if (entry.observed) {
        visibility?.unobserve(entry.observed)
        byElement.delete(entry.observed)
      }
      // Hidden or gone: back to the still picture (an element that stays, hidden, keeps it)
      entry.paint(undefined, null)
    }
  }, [nodeId, el, latest])
}
