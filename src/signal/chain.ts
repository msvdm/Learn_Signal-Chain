import type { Route, SignalNode, SignalEdge, TypeKey } from '../data/nodeRegistry'
import { NODE_REGISTRY, DI_DIRECT_PORT, isDynamics, isNodeStereo, matrixSendParam, param } from '../data/nodeRegistry'
import type { CardPath } from '../graph/graph'
import { graphOf, drivingWire, fedBy, flowPaths, outputKey, pathSends, wiresInto } from '../graph/graph'
import type { WireKind } from '../graph/queries'
import { getPorts, groundLoop, matrixSendKey, mixBusOf, needsDi, outputKind, phantomPowered, preampSourceOf } from '../graph/queries'
import type { SideLevels, SignalDomain, SignalHealth } from './levels'
import { CLIP_DBU, HUM_DBU, SILENT, TAPER_UNITY, eachReading, getHealth, louder, shifted, sumNoiseToDb, sumSides, taperToDb } from './levels'
import type { SideContext, SideResult, StageCondition } from './process'
import { SPEAKER_LEVEL_DB, balanceSides, flattenPeaks, panSides, processJob, processSide, withOutputNoise } from './process'
import type { Side, SideOps, Sided } from './sided'
import { onPort } from './sided'

// The walk through a chain: what the wiring makes of each card (planChain, once per change of the
// graph) and the levels the number engine gives every card and every wire (runChain) — per side,
// the peaks, the average and the noise (SideLevels). What each wire carries (mono, stereo, one
// side) comes from the graph (graph/queries.ts outputKind); this only works out how loud it is.
// The render on real sound (audio/chainAudio.ts) builds its graph from the same plan. Pure — no
// React, no store.
/**
 * A signal on a wire, or arriving at / leaving a card: what it carries and each side's levels.
 * mono: l = r · left: r silent · right: l silent · stereo: both sides.
 */
export type WireSignal = Sided<SideLevels>

export const SILENT_WIRE: WireSignal = { kind: 'mono', l: SILENT, r: SILENT }

/** A side's readings for `onPort` (signal/sided.ts): silence, and the louder of two reading by reading. */
export const LEVEL_SIDES: SideOps<SideLevels> = { silent: SILENT, louder }

/** How loud a signal is: its louder side's average (−∞ when there is none). */
export function levelOf(w: WireSignal | undefined): number {
  return w ? Math.max(w.l.rms, w.r.rms) : -Infinity
}

/** How loud its loudest moments are: its louder side's peaks. */
export function peakOf(w: WireSignal | undefined): number {
  return w ? Math.max(w.l.peak, w.r.peak) : -Infinity
}

/** Its louder side, reading by reading (one channel: itself) — a linked dynamics card's curve works on it. */
export function louderSide(w: WireSignal): SideLevels {
  return louder(w.l, w.r)
}

/** Its hum (louder side; −∞: none). */
export function humOf(w: WireSignal | undefined): number {
  return w ? Math.max(w.l.hum, w.r.hum) : -Infinity
}

/**
 * The domain output `port` of a card leaves in (`stage`: its StageResult): the card's, or on a card
 * of several paths its path's (`outDomains`).
 */
