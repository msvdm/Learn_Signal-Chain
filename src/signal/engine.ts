import type { SignalNode, SignalEdge } from '../data/nodeRegistry'
import { NODE_REGISTRY, DI_DIRECT_PORT, isNodeStereo, matrixSendParam, param } from '../data/nodeRegistry'
import { graphOf, drivingWire, fedBy, flowOrder } from '../graph/graph'
import type { WireKind } from '../graph/queries'
import { getPorts, groundLoop, matrixSendKey, mixBusOf, needsDi, outputKind, preampSourceOf } from '../graph/queries'
import type { SideLevels, SignalDomain, SignalHealth } from './levels'
import { CLIP_DBU, HUM_DBU, SILENT, TAPER_UNITY, eachReading, getHealth, louder, shifted, sumNoiseToDb, sumSides, taperToDb } from './levels'
import type { SideResult, StageCondition } from './process'
import { SPEAKER_LEVEL_DB, balanceSides, flattenPeaks, panSides, processSide } from './process'
import { sameShape } from '../utils/sameShape'

// The signal engine: walks the graph in signal order and works out the levels at every card and on
// every wire — per side, the peaks, the average and the noise (SideLevels). What each wire carries
// (mono, stereo, one side) comes from the graph (graph/queries.ts outputKind); this only works out
// how loud it is. Pure — no React, no store.

/**
 * A signal on a wire, or arriving at / leaving a card: what it carries and each side's levels.
 * mono: l = r · left: r silent · right: l silent · stereo: both sides.
 */
export interface WireSignal {
  kind: WireKind
  l: SideLevels
  r: SideLevels
}

export const SILENT_WIRE: WireSignal = { kind: 'mono', l: SILENT, r: SILENT }

/** How loud a signal is: its louder side's average (−∞ when there is none). */
export function levelOf(w: WireSignal | undefined): number {
  return w ? Math.max(w.l.rms, w.r.rms) : -Infinity
}

/** How loud its loudest moments are: its louder side's peaks. */
export function peakOf(w: WireSignal | undefined): number {
  return w ? Math.max(w.l.peak, w.r.peak) : -Infinity
}

/** Its hum (louder side; −∞: none). */
export function humOf(w: WireSignal | undefined): number {
  return w ? Math.max(w.l.hum, w.r.hum) : -Infinity
}

/** The health of a signal, judged in `domain`: clipping from its peaks, the rest from its average. */
export function healthOf(w: WireSignal | undefined, domain: SignalDomain = 'analog'): SignalHealth {
  return getHealth(levelOf(w), domain, peakOf(w))
}

const mono   = (s: SideLevels): WireSignal => ({ kind: 'mono', l: s, r: s })
const stereo = (l: SideLevels, r: SideLevels): WireSignal => ({ kind: 'stereo', l, r })

/** The wire as one channel: a stereo wire's two sides are added (about +6 dB when they match). */
function foldToMono(w: WireSignal): SideLevels {
  return w.kind === 'mono' ? w.l : sumSides([w.l, w.r])
}

/** What an output that carries `kind` sends of the card's signal. */
function onPort(kind: WireKind, out: WireSignal): WireSignal {
  switch (kind) {
    case 'left':   return { kind, l: out.l, r: SILENT }
    case 'right':  return { kind, l: SILENT, r: out.r }
    case 'stereo': return { kind, l: out.l, r: out.r }
    default:       return mono(louder(out.l, out.r))
  }
}

/** A ground-loop hum joins the noise (and is kept apart for its glow). */
const humming = (s: SideLevels): SideLevels =>
  ({ ...s, noise: sumNoiseToDb([s.noise, HUM_DBU]), hum: sumNoiseToDb([s.hum, HUM_DBU]) })

/** A card working as something more than its type: it changes its name and its help text. */
export type StageRole =
  | 'preamp'     // a Gain after a microphone or a DI Box's XLR Out: lifts it up to line level
  | 'main-fader' // a Fader on a bus's Mix output: controls the whole mix
  | 'balance'    // a Pan fed a stereo wire

/** What one card does to the signal. */
export interface StageResult {
  /** What the card works on: both sides when it takes a stereo signal, else one channel (l = r). */
  in: WireSignal
  /** What it sends out: both sides when it works in stereo, else one channel (l = r). */
  out: WireSignal
  /** Health of what leaves, judged in `domain`: clipping when its peaks reach the ceiling, else from its average */
  health: SignalHealth
  /** Analog (dBu) or digital (dBFS), leaving — an ADC / DAC changes it */
  domain: SignalDomain
  /** Analog or digital, arriving */
  inDomain: SignalDomain
  /** How far a dynamics card turns the signal (its average) down right now */
  gainReductionDb?: number
  condition?: StageCondition
  role?: StageRole
  /**
   * The level of the hum leaving it (dBu, dBFS after an ADC): a ground loop through a DI Box (its
   * Direct Out on a Guitar Amp, its XLR Out on the desk, Ground Lift off) starts one at HUM_DBU on
   * the XLR Out. It is part of the noise and follows the signal to the end of the chain — a fader
   * turns it down with the music; only Ground Lift takes it away. Undefined: no hum.
   */
  hum?: number
}

