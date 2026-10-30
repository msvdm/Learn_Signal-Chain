import type { SignalNode, SignalEdge, TypeKey } from '../data/nodeRegistry'
import { MATRIX_PORT, MIXER_MAIN_PORT, MIXER_MONITOR_PORT, NODE_REGISTRY, SOUND_PORT, TAKES_WHOLE_MIX, TO_PC_PORT, portSide } from '../data/nodeRegistry'
import type { ComplexityLevel } from '../data/levels'
import { SIGNAL_LEVEL, atLeast } from '../data/levels'
import type { GraphView, WireSource } from './graph'
import { drawnPorts, getPorts, instrumentAt, isMatrixSource, micLevelAt, otherAmpInput, outputKind } from './queries'
import { MAX_SLOTS, takesMany } from './slots'

type TargetNode = Pick<SignalNode, 'id' | 'typeKey' | 'params'>

/** A Mixer's outputs: into a DAW, a USB wire (graph/usbLink.ts) */
const MIXER_OUTPUTS: ReadonlySet<string> = new Set([MIXER_MAIN_PORT, MIXER_MONITOR_PORT])

/**
 * A wire from `source` that goes into an Amplifier as one stereo wire: a stereo one, or a mix's L / R
 * (the Amplifier takes the mix over — graph/mainFader.ts).
 */
function stereoInto(source: WireSource, view: GraphView): boolean {
  return portSide(source.handleId) !== null || outputKind(source.nodeId, source.handleId, view) === 'stereo'
}

/**
 * True when this input port can take one more wire.
 * An input that takes several wires (`many`: a bus's, the Mixer's, an Audio Interface's line input …)
 * takes up to MAX_SLOTS — just not the same wire twice; which of its ports a wire goes on is
 * slots.ts's (slotFree). Every other input takes one wire.
 * The USB link (D22): an Interface's To computer goes only into a DAW — one wire, which carries the
 * sound both ways (graph/usbLink.ts) — and below Advanced a DAW takes nothing else but a Mixer's
 * output (Beginner: a desk with USB; nodeAcceptsWire). One computer per Interface. A hidden port takes no wire (the USB wire's way
 * back is the store's).
 * An Amplifier (D27; with `nodes`, to read what the wires carry): one stereo wire goes into both its
 * inputs, so it needs the other free — and while one is in, the other input holds it too.
 */
export function portAcceptsWire(
  node: TargetNode,
  handleId: string,
  edges: SignalEdge[],
  source?: WireSource,
  nodes?: SignalNode[],
): boolean {
  if (source && node.id === source.nodeId) return false
  if (NODE_REGISTRY[node.typeKey].inputs.some((p) => p.id === handleId && p.hidden)) return false
  if (node.typeKey === 'amp' && nodes) {
    const view  = { nodes, edges }
    const other = edges.filter((e) => e.target === node.id && e.targetHandle === otherAmpInput(handleId))
    if (other.some((e) => stereoInto({ nodeId: e.source, handleId: e.sourceHandle }, view))) return false
    if (other.length > 0 && source && stereoInto(source, view)) return false
  }
  // To computer goes only into a DAW (a port of its own: the rule needs no card lookup)
  if (source && node.typeKey !== 'daw' && source.handleId === TO_PC_PORT) return false
  // One computer per Interface
  if (source?.handleId === TO_PC_PORT && edges.some((e) => e.source === source.nodeId && e.sourceHandle === TO_PC_PORT)) return false
  const onPort = edges.filter((e) => e.target === node.id && e.targetHandle === handleId)
  if (takesMany(node.typeKey, handleId)) {
    return onPort.length < MAX_SLOTS && (!source || !onPort.some((e) => e.source === source.nodeId && e.sourceHandle === source.handleId))
  }
  return onPort.length === 0
}

/**
 * True when a wire from `source` may end on at least one input of `targetNode` (`level`: the canvas's
 * — some rules hold only at a level; none, only the rest).
 * A Matrix Bus takes mixes only, after their fader (isMatrixSource); a send (the whole mix on one
 * wire) feeds only what takes a whole mix: a Matrix Bus, Stream / Broadcast, an Encoder.
 * A Guitar Amp's sound reaches only a microphone, and a microphone hears nothing else; a Guitar Amp
 * takes only a guitar at instrument level (instrumentAt: not a DI Box's XLR Out, not a line or a mic).
 * An Amplifier's output is speaker level: only a passive speaker takes it; a Stage Box's snake goes
 * only into a Mixer. An Audio Interface records
 * line-level signals: not a microphone before its Preamp, nor a guitar (D22) — the computer's sound comes
 * out of its line output, into the desk or the monitors. At Beginner, with no levels, it takes them like
 * the Mixer does (the user's call, 2026-10-11). The USB link: portAcceptsWire.
 * The digital picture (D23): an Encoder's output goes only into Stream / Broadcast, which at Advanced
 * takes nothing else; a DAW plays its song only into a Recorder Track, whose Monitor out goes into
 * a processing or routing card (back into a channel, or on to be heard) — not straight into an end
 * point.
 */
