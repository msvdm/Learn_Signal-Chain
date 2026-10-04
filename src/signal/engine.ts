import type { SignalNode, SignalEdge } from '../data/nodeRegistry'
import { NODE_REGISTRY, isNodeStereo, matrixSendParam, param } from '../data/nodeRegistry'
import { graphOf, drivingWire, fedBy, flowOrder } from '../graph/graph'
import type { WireKind } from '../graph/queries'
import { getPorts, matrixSendKey, mixBusOf, outputKind, preampMicOf } from '../graph/queries'
import type { SignalDomain, SignalHealth } from './levels'
import { CLIP_DBU, TAPER_UNITY, getHealth, sumSignalsToDb, taperToDb } from './levels'
import type { SideResult, StageCondition } from './process'
import { SPEAKER_LEVEL_DB, balanceSides, panSides, processSide } from './process'

// The signal engine: walks the graph in signal order and works out the level at every card and on
// every wire. What each wire carries (mono, stereo, one side) comes from the graph
// (graph/queries.ts outputKind); this only works out how loud it is. Pure — no React, no store.

/**
 * A signal on a wire, or arriving at / leaving a card: what it carries and how loud each side is.
 * mono: l = r · left: r = −∞ · right: l = −∞ · stereo: both sides.
 */
export interface WireSignal {
  kind: WireKind
  l: number
  r: number
}

export const SILENT_WIRE: WireSignal = { kind: 'mono', l: -Infinity, r: -Infinity }

/** How loud a signal is: its louder side (−∞ when there is none). */
export function levelOf(w: WireSignal | undefined): number {
  return w ? Math.max(w.l, w.r) : -Infinity
}

const mono   = (db: number): WireSignal => ({ kind: 'mono', l: db, r: db })
const stereo = (l: number, r: number): WireSignal => ({ kind: 'stereo', l, r })

/** The wire as one channel: a stereo wire's two sides are added (about +6 dB when they match). */
function foldToMono(w: WireSignal): number {
  return w.kind === 'mono' ? w.l : sumSignalsToDb([w.l, w.r])
}

/** What an output that carries `kind` sends of the card's signal. */
function onPort(kind: WireKind, out: WireSignal): WireSignal {
  switch (kind) {
    case 'left':   return { kind, l: out.l, r: -Infinity }
    case 'right':  return { kind, l: -Infinity, r: out.r }
    case 'stereo': return { kind, l: out.l, r: out.r }
    default:       return mono(levelOf(out))
  }
}

/** A card working as something more than its type: it changes its name and its help text. */
export type StageRole =
  | 'preamp'     // a Gain after a microphone: lifts it up to line level
  | 'main-fader' // a Fader on a bus's Mix output: controls the whole mix
  | 'balance'    // a Pan fed a stereo wire

/** What one card does to the signal. */
export interface StageResult {
  /** What the card works on: both sides when it takes a stereo signal, else one channel (l = r). */
  in: WireSignal
  /** What it sends out: both sides when it works in stereo, else one channel (l = r). */
  out: WireSignal
  /** Health of what leaves, judged in `domain` */
  health: SignalHealth
  /** Analog (dBu) or digital (dBFS), leaving — an ADC / DAC changes it */
  domain: SignalDomain
  /** Analog or digital, arriving */
  inDomain: SignalDomain
  /** How far a dynamics card turns the signal down right now */
  gainReductionDb?: number
  condition?: StageCondition
  role?: StageRole
}

export interface GraphSignalResult {
  /** Keyed by node id. Cards in a loop (and after one) have none. */
  stages: Record<string, StageResult>
  /** What each output sends, keyed `${nodeId}:${portId}`. */
  wires: Map<string, WireSignal>
}

// Every node card, port and edge reads the graph result. The store replaces the
// nodes/edges arrays on every change, so one shared single-entry cache keyed on
// those references lets all callers reuse a single computation per change.
let lastGraph: { nodes: SignalNode[]; edges: SignalEdge[]; result: GraphSignalResult } | null = null

/** The signal at every card and on every wire (computed once per change of the graph). */
export function graphSignal(nodes: SignalNode[], edges: SignalEdge[]): GraphSignalResult {
  if (lastGraph && lastGraph.nodes === nodes && lastGraph.edges === edges) return lastGraph.result
  const result = computeGraphSignal(nodes, edges)
  lastGraph = { nodes, edges, result }
  return result
}