export interface GraphSignalResult {
  /** Keyed by node id. Cards in a loop (and after one) have none. */
  stages: Record<string, StageResult>
  /** What each output sends, keyed `${nodeId}:${portId}`. */
  wires: Map<string, WireSignal>
  /** The hum on each output that carries one (its level), keyed like `wires`. */
  hums: Map<string, number>
}

// Every node card, port and edge reads the graph result. The store replaces the
// nodes/edges arrays on every change, so one shared single-entry cache keyed on
// those references lets all callers reuse a single computation per change.
let lastGraph: { nodes: SignalNode[]; edges: SignalEdge[]; result: GraphSignalResult } | null = null

/**
 * The signal at every card and on every wire (computed once per change of the graph). A card's
 * stage and a wire's signal that came out the same as last time are last time's objects, so a
 * card that reads only its own (useStage) is redrawn only when its own result changed.
 */
export function graphSignal(nodes: SignalNode[], edges: SignalEdge[]): GraphSignalResult {
  if (lastGraph && lastGraph.nodes === nodes && lastGraph.edges === edges) return lastGraph.result
  const fresh  = computeGraphSignal(nodes, edges)
  const result = lastGraph ? keepUnchanged(fresh, lastGraph.result) : fresh
  lastGraph = { nodes, edges, result }
  return result
}

/** `fresh`, with every stage, wire and hum that equals the one in `before` replaced by that one. */
function keepUnchanged(fresh: GraphSignalResult, before: GraphSignalResult): GraphSignalResult {
  let allSame = Object.keys(fresh.stages).length === Object.keys(before.stages).length
  const stages: Record<string, StageResult> = {}
  for (const [id, stage] of Object.entries(fresh.stages)) {
    const old = before.stages[id]
    const same = old !== undefined && sameShape(old, stage)
    stages[id] = same ? old : stage
    allSame &&= same
  }

  const wires = new Map<string, WireSignal>()
  let wiresSame = fresh.wires.size === before.wires.size
  for (const [key, wire] of fresh.wires) {
    const old = before.wires.get(key)
    const same = old !== undefined && sameShape(old, wire)
    wires.set(key, same ? old : wire)
    wiresSame &&= same
  }

  const humsSame = sameShape(Object.fromEntries(fresh.hums), Object.fromEntries(before.hums))
  return {
    stages: allSame ? before.stages : stages,
    wires:  wiresSame ? before.wires : wires,
    hums:   humsSame ? before.hums : fresh.hums,
  }
}

