import type { NodePort, SignalNode, SignalEdge, TypeKey } from '../data/nodeRegistry'
import {
  NODE_REGISTRY, MIX_PORT, MATRIX_PORT, DI_DIRECT_PORT,
  canSplit, isMixBus, isNodeStereo, isStereoBus, param, passesThrough, portSide, splitsOnlyMix,
} from '../data/nodeRegistry'
import type { GraphView } from './graph'
import { graphOf, drivingWire, walkPassthrough } from './graph'

// What the wiring makes of a card: what its outputs carry, the ports it shows, the mix or the
// microphone it belongs to. Read from the wires on every change — nothing here is stored.

/**
 * What a wire carries:
 * - mono:   one channel. On a stereo bus it lands on both sides at full level.
 * - stereo: Left and Right together on one wire.
 * - left / right: one side of a stereo mix (a bus's L / R output). It keeps its side
 *   through effects and lands only on that side of a stereo bus.
 */
export type WireKind = 'mono' | 'stereo' | 'left' | 'right'

/**
 * What output `handleId` of a card carries: L / R outputs carry one side, a Mix or Matrix send
 * both; a Pan, a stereo source or bus sends stereo; an effect passes on what reaches it (the Relay:
 * its selected input); everything else is one channel. The signal maths takes it from here.
 */
export function outputKind(nodeId: string, handleId: string, view: GraphView): WireKind {
  const graph = graphOf(view)
  const seen  = new Set<string>()
  let id     = nodeId
  let handle = handleId
  for (;;) {
    const side = portSide(handle)
    if (side) return side === 'l' ? 'left' : 'right'
    if (handle === MIX_PORT || handle === MATRIX_PORT) return 'stereo'
    const node = graph.node(id)
    if (!node || seen.has(id)) return 'mono'
    seen.add(id)
    if (node.typeKey === 'pan') return 'stereo'
    if (NODE_REGISTRY[node.typeKey].stereo !== 'follow') return isNodeStereo(node) ? 'stereo' : 'mono'
    const wire = drivingWire(node, graph)
    if (!wire) return 'mono'
    id     = wire.source
    handle = wire.sourceHandle
  }
}

/**
 * True when this card splits a stereo signal into Left and Right: a Fader fed a bus's mix (the
 * Main Fader) or a Limiter fed one, or a Graphic EQ / Amplifier fed a stereo wire. A Graphic EQ / Amplifier with
 * nothing plugged in keeps the layout its wires show, so plugging it back in restores L and R.
 */
export function splitsStereo(node: Pick<SignalNode, 'id' | 'typeKey'>, view: GraphView): boolean {
  if (!canSplit(node.typeKey)) return false
  if (splitsOnlyMix(node.typeKey)) return mixBusOf(node.id, view) !== null
  const graph = graphOf(view)
  const wire  = graph.into(node.id)[0]
  if (!wire) {
    return graph.from(node.id).some((e) => portSide(e.sourceHandle) !== null || e.sourceHandle === MIX_PORT)
  }
  return outputKind(wire.source, wire.sourceHandle, graph) === 'stereo'
}

const MIX_OUTPUTS: NodePort[] = [{ id: MIX_PORT }]
const MATRIX_SEND_OUTPUT: NodePort = { id: MATRIX_PORT }
const SIDE_OUTPUTS: NodePort[] = [
  { id: 'out-l' },
  { id: 'out-r' },
]

/**
 * The ports a node shows right now. Inputs never change. Outputs:
 * - a bus switched to Stereo splits its output into Left and Right;
 * - a Fader fed from a bus's Mix output is the Main Fader, with Left and Right outputs; a Graphic EQ
 *   or Amplifier fed a stereo wire has Left and Right outputs too (splitsStereo);
 * - any of these whose L / R were taken over by the next card (a Main Fader, an EQ, an amp) has
 *   one Mix output instead;
 * - a Matrix send output below R while a wire uses it.
 * Pass the graph so the layout can be read from the wires.
 */
export function getPorts(
  node: Pick<SignalNode, 'typeKey' | 'params'> & { id?: string },
  view?: GraphView,
): {
  inputs: NodePort[]
  outputs: NodePort[]
} {
  const def = NODE_REGISTRY[node.typeKey]
  let outputs = def.stereoOutputs && isNodeStereo(node) ? def.stereoOutputs : def.outputs
  if (view && node.id) {
    const out     = graphOf(view).from(node.id)
    const passing = out.some((e) => e.sourceHandle === MIX_PORT)
    if (isStereoBus(node) && passing) {
      outputs = MIX_OUTPUTS
    } else if (splitsStereo({ id: node.id, typeKey: node.typeKey }, view)) {
      outputs = passing ? MIX_OUTPUTS : SIDE_OUTPUTS
    }
    if (out.some((e) => e.sourceHandle === MATRIX_PORT)) {
      outputs = [...outputs, MATRIX_SEND_OUTPUT]
    }
  }
  return { inputs: def.inputs, outputs }
}

