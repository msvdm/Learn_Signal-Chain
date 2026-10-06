import type { SignalEdge, SignalNode } from '../data/nodeRegistry'
import type { CardPlan } from '../signal/chain'
import { stillPicture } from '../signal/engine'
import { measureChain } from '../audio/measure'
import { useSignalStore } from './signalStore'

// The chain on real sound (decision D9): once a change to what it sounds like has settled, it is
// played and measured (audio/measure.ts) — one render at a time: a change while one runs waits for
// it, and only the newest of those is rendered next. While a knob is being turned nothing renders;
// the cards show the number engine's picture moved on from the last render (signal/measured.ts).
// A card dragged across the canvas renders nothing.

/** A render starts once the chain has not changed for this long (ms). */
const QUIET_MS = 100

/** What a chain sounds like: everything about its cards but where they sit on the canvas. */
function soundOf(plans: CardPlan[]): string {
  return JSON.stringify(plans.map((p) => [
    p.node.id, p.node.typeKey, p.node.params, p.node.bypassed, p.mode, p.followKind, p.fed, p.preamp,
    p.plays, p.amped, p.groundLoop, p.used, p.outputs,
  ]))
}

let rendering = false
let wanted: { nodes: SignalNode[]; edges: SignalEdge[] } | null = null
let lastChange = 0
let timer: ReturnType<typeof setTimeout> | undefined
/** What the last render measured (or the one running is measuring) */
let measuredSound = ''
/** Counts new canvases: a render of the one before is not wanted any more */
let canvas = 0
let warned = false

function measureSoon(nodes: SignalNode[], edges: SignalEdge[]) {
  wanted = { nodes, edges }
  lastChange = performance.now()
  clearTimeout(timer)
  timer = setTimeout(() => { if (!rendering) void renderWanted() }, QUIET_MS)
}

async function renderWanted() {
  rendering = true
  try {
    // A change during a render waits for its own quiet moment (its timer starts the next)
    while (wanted && performance.now() - lastChange >= QUIET_MS - 1) {
      const { nodes, edges } = wanted
      wanted = null
      const still = stillPicture(nodes, edges)
      const sound = soundOf(still.plans)
      if (sound === measuredSound) continue
      const before = measuredSound
      const startedOn = canvas
      measuredSound = sound
      try {
        const measured = await measureChain(still.plans, still.levels)
        if (startedOn === canvas) useSignalStore.getState().setMeasured({ at: still.result, ...measured })
      } catch (error) {
        // No Web Audio here, or a loop did not load: the number engine's picture stays
        measuredSound = before
        if (!warned) console.warn('Measuring the chain on real sound failed; showing the number engine’s readings.', error)
        warned = true
      }
    }
  } finally {
    rendering = false
  }
}

useSignalStore.subscribe((s, prev) => {
  // A new canvas (New, a level change, an opened chain) drops the readings: start afresh
  if (s.measured === null && prev.measured !== null) {
    canvas++
    measuredSound = ''
  }
  if (s.nodes !== prev.nodes || s.edges !== prev.edges) measureSoon(s.nodes, s.edges)
})

const { nodes, edges } = useSignalStore.getState()
measureSoon(nodes, edges)