function computeGraphSignal(nodes: SignalNode[], edges: SignalEdge[]): GraphSignalResult {
  const graph  = graphOf({ nodes, edges })
  const wires  = new Map<string, WireSignal>()
  const stages: Record<string, StageResult> = {}
  const wireOf = (e: SignalEdge) => wires.get(`${e.source}:${e.sourceHandle}`) ?? SILENT_WIRE
  const hums   = new Map<string, number>()

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

    // The first Gain after a microphone (or a DI Box's XLR Out) works as its Preamp
    const preamp = node.typeKey === 'gain' && preampSourceOf(node.id, graph) !== null
    const fed    = incoming.length > 0
    // Stereo: a bus (or Line In) set to Stereo, or a follow node fed a stereo wire.
    // Mono: everything else — one channel; a stereo wire arriving here is folded into one.
    const isStereo = node.typeKey !== 'pan' && (isNodeStereo(node) || (follows && followKind === 'stereo'))

    /** A Matrix Bus turns each bus up or down by its send knob before adding them up. */
    const sendDb = (e: SignalEdge) => node.typeKey === 'matrix-bus'
      ? taperToDb(param(node, matrixSendParam(matrixSendKey(e, graph))) ?? TAPER_UNITY)
      : 0

    /**
     * The levels arriving, all wires added up. side = 'l' / 'r': that side of every wire (a mono
     * wire counts on both sides, a left wire only on the left). null: every wire folded into one.
     */
    const arriving = (side: 'l' | 'r' | null) => sumSides(used.map((e) => {
      const w = wireOf(e)
      return shifted(side ? w[side] : foldToMono(w), sendDb(e))
    }))

    /** One side (or the only channel) of this node. */
    const runSide = (side: 'l' | 'r' | null): SideResult => {
      const input = arriving(side)
      // Bypassed: passed on as it is, with no hiss of its own (a bus still adds its wires up)
      if (node.bypassed && fed) return { out: flattenPeaks(input, inputDomain), domain: inputDomain }
      return processSide(node, input, { domain: inputDomain, mixedDomains, side, preamp, fed })
    }

    // `side` gives the stage its domain, gain reduction and condition
    let side: Omit<SideResult, 'out'>
    let inSig: WireSignal
    let outSig: WireSignal

    if (node.typeKey === 'speaker' && incoming.length > 0 && !fedBy(node.id, 'amp', graph)) {
      // A passive speaker needs a power amplifier somewhere before it
      side   = { domain: inputDomain, condition: 'needsAmp' }
      inSig  = mono(arriving(null))
      outSig = SILENT_WIRE
    } else if (node.typeKey === 'pan') {
      // Mono wire in → Pan knob spreads it over L / R. Stereo wire in → Balance knob. Each side is
      // turned down as a whole: its peaks, average and noise alike.
      const position = param(node, 'panPosition')
      let gain: { l: number; r: number }
      if (followKind === 'stereo') {
        const l = arriving('l')
        const r = arriving('r')
        inSig  = stereo(l, r)
        gain   = node.bypassed ? { l: 0, r: 0 } : balanceSides(position, 0, 0)
        outSig = stereo(shifted(l, gain.l), shifted(r, gain.r))
      } else {
        const v = arriving(null)
        inSig  = mono(v)
        gain   = node.bypassed && incoming.length > 0 ? { l: 0, r: 0 } : panSides(position, 0)
        outSig = stereo(shifted(v, gain.l), shifted(v, gain.r))
      }
      side = { domain: inputDomain }
    } else if (def.category === 'source') {
      // Line In set to Stereo sends the same level on both sides. A microphone may hear a Guitar Amp.
      const only = runSide(null)
      side   = only
      inSig  = SILENT_WIRE
      outSig = isStereo ? stereo(only.out, only.out) : mono(only.out)
    } else if (isStereo && def.linked && !node.bypassed) {
      // The louder side drives the detector (reading by reading); the same change goes to both sides
      const l = arriving('l')
      const r = arriving('r')
      const detector = louder(l, r)
      const result   = processSide(node, detector, { domain: inputDomain, mixedDomains, side: null, preamp: false, fed })
      const linked   = (s: SideLevels) => eachReading((k) =>
        isFinite(detector[k]) ? s[k] + (result.out[k] - detector[k]) : s[k])
      side   = result
      inSig  = stereo(l, r)
      outSig = stereo(linked(l), linked(r))
    } else if (isStereo) {
      // Run the node once per side
      const left  = runSide('l')
      const right = runSide('r')
      side   = left
      inSig  = stereo(arriving('l'), arriving('r'))
      outSig = stereo(left.out, right.out)
    } else {
      // One channel
      const only = runSide(null)
      side   = only
      inSig  = mono(arriving(null))
      outSig = mono(only.out)
    }

    let condition = side.condition
    // An amplifier's output is speaker level — far too strong for an active speaker's input
    if (node.typeKey === 'active-speaker' && isFinite(levelOf(outSig)) && fedBy(node.id, 'amp', graph)) {
      const loud = shifted(outSig.l, SPEAKER_LEVEL_DB)
      outSig    = mono({ ...loud, rms: Math.max(loud.rms, CLIP_DBU), peak: Math.max(loud.peak, CLIP_DBU) })
      condition = 'blown'
    }
    // A guitar straight into a desk input: the level is fine, the high notes are lost
    if (node.typeKey === 'instrument' && needsDi(node.id, graph)) condition = 'needsDi'

    // A DI Box in a ground loop starts a hum on its XLR Out. It is part of the noise from there on:
    // every card treats it as it treats the noise (a fader turns it down with the music, a gate
    // shuts it off in the pauses); only Ground Lift on the DI takes it away.
    if (node.typeKey === 'di-box' && groundLoop(node.id, graph)) {
      outSig = { ...outSig, l: humming(outSig.l), r: humming(outSig.r) }
    }
    const hum = humOf(outSig)

    const role: StageRole | undefined = preamp ? 'preamp'
      : node.typeKey === 'fader' && mixBusOf(node.id, graph) !== null ? 'main-fader'
      : node.typeKey === 'pan' && followKind === 'stereo' ? 'balance'
      : undefined

    stages[node.id] = {
      in: inSig,
      out: outSig,
      // Judged in the domain the signal leaves in
      health: healthOf(outSig, side.domain),
      domain: side.domain,
      inDomain: inputDomain,
      gainReductionDb: side.gainReductionDb,
      condition,
      role,
      ...(isFinite(hum) ? { hum } : {}),
    }
    for (const port of getPorts(node, graph).outputs) {
      const key = `${node.id}:${port.id}`
      // A DI Box's Direct Out passes on what arrives, at instrument level; the rest is its XLR Out
      const direct = node.typeKey === 'di-box' && port.id === DI_DIRECT_PORT
      const wire   = onPort(outputKind(node.id, port.id, graph), direct ? inSig : outSig)
      wires.set(key, wire)
      if (isFinite(humOf(wire))) hums.set(key, humOf(wire))
    }
  }

  return { stages, wires, hums }
}