/**
 * The card whose Mix output feeds this one — straight in, or through effects on the way.
 * Null when no mix reaches it: also when one side of it does (an effect on an Amplifier's R output
 * carries the right side only, so a Fader after it is a plain fader, not a Main Fader).
 */
export function mixSourceOf(nodeId: string, view: GraphView): string | null {
  const own = graphOf(view).node(nodeId)?.typeKey
  for (const { wire, source } of walkPassthrough(nodeId, view)) {
    if (wire.sourceHandle === MIX_PORT) return wire.source
    if (portSide(wire.sourceHandle) !== null) return null
    // Another card of the same type would take the role itself
    if (source.typeKey === own) return null
  }
  return null
}

/**
 * The bus whose mix feeds this card — through effects on the way (a limiter on the master, say)
 * and through cards that passed it on (a Main Fader, a Graphic EQ). For a Fader: null when it is
 * not a Main Fader.
 */
export function mixBusOf(nodeId: string, view: GraphView): string | null {
  const graph = graphOf(view)
  const seen  = new Set<string>()
  let cur: string | null = nodeId
  while (cur && !seen.has(cur)) {
    seen.add(cur)
    const via = mixSourceOf(cur, graph)
    const src = via ? graph.node(via) : undefined
    if (!src) return null
    if (isStereoBus(src)) return src.id
    cur = src.id
  }
  return null
}

/**
 * The Master or Aux Bus whose mix leaves this card: the bus itself, or the bus before
 * one-input effects (a limiter, an EQ, the Main Fader …). Null when the card carries no mix.
 */
export function sourceBusOf(nodeId: string, view: GraphView): string | null {
  const node = graphOf(view).node(nodeId)
  if (!node) return null
  if (isMixBus(node.typeKey)) return node.id
  if (!passesThrough(node.typeKey)) return null
  for (const { source } of walkPassthrough(nodeId, view)) {
    if (isMixBus(source.typeKey)) return source.id
  }
  return null
}

/**
 * The Master or Aux Bus whose level this Fader sets: the first one back through one-input
 * effects — mono or stereo, a Main Fader or not. Null when another Fader comes first (that one
 * sets it) or no bus feeds it.
 */
export function faderBusOf(nodeId: string, view: GraphView): SignalNode | null {
  for (const { source } of walkPassthrough(nodeId, view)) {
    if (isMixBus(source.typeKey)) return source
    if (source.typeKey === 'fader') return null
  }
  return null
}

/**
 * True when output `handleId` of this card may feed a Matrix Bus. Matrix sends are post-fader:
 * - the Matrix send, or the L / R of a stereo bus or of its Main Fader (that wire becomes the
 *   Matrix send);
 * - a mono Aux Bus's output, straight or through its fader / effects.
 * Never a bus's Mix output (that is before the Main Fader), a single source, or another Matrix Bus.
 */
export function isMatrixSource(nodeId: string, handleId: string, view: GraphView): boolean {
  const graph = graphOf(view)
  const node  = graph.node(nodeId)
  if (!node || node.typeKey === 'matrix-bus' || handleId === MIX_PORT) return false
  if (handleId === MATRIX_PORT || portSide(handleId) !== null) {
    // L / R belong to a stereo bus or its Main Fader — but not a Matrix Bus's own Main Fader
    const bus = node.typeKey === 'fader' ? mixBusOf(node.id, graph) : node.id
    const busNode = bus === null ? undefined : graph.node(bus)
    return busNode !== undefined && isMixBus(busNode.typeKey)
  }
  if (isMixBus(node.typeKey)) return handleId === 'out'
  if (!passesThrough(node.typeKey)) return false
  for (const { wire, source } of walkPassthrough(nodeId, graph)) {
    if (isMixBus(source.typeKey)) return wire.sourceHandle === 'out'
  }
  return false
}

/**
 * Which bus a wire into a Matrix Bus belongs to: one send knob per bus, so a bus's L and R
 * wires share it. A wire that no longer carries a mix keeps a knob of its own card.
 */
export function matrixSendKey(wire: SignalEdge, view: GraphView): string {
  return sourceBusOf(wire.source, view) ?? wire.source
}

/**
 * What this Gain is the Preamp of: a microphone, or a DI Box whose XLR Out brings an instrument down
 * to mic level — straight after it, or with effects such as a Pad in between. Null when it is a
 * plain gain stage.
 */
export function preampSourceOf(gainId: string, view: GraphView): string | null {
  for (const { wire, source } of walkPassthrough(gainId, view)) {
    if (source.typeKey === 'mic' || toMicLevel(source, wire.sourceHandle)) return source.id
    if (source.typeKey === 'gain') return null
  }
  return null
}