function computeGraphSignal(nodes: SignalNode[], edges: SignalEdge[]): GraphSignalResult {
  const graph  = graphOf({ nodes, edges })
  const wires  = new Map<string, WireSignal>()
  const stages: Record<string, StageResult> = {}
  const wireOf = (e: SignalEdge) => wires.get(`${e.source}:${e.sourceHandle}`) ?? SILENT_WIRE

  for (const node of flowOrder(graph)) {
    const incoming = graph.into(node.id)
    const def      = NODE_REGISTRY[node.typeKey]
    const relay    = node.typeKey === 'relay'
    const follows  = def.stereo === 'follow'
    // A "follow" node passes on what its wire carries — the Relay follows its selected input
    const driving    = drivingWire(node, graph)
    const followKind = driving ? wireOf(driving).kind : 'mono'
    // The wires it works on: everything plugged in (every wire on a bus's input), but only the
    // Relay's selected input
    const used = relay ? incoming.filter((e) => e.targetHandle === `in-${param(node, 'selectedInput')}`) : incoming

    // Analog or digital: what arrives decides (the Relay: its selected input). A bus can't mix them.
    const domains      = incoming.map((e) => stages[e.source]?.domain ?? 'analog')
    const inputDomain  = relay ? (driving ? (stages[driving.source]?.domain ?? 'analog') : 'analog') : (domains[0] ?? 'analog')
    const mixedDomains = !relay && new Set(domains).size > 1

    // The first Gain after a microphone works as its Preamp
    const preamp = node.typeKey === 'gain' && preampMicOf(node.id, graph) !== null
    // Stereo: a bus (or Line In) set to Stereo, or a follow node fed a stereo wire.
    // Mono: everything else — one channel; a stereo wire arriving here is folded into one.
    const isStereo = node.typeKey !== 'pan' && (isNodeStereo(node) || (follows && followKind === 'stereo'))

    /** A Matrix Bus turns each bus up or down by its send knob before adding them up. */
    const sendDb = (e: SignalEdge) => node.typeKey === 'matrix-bus'
      ? taperToDb(param(node, matrixSendParam(matrixSendKey(e, graph))) ?? TAPER_UNITY)
      : 0

    /**
     * The level arriving, all wires added up. side = 'l' / 'r': that side of every wire (a mono
     * wire counts on both sides, a left wire only on the left). null: every wire folded into one.
     */
    const arriving = (side: 'l' | 'r' | null) => sumSignalsToDb(used.map((e) => {
      const w    = wireOf(e)
      const send = sendDb(e)
      return isFinite(send) ? (side ? w[side] : foldToMono(w)) + send : -Infinity
    }))

    /** One side (or the only channel) of this node. */
    const runSide = (side: 'l' | 'r' | null): SideResult => {
      const input = arriving(side)
      if (node.bypassed && incoming.length > 0) return { out: input, domain: inputDomain }
      return processSide(node, input, { domain: inputDomain, mixedDomains, side, preamp })
    }

    // `side` gives the stage its domain, gain reduction and condition
    let side: SideResult
    let inSig: WireSignal
    let outSig: WireSignal

    if (node.typeKey === 'speaker' && incoming.length > 0 && !fedBy(node.id, 'amp', graph)) {
      // A passive speaker needs a power amplifier somewhere before it
      side   = { out: -Infinity, domain: inputDomain, condition: 'needsAmp' }
      inSig  = mono(arriving(null))
      outSig = SILENT_WIRE
    } else if (node.typeKey === 'pan') {
      // Mono wire in → Pan knob spreads it over L / R. Stereo wire in → Balance knob.
      const position = param(node, 'panPosition')
      let spread: { l: number; r: number }
      if (followKind === 'stereo') {
        const l = arriving('l')
        const r = arriving('r')
        inSig  = stereo(l, r)
        spread = node.bypassed ? { l, r } : balanceSides(position, l, r)
      } else {
        const v = arriving(null)
        inSig  = mono(v)
        spread = node.bypassed && incoming.length > 0 ? { l: v, r: v } : panSides(position, v)
      }
      outSig = stereo(spread.l, spread.r)
      side   = { out: levelOf(outSig), domain: inputDomain }
    } else if (def.category === 'source') {
      // Line In set to Stereo sends the same level on both sides
      side   = runSide(null)
      inSig  = SILENT_WIRE
      outSig = isStereo ? stereo(side.out, side.out) : mono(side.out)
    } else if (isStereo && def.linked && !node.bypassed) {
      // The louder side drives the detector; the same gain change goes to both sides
      const l = arriving('l')
      const r = arriving('r')
      const detector = Math.max(l, r)
      side = processSide(node, detector, { domain: inputDomain, mixedDomains, side: null, preamp: false })
      const gain = isFinite(detector) ? side.out - detector : -Infinity
      inSig  = stereo(l, r)
      outSig = stereo(isFinite(l) ? l + gain : -Infinity, isFinite(r) ? r + gain : -Infinity)
    } else if (isStereo) {
      // Run the node once per side
      const left  = runSide('l')
      const right = runSide('r')
      side   = left
      inSig  = stereo(arriving('l'), arriving('r'))
      outSig = stereo(left.out, right.out)
    } else {
      // One channel
      side   = runSide(null)
      inSig  = mono(arriving(null))
      outSig = mono(side.out)
    }

    let condition = side.condition
    // An amplifier's output is speaker level — far too strong for an active speaker's input
    if (node.typeKey === 'active-speaker' && isFinite(levelOf(outSig)) && fedBy(node.id, 'amp', graph)) {
      outSig    = mono(Math.max(levelOf(outSig) + SPEAKER_LEVEL_DB, CLIP_DBU))
      condition = 'blown'
    }

    const role: StageRole | undefined = preamp ? 'preamp'
      : node.typeKey === 'fader' && mixBusOf(node.id, graph) !== null ? 'main-fader'
      : node.typeKey === 'pan' && followKind === 'stereo' ? 'balance'
      : undefined

    stages[node.id] = {
      in: inSig,
      out: outSig,
      // Judged in the domain the signal leaves in
      health: getHealth(levelOf(outSig), side.domain),
      domain: side.domain,
      inDomain: inputDomain,
      gainReductionDb: side.gainReductionDb,
      condition,
      role,
    }
    for (const port of getPorts(node, graph).outputs) {
      wires.set(`${node.id}:${port.id}`, onPort(outputKind(node.id, port.id, graph), outSig))
    }
  }

  return { stages, wires }
}
