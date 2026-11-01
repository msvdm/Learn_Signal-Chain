import type { NodePort, SignalEdge, SignalNode } from '../data/nodeRegistry'
import { LINK_PORT, LINK_WIRES, NODE_REGISTRY, channelIn, channelLink, channelOut, param } from '../data/nodeRegistry'
import type { Graph, GraphView } from './graph'
import { graphOf } from './graph'
import { shownSlots } from './slots'
import { isUsbReturn } from './usbLink'

// A Digital Interface's cable (D40): one wire, drawn from an interface that packs (AES/EBU, AES50) into
// one that unpacks (PCM), carries every channel packed — each still its own signal, its numbers
// unchanged. In the graph each channel goes along a wire of its own that nobody draws, from the
// packing interface's hidden output k into the unpacking one's hidden input k; the store keeps one
// with every cable for every channel wired (commitGraph), so the engine, the render and every walk
// follow each channel like any other wire. An interface's paths (NodeTypeDef `routes`) keep the
// channels apart: wire k in → hidden k → along the cable → hidden k → output k.

type Iface = Pick<SignalNode, 'typeKey' | 'params'> & { id?: string }

/** A Digital Interface that unpacks a cable (its cable In, PCM Out); any other packs PCM wires into one. */
export const unpacks = (node: Pick<SignalNode, 'params' | 'typeKey'>): boolean => !param(node, 'packs')

/** A channel's hidden wire along a cable (never drawn: the cable is). */
export const isLinkChannel = (edge: SignalEdge): boolean => /^ch\d+$/.test(edge.sourceHandle)

/** A wire nobody draws: a USB wire's way back (usbLink.ts), a channel along a cable. */
export const isHiddenWire = (edge: SignalEdge): boolean => isUsbReturn(edge) || isLinkChannel(edge)

/** A cable: a Digital Interface's packed output into another's cable input. */
export function isCable(edge: SignalEdge, graph: Graph): boolean {
  return edge.sourceHandle === LINK_PORT && graph.node(edge.source)?.typeKey === 'digital-interface'
}

/** The interface at the other end of an interface's cable (none: no cable). */
export function partnerOf(nodeId: string, view: GraphView): SignalNode | undefined {
  const graph = graphOf(view)
  const node  = graph.node(nodeId)
  if (!node || node.typeKey !== 'digital-interface') return undefined
  const cable = unpacks(node)
    ? graph.into(nodeId).find((e) => e.targetHandle === LINK_PORT)
    : graph.from(nodeId).find((e) => e.sourceHandle === LINK_PORT)
  return cable && graph.node(unpacks(node) ? cable.source : cable.target)
}

/** The channels a packing interface has wired (k: the k-th input), in order. */
export function wiredChannels(nodeId: string, graph: Graph): number[] {
  const into = graph.into(nodeId)
  return Array.from({ length: LINK_WIRES }, (_, k) => k).filter((k) => into.some((e) => e.targetHandle === channelIn(k)))
}

/**
 * The wires with exactly one hidden channel wire for every channel wired into the packing end of
 * every cable, and none other. `view.edges` itself when nothing changes.
 */
export function withLinkChannels(view: GraphView): SignalEdge[] {
  const graph  = graphOf(view)
  const wanted = new Map<string, SignalEdge>()
  for (const cable of view.edges) {
    if (!isCable(cable, graph) || cable.targetHandle !== LINK_PORT) continue
    for (const k of wiredChannels(cable.source, graph)) {
      const port = channelLink(k)
      wanted.set(`${cable.source}>${cable.target}:${port}`, {
        id: `${cable.id}:${port}`, source: cable.source, sourceHandle: port, target: cable.target, targetHandle: port,
      })
    }
  }
  const kept = view.edges.filter((e) => !isLinkChannel(e) || wanted.delete(`${e.source}>${e.target}:${e.sourceHandle}`))
  if (kept.length === view.edges.length && wanted.size === 0) return view.edges
  return [...kept, ...wanted.values()]
}

// ── The ports it shows ────────────────────────────────────────────────────────

const def = NODE_REGISTRY['digital-interface']
const byId = (ports: NodePort[], id: string) => ports.find((p) => p.id === id)!
const range = (n: number) => Array.from({ length: n }, (_, k) => k)
const hiddenLinks = range(LINK_WIRES).map((k) => channelLink(k))

/** Packing: its PCM inputs (as many as shown), its cable out and the hidden channels */
const PACK_INPUTS  = range(LINK_WIRES).map((n) => range(n + 1).map((k) => byId(def.inputs, channelIn(k))))
const PACK_ALL     = range(LINK_WIRES).map((k) => byId(def.inputs, channelIn(k)))
const PACK_OUTPUTS = [byId(def.outputs, LINK_PORT), ...hiddenLinks.map((id) => byId(def.outputs, id))]
/** Unpacking: its cable in and the hidden channels, its PCM outputs (as many as shown) */
const UNPACK_INPUTS  = [byId(def.inputs, LINK_PORT), ...hiddenLinks.map((id) => byId(def.inputs, id))]
const UNPACK_OUTPUTS = range(LINK_WIRES).map((n) => range(n + 1).map((k) => byId(def.outputs, channelOut(k))))

/**
 * A Digital Interface's ports: packing, one PCM input per wire and an empty one for the next (as a
 * bus's, up to LINK_WIRES — every input with no wires to read); unpacking, one output per channel the
 * cable brings (at least one), or per wire still plugged in. The same layout is always the same arrays.
 */
export function interfacePorts(node: Iface, view?: GraphView): { inputs: NodePort[]; outputs: NodePort[] } {
  if (unpacks(node)) {
    let shown = 1
    if (view && node.id) {
      const graph = graphOf(view)
      for (const e of graph.into(node.id)) {
        const k = hiddenLinks.indexOf(e.targetHandle)
        if (k >= 0) shown = Math.max(shown, k + 1)
      }
      for (const e of graph.from(node.id)) {
        const k = range(LINK_WIRES).find((i) => channelOut(i) === e.sourceHandle)
        if (k !== undefined) shown = Math.max(shown, k + 1)
      }
    }
    return { inputs: UNPACK_INPUTS, outputs: UNPACK_OUTPUTS[shown - 1] }
  }
  if (!view || !node.id) return { inputs: PACK_ALL, outputs: PACK_OUTPUTS }
  return { inputs: PACK_INPUTS[shownSlots(wiredChannels(node.id, graphOf(view))) - 1], outputs: PACK_OUTPUTS }
}

/**
 * The wires without those on a port a Digital Interface no longer has (it was switched between
 * packing and unpacking: its In or Out set to PCM). `view.edges` itself when nothing goes.
 */
export function withoutStrayInterfaceWires(view: GraphView): SignalEdge[] {
  const graph = graphOf(view)
  const has = (id: string, side: 'inputs' | 'outputs', port: string) => {
    const node = graph.node(id)
    if (node?.typeKey !== 'digital-interface') return true
    const all = unpacks(node)
      ? side === 'inputs' ? UNPACK_INPUTS : UNPACK_OUTPUTS[LINK_WIRES - 1]
      : side === 'inputs' ? PACK_ALL : PACK_OUTPUTS
    return all.some((p) => p.id === port)
  }
  const kept = view.edges.filter((e) => has(e.source, 'outputs', e.sourceHandle) && has(e.target, 'inputs', e.targetHandle))
  return kept.length === view.edges.length ? view.edges : kept
}