export function nodeAcceptsWire(
  targetNode: TargetNode,
  source: WireSource,
  edges: SignalEdge[],
  nodes: SignalNode[],
  level?: ComplexityLevel,
): boolean {
  if (targetNode.id === source.nodeId) return false
  // Below Advanced a DAW takes only the USB link: an Interface's To computer, a Mixer's output (a
  // desk with USB). At Advanced it is a digital summing bus: any wire (numbers only — signal/process.ts)
  const usb = source.handleId === TO_PC_PORT || MIXER_OUTPUTS.has(source.handleId)
  if (targetNode.typeKey === 'daw' && level !== 'advanced' && !usb) return false
  if ((targetNode.typeKey === 'mic') !== (source.handleId === SOUND_PORT)) return false
  if (targetNode.typeKey === 'guitar-amp' && instrumentAt(source.nodeId, source.handleId, { nodes, edges }) === null) return false
  const from = nodes.find((n) => n.id === source.nodeId)?.typeKey
  if (targetNode.typeKey !== 'speaker' && from === 'amp') return false
  // A Stage Box's snake goes only into a Mixer
  if (targetNode.typeKey !== 'mixer' && from === 'stage-box') return false
  if (from === 'encoder' && targetNode.typeKey !== 'broadcast') return false
  if (targetNode.typeKey === 'broadcast' && level === 'advanced' && from !== 'encoder') return false
  if (from === 'daw' && targetNode.typeKey !== 'recorder') return false
  if (from === 'recorder' && NODE_REGISTRY[targetNode.typeKey].category === 'sink') return false
  if (targetNode.typeKey === 'interface' && (level === undefined || atLeast(level, SIGNAL_LEVEL)) &&
      (micLevelAt(source.nodeId, source.handleId, { nodes, edges }) || instrumentAt(source.nodeId, source.handleId, { nodes, edges }) !== null)) return false
  const toMatrix = targetNode.typeKey === 'matrix-bus'
  if (toMatrix && !isMatrixSource(source.nodeId, source.handleId, { nodes, edges })) return false
  if (!TAKES_WHOLE_MIX.has(targetNode.typeKey) && source.handleId === MATRIX_PORT) return false
  return getPorts(targetNode).inputs.some((p) => portAcceptsWire(targetNode, p.id, edges, source, nodes))
}

/** Id of the card being dropped while its wires are checked (it is not on the canvas yet). */
const DROPPED = '__dropped__'

/**
 * True when a card of this type dropped onto `wire` at `level` goes in the middle of it: the wire is
 * replaced by one from its source into the card's first input and one from the card's first output
 * to its target (withNodeOnWire), and each must be a wire you could draw by hand. Otherwise the card
 * is placed where it was dropped, unwired. A card of several paths (an Audio Interface, a DAW) never
 * goes into a chain (D22), nor one with no input or output drawn at that level.
 */
export function wireTakesCard(typeKey: TypeKey, wire: SignalEdge, view: GraphView, level: ComplexityLevel): boolean {
  const card: SignalNode = { id: DROPPED, typeKey, position: { x: 0, y: 0 }, params: {}, bypassed: false }
  const { inputs, outputs } = drawnPorts(card, level)
  if (inputs.length === 0 || outputs.length === 0 || NODE_REGISTRY[typeKey].routes) return false
  const nodes  = [...view.nodes, card]
  const target = view.nodes.find((n) => n.id === wire.target)
  if (!target) return false

  // The wire's source into the card …
  const rest = view.edges.filter((e) => e.id !== wire.id)
  const fromSource: WireSource = { nodeId: wire.source, handleId: wire.sourceHandle }
  if (!nodeAcceptsWire(card, fromSource, rest, nodes, level) || !portAcceptsWire(card, inputs[0].id, rest, fromSource, nodes)) return false

  // … then the card into the wire's target
  const withIn: SignalEdge[] = [...rest, {
    id: `${DROPPED}-in`, source: wire.source, sourceHandle: wire.sourceHandle, target: DROPPED, targetHandle: inputs[0].id,
  }]
  const fromCard: WireSource = { nodeId: DROPPED, handleId: outputs[0].id }
  return nodeAcceptsWire(target, fromCard, withIn, nodes, level) && portAcceptsWire(target, wire.targetHandle, withIn, fromCard, nodes)
}