export function outDomainOf(stage: { domain: SignalDomain; outDomains?: Record<string, SignalDomain> } | undefined, port: string): SignalDomain {
  return stage?.outDomains?.[port] ?? stage?.domain ?? 'analog'
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

/** A ground-loop hum joins the noise (and is kept apart for its glow). */
const humming = (s: SideLevels): SideLevels =>
  ({ ...s, noise: sumNoiseToDb([s.noise, HUM_DBU]), hum: sumNoiseToDb([s.hum, HUM_DBU]) })

/** A card working as something more than its type: it changes its name and its help text. */
export type StageRole =
  | 'preamp'     // a Gain after a microphone or a DI Box's XLR Out: lifts it up to line level
  | 'main-fader' // a Fader on a bus's Mix output: controls the whole mix
  | 'balance'    // a Pan fed a stereo wire
  | 'pfl'        // an On Off Switch wired into a PFL Bus: that channel's PFL button
// ── What the wiring makes of each card ────────────────────────────────────────

/** How a card handles its signal — from the wiring, not the levels. */
type CardMode =
  | 'needs-amp' // a passive speaker with no amplifier before it: silent
  | 'needs-gain' // headphones with no Gain right before them: silent
  | 'pan'       // Pan (a mono wire in) or Balance (a stereo wire in): sets L against R
  | 'source'    // makes a signal (or a sound in the air, for a microphone)
  | 'linked'    // stereo dynamics: the louder side drives one change for both sides
  | 'stereo'    // runs once per side
  | 'mono'      // one channel: a stereo wire arriving is folded into it

/**
 * What the wiring makes of one card: everything about it that does not depend on the levels,
 * worked out once per change of the graph — the number engine (runChain) and the render on real
 * sound (audio/chainAudio.ts) both work from it.
 */
export interface CardPlan {
  node: SignalNode
  /**
   * What its levels are keyed by (ChainLevels `cards`, the render's taps): the card's id — on a card
   * of several paths (NodeTypeDef `routes`) its first path's; the others' their own (pathKey)
   */
  key: string
  /** One of a card's paths (NodeTypeDef `routes`): which; none for a card that is one path */
  route?: Route
  /** The card as its maths sees it: itself, or on a route the type whose job it does there (an Audio Interface's ADC) */
  job: SignalNode
  mode: CardMode
  /**
   * The wires it adds up: the output each comes from (its `key` — what `wires` are keyed by — and
   * the plan sending it, `from`: its key), with a Matrix Bus's send knob on it (dB)
   */
  used: { key: string; from: string; sendDb: number }[]
  /**
   * The wires whose domain decides its own (their keys): every wire plugged in (a bus cannot mix
   * analog and digital), a Relay only the one on its selected input
   */
  domainFrom: string[]
  /** What the wire it follows carries (a follow card, Pan); 'mono' when none */
  followKind: WireKind
  fed: boolean
  preamp: boolean
  /** A source, playing its sound */
  plays: boolean
  /** An active speaker after an amplifier: fed speaker level, it blows */
  amped: boolean
  /** An instrument reaching a desk input without a DI's XLR Out */
  needsDi: boolean
  /** A condenser microphone hearing a sound, with no 48V switched on before its Preamp: no power, no signal */
  unpowered: boolean
  /** A DI Box in a ground loop: a hum starts on its XLR Out */
  groundLoop: boolean
  role?: StageRole
  /** Its outputs: their key (outputKey), what each carries, and a DI Box's Direct Out */
  outputs: { key: string; kind: WireKind; direct: boolean }[]
}

const keyOf = (e: SignalEdge) => outputKey(e.source, e.sourceHandle)

/**
 * Speakers with an amplifier of their own: an Amplifier before one blows it. The app draws an
 * Amplifier only into a passive speaker; this wire comes from one taking a bus's L / R over (the
 * other side's wire moves onto it), or from an older file.
 */
const POWERED_SPEAKERS: ReadonlySet<TypeKey> = new Set<TypeKey>(['active-speaker', 'studio-monitor', 'headphones'])

/** The key of a card's path other than its first (CardPlan `key`). */
export function pathKey(nodeId: string, route: Route): string {
  return `${nodeId}>${route.to[0] ?? route.from}`
}

/** A path's key: its card's id for the card's first (or only) path. */
function keyOfPath({ node, route }: CardPath): string {
  return route && route !== NODE_REGISTRY[node.typeKey].routes?.[0] ? pathKey(node.id, route) : node.id
}

/**
 * Every card the signal reaches, in signal order (cards in a loop, and after one, are left out) —
 * a card of several paths once per path (NodeTypeDef `routes`), each where its signal comes.
 */
export function planChain(nodes: SignalNode[], edges: SignalEdge[]): CardPlan[] {
  const graph = graphOf({ nodes, edges })
  const kinds = new Map<string, WireKind>()
  /** The plan sending each output (its key) */
  const sentBy = new Map<string, string>()
  const plans: CardPlan[] = []

  for (const path of flowPaths(graph)) {
    const { node, route } = path
    const key      = keyOfPath(path)
    const incoming = wiresInto(path, graph)
    const def      = NODE_REGISTRY[node.typeKey]
    const relay    = node.typeKey === 'relay'
    // A "follow" node passes on what its wire carries — the Relay follows its selected input
    const driving    = relay ? drivingWire(node, graph) : incoming[0]
    const followKind = (driving && kinds.get(keyOf(driving))) || 'mono'
    // The wires it works on: everything plugged in (every wire on a bus's input), but only the
    // Relay's selected input
    const used = relay ? incoming.filter((e) => e.targetHandle === `in-${param(node, 'selectedInput')}`) : incoming

    // The first Gain after a microphone (or a DI Box's XLR Out) works as its Preamp
    const preamp = node.typeKey === 'gain' && preampSourceOf(node.id, graph) !== null
    const fed    = incoming.length > 0
    // Stereo: a stereo source or bus (always, or set to Stereo), or a follow node fed a stereo wire.
    // Mono: everything else — one channel; a stereo wire arriving here is folded into one.
    const isStereo = node.typeKey !== 'pan' && (isNodeStereo(node) || (def.stereo === 'follow' && followKind === 'stereo'))

    /** A Matrix Bus turns each bus up or down by its send knob before adding them up. */
    const sendDb = (e: SignalEdge) => node.typeKey === 'matrix-bus'
      ? taperToDb(param(node, matrixSendParam(matrixSendKey(e, graph))) ?? TAPER_UNITY)
      : 0

    // A route making its own sound is a source (a DAW playing back); one that takes its signal in is not (the DAW recording)
    const source = route ? route.from === null : def.category === 'source'
    const job    = route ? { ...node, typeKey: route.as } : node
    const amped  = POWERED_SPEAKERS.has(node.typeKey) && fedBy(node.id, 'amp', graph)
    const mode: CardMode =
      // A passive speaker needs a power amplifier somewhere before it
      node.typeKey === 'speaker' && fed && !fedBy(node.id, 'amp', graph) ? 'needs-amp'
      // Headphones need a Gain right before them: their level knob (after an Amplifier they blow instead)
      : node.typeKey === 'headphones' && fed && !amped && !incoming.some((e) => graph.node(e.source)?.typeKey === 'gain') ? 'needs-gain'
      : node.typeKey === 'pan' ? 'pan'
      : source ? 'source'
      : isStereo && isDynamics(job.typeKey) && !node.bypassed ? 'linked'
      : isStereo ? 'stereo'
      : 'mono'

    const outputs = getPorts(node, graph).outputs.filter((port) => pathSends(path, port.id)).map((port) => ({
      key:    outputKey(node.id, port.id),
      kind:   outputKind(node.id, port.id, graph),
      // A DI Box's Direct Out passes on what arrives, at instrument level; the rest is its XLR Out
      direct: node.typeKey === 'di-box' && port.id === DI_DIRECT_PORT,
    }))
    for (const o of outputs) {
      kinds.set(o.key, o.kind)
      sentBy.set(o.key, key)
    }

    plans.push({
      node, key, route, job, mode, followKind, fed, preamp, outputs,
      used:        used.map((e) => ({ key: keyOf(e), from: sentBy.get(keyOf(e)) ?? e.source, sendDb: sendDb(e) })),
      domainFrom:  relay ? (driving ? [keyOf(driving)] : []) : incoming.map(keyOf),
      plays:       source,
      amped,
      needsDi:     node.typeKey === 'instrument' && needsDi(node.id, graph),
      unpowered:   node.typeKey === 'mic' && fed && param(node, 'micType') === 'condenser' && !phantomPowered(node.id, graph),
      groundLoop:  node.typeKey === 'di-box' && groundLoop(node.id, graph),
      role: preamp ? 'preamp'
        : node.typeKey === 'fader' && mixBusOf(node.id, graph) !== null ? 'main-fader'
        : node.typeKey === 'pan' && followKind === 'stereo' ? 'balance'
        : node.typeKey === 'switch' && graph.from(node.id).some((e) => graph.node(e.target)?.typeKey === 'pfl-bus') ? 'pfl'
        : undefined,
    })
  }
  return plans
}

// ── The levels ─────────────────────────────────────────────────────────────────

/** One card's signal, as the number engine reads it. */
export interface CardLevels {
  in: WireSignal
  out: WireSignal
  domain: SignalDomain
  inDomain: SignalDomain
  /** Analog and digital signals arrive at once (a bus cannot add them) */
  mixedDomains: boolean
  gainReductionDb?: number
  condition?: StageCondition
}

export interface ChainLevels {
  /** Keyed by the plans' keys: a card's id (a card of several paths: its first path's — CardPlan `key`) */
  cards: Map<string, CardLevels>
  /** What each output sends, keyed by outputKey */
  wires: Map<string, WireSignal>
}

/** The context a card's maths gets for one side. */
function contextOf(card: CardPlan, domain: SignalDomain, mixedDomains: boolean, side: Side): SideContext {
  return { domain, mixedDomains, side, preamp: card.preamp, fed: card.fed }
}

/**
 * The levels arriving at a card, all its wires added up. side = 'l' / 'r': that side of every wire
 * (a mono wire counts on both sides, a left wire only on the left). null: every wire folded into one.
 */
function arrivingAt(card: CardPlan, wires: Map<string, WireSignal>, side: Side): SideLevels {
  const { used } = card
  // One plain wire (most cards): what it carries, nothing to add up
  if (used.length === 1 && used[0].sendDb === 0) {
    const w = wires.get(used[0].key) ?? SILENT_WIRE
    return side ? w[side] : foldToMono(w)
  }
  const parts: SideLevels[] = []
  for (const u of used) {
    const w = wires.get(u.key) ?? SILENT_WIRE
    parts.push(shifted(side ? w[side] : foldToMono(w), u.sendDb))
  }
  return sumSides(parts)
}

/** What a card is given to work out its levels, whatever its mode. */
interface CardAt {
  card: CardPlan
  /** What arrives: analog or digital (the domain it works in) */
  domain: SignalDomain
  mixedDomains: boolean
  /** The levels arriving, one side (or every wire folded into one: null) */
  arriving: (side: Side) => SideLevels
  /** Its maths on one side (or its only channel) — passed on as it is when bypassed */
  runSide: (side: Side) => SideResult
}

/** What a mode gives: the stage's domain, gain reduction and condition (`side`), what it works on and what it sends. */
interface CardRun {
  side: Omit<SideResult, 'out'>
  in: WireSignal
  out: WireSignal
}

/** How each mode works a card's levels out. */
const MODES: Record<CardMode, (at: CardAt) => CardRun> = {
  'needs-amp':  ({ domain, arriving }) => ({ side: { domain, condition: 'needsAmp' }, in: mono(arriving(null)), out: SILENT_WIRE }),
  'needs-gain': ({ domain, arriving }) => ({ side: { domain, condition: 'needsGain' }, in: mono(arriving(null)), out: SILENT_WIRE }),

  // Mono wire in → Pan knob spreads it over L / R. Stereo wire in → Balance knob. Each side is
  // turned down as a whole: its peaks, average and noise alike.
  pan: ({ card, domain, arriving }) => {
    const { node } = card
    const position = param(node, 'panPosition')
    if (card.followKind === 'stereo') {
      const l = arriving('l')
      const r = arriving('r')
      const gain = node.bypassed ? { l: 0, r: 0 } : balanceSides(position, 0, 0)
      return { side: { domain }, in: stereo(l, r), out: stereo(shifted(l, gain.l), shifted(r, gain.r)) }
    }
    const v = arriving(null)
    const gain = node.bypassed && card.fed ? { l: 0, r: 0 } : panSides(position, 0)
    return { side: { domain }, in: mono(v), out: stereo(shifted(v, gain.l), shifted(v, gain.r)) }
  },

  // A stereo source (a Keyboard, a PC, the Generator set to Stereo) sends the same level on both sides
  source: ({ card, runSide }) => {
    const only = runSide(null)
    return { side: only, in: SILENT_WIRE, out: isNodeStereo(card.node) ? stereo(only.out, only.out) : mono(only.out) }
  },

  // The louder side drives the detector (reading by reading); the same change goes to both
  // sides, then each gets the card's own output noise (D18 — a dynamics card has no input noise)
  linked: ({ card, domain, mixedDomains, arriving }) => {
    const l   = arriving('l')
    const r   = arriving('r')
    const ctx = contextOf(card, domain, mixedDomains, null)
    const detector = louder(l, r)
    const done     = processJob(card.job, detector, ctx)
    const linked   = (s: SideLevels) => {
      const changed = eachReading((k) => (isFinite(detector[k]) ? s[k] + (done.out[k] - detector[k]) : s[k]))
      return withOutputNoise(card.job, { ...done, out: changed }, ctx)
    }
    return { side: done, in: stereo(l, r), out: stereo(linked(l), linked(r)) }
  },

  // Once per side
  stereo: ({ arriving, runSide }) => {
    const left  = runSide('l')
    const right = runSide('r')
    return { side: left, in: stereo(arriving('l'), arriving('r')), out: stereo(left.out, right.out) }
  },

  // One channel
  mono: ({ arriving, runSide }) => {
    const only = runSide(null)
    return { side: only, in: mono(arriving(null)), out: mono(only.out) }
  },
}

/**
 * The levels at every card and on every wire, as the number engine reads them: each card's maths
 * on the readings (signal/process.ts) — a dynamics card's curve on each reading on its own.
 */
export function runChain(plans: CardPlan[]): ChainLevels {
  const cards  = new Map<string, CardLevels>()
  const wires  = new Map<string, WireSignal>()
  /** The domain each output sends in (keyed like `wires`) */
  const domains  = new Map<string, SignalDomain>()
  const domainOf = (key: string) => domains.get(key) ?? 'analog'

  for (const card of plans) {
    const { node, job } = card

    // Analog or digital: what arrives decides (the Relay: its selected input). A bus can't mix them.
    const [first, ...others] = card.domainFrom
    const inputDomain  = first !== undefined ? domainOf(first) : 'analog'
    const mixedDomains = others.some((id) => domainOf(id) !== inputDomain)

    const arriving = (side: Side) => arrivingAt(card, wires, side)
    const runSide  = (side: Side): SideResult => {
      const input = arriving(side)
      // Bypassed: passed on as it is, with no hiss of its own (a bus still adds its wires up)
      if (node.bypassed && card.fed) return { out: flattenPeaks(input, inputDomain), domain: inputDomain }
      return processSide(job, input, contextOf(card, inputDomain, mixedDomains, side))
    }

    const { side, in: inSig, out } = MODES[card.mode]({ card, domain: inputDomain, mixedDomains, arriving, runSide })
    let outSig = out

    let condition = side.condition
    // An amplifier's output is speaker level — far too strong for an active speaker's input: it
    // blows as soon as anything reaches it (the music, or only its noise in a pause)
    if (card.amped && (isFinite(levelOf(outSig)) || isFinite(outSig.l.noise))) {
      const loud = shifted(outSig.l, SPEAKER_LEVEL_DB)
      outSig    = mono({ ...loud, rms: Math.max(loud.rms, CLIP_DBU), peak: Math.max(loud.peak, CLIP_DBU) })
      condition = 'blown'
    }
    // A guitar straight into a desk input: the level is fine, the high notes are lost
    if (card.needsDi) condition = 'needsDi'
    // A condenser microphone without its 48V: it hears the sound but sends nothing, not even hiss (D21)
    if (card.unpowered) {
      condition = 'noPhantom'
      outSig    = SILENT_WIRE
    }

    // A DI Box in a ground loop starts a hum on its XLR Out. It is part of the noise from there on:
    // every card treats it as it treats the noise (a fader turns it down with the music, a gate
    // shuts it off in the pauses); only Ground Lift on the DI takes it away.
    if (card.groundLoop) outSig = { ...outSig, l: humming(outSig.l), r: humming(outSig.r) }

    cards.set(card.key, {
      in: inSig, out: outSig, domain: side.domain, inDomain: inputDomain, mixedDomains,
      gainReductionDb: side.gainReductionDb, condition,
    })
    for (const o of card.outputs) {
      wires.set(o.key, onPort(o.kind, o.direct ? inSig : outSig, LEVEL_SIDES))
      domains.set(o.key, side.domain)
    }
  }

  return { cards, wires }
}