// ── Guitars: instrument level, the DI Box, the Guitar Amp ───────────────────────

/**
 * Where an instrument's signal goes into a mixing desk or PA: a Gain (the desk's preamp), a Fader,
 * a bus, an ADC, a power amplifier or a speaker. Everything else in between counts as an effect
 * pedal, which takes an instrument as it is.
 */
const DESK_INPUTS: ReadonlySet<TypeKey> = new Set<TypeKey>([
  'gain', 'fader', 'master-bus', 'aux-bus', 'matrix-bus', 'adc', 'amp', 'active-speaker', 'headphones', 'speaker',
])

/** A DI Box output that brings the instrument down to mic level: its XLR Out, unless it is bypassed. */
function toMicLevel(node: SignalNode, handleId: string): boolean {
  return node.typeKey === 'di-box' && !node.bypassed && handleId !== DI_DIRECT_PORT
}

/** An effect a guitar's signal goes through as it is (a pedal): one input, and not a desk input. */
function isPedal(typeKey: TypeKey): boolean {
  return passesThrough(typeKey) && !DESK_INPUTS.has(typeKey)
}

/**
 * The Instrument whose signal leaves this output still at instrument level: the Instrument itself,
 * or through effect pedals and a DI Box's Direct Out. Null at a DI Box's XLR Out (mic level by then),
 * a desk input, or anything that is not a guitar (a microphone, a line, a bus). A Guitar Amp takes
 * only this.
 */
export function instrumentAt(nodeId: string, handleId: string, view: GraphView): string | null {
  const graph = graphOf(view)
  const node  = graph.node(nodeId)
  if (!node) return null
  if (node.typeKey === 'instrument') return node.id
  if (toMicLevel(node, handleId) || !isPedal(node.typeKey)) return null
  for (const { wire, source } of walkPassthrough(nodeId, graph)) {
    if (source.typeKey === 'instrument') return source.id
    if (toMicLevel(source, wire.sourceHandle) || !isPedal(source.typeKey)) return null
  }
  return null
}

/**
 * Every card reached from these wires, following them on through effect pedals (and whatever
 * `onward` lets through); `found` stops the walk with true.
 */
function reaches(
  start: readonly SignalEdge[],
  view: GraphView,
  found: (node: SignalNode) => boolean,
  onward: (node: SignalNode) => readonly SignalEdge[] | null,
): boolean {
  const graph = graphOf(view)
  const seen  = new Set<string>()
  const queue = [...start]
  while (queue.length > 0) {
    const node = graph.node(queue.shift()!.target)
    if (!node || seen.has(node.id)) continue
    seen.add(node.id)
    if (found(node)) return true
    queue.push(...(onward(node) ?? []))
  }
  return false
}

/**
 * A source with nothing plugged into its output (decision D11: no connection, no signal): it shows no
 * level and no readings, and its meters stand still, until it is wired to something.
 */
export function unwiredSource(nodeId: string, view: GraphView): boolean {
  const graph = graphOf(view)
  const node  = graph.node(nodeId)
  return node !== undefined && NODE_REGISTRY[node.typeKey].category === 'source' && graph.from(nodeId).length === 0
}

/**
 * True when this Instrument's signal goes into a desk or PA input still at instrument level —
 * straight, through effect pedals, or through a DI Box's Direct Out (a thru, still instrument
 * level): the high notes get lost on the way. Fine: into a Guitar Amp, or through a DI Box's XLR Out.
 */
export function needsDi(instrumentId: string, view: GraphView): boolean {
  const graph = graphOf(view)
  return reaches(graph.from(instrumentId), graph, (n) => DESK_INPUTS.has(n.typeKey), (n) => {
    if (n.typeKey === 'guitar-amp' || n.typeKey === 'mic') return null
    // Through a DI Box only its Direct Out stays at instrument level (all of it when bypassed)
    return graph.from(n.id).filter((e) => !toMicLevel(n, e.sourceHandle))
  })
}

/**
 * A ground loop through this DI Box: its Direct Out feeds a Guitar Amp (plugged into the mains on
 * stage) while its XLR Out goes to the desk (plugged in too), and Ground Lift is off — the two
 * grounds meet through the box and the desk picks up a hum.
 */
export function groundLoop(diId: string, view: GraphView): boolean {
  const graph = graphOf(view)
  const di    = graph.node(diId)
  if (!di || di.typeKey !== 'di-box' || di.bypassed || param(di, 'groundLift')) return false
  const out = graph.from(diId)
  if (!out.some((e) => e.sourceHandle !== DI_DIRECT_PORT)) return false
  const direct = out.filter((e) => e.sourceHandle === DI_DIRECT_PORT)
  return reaches(direct, graph, (n) => n.typeKey === 'guitar-amp', (n) => (isPedal(n.typeKey) ? graph.from(n.id) : null))
}
