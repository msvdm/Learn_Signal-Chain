import type { NodePort, SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { NODE_REGISTRY, portRows } from '../data/nodeRegistry'
import type { GraphView } from './graph'
import { graphOf } from './graph'

// An input that takes several wires (`many`: a bus's, the Mixer's, an Audio Interface's line
// input …) is drawn as one port per wire, and one empty port for the next, up to MAX_SLOTS: each
// port holds one wire, so unplugging one is one click. The signal does not care which: every wire
// still goes into the input itself (`targetHandle`), and its `slot` only says where it is drawn.
// Slot 0 is the input's own port (its id); slot k is drawn as `<id>.<k>`, k port lines lower.

/** The most wires one such input takes */
export const MAX_SLOTS = 8

const SEP = '.'

/** True when this input of this type takes several wires, one port each. */
export function takesMany(typeKey: TypeKey, portId: string): boolean {
  return NODE_REGISTRY[typeKey].inputs.some((p) => p.id === portId && p.many === true)
}

/** The id a slot's port is drawn with. */
export function slotHandle(portId: string, slot: number): string {
  return slot === 0 ? portId : `${portId}${SEP}${slot}`
}

/** The input and slot a drawn port is: `in.3` is slot 3 of `in`; any other id slot 0 of itself. */
export function slotOfHandle(handle: string): { port: string; slot: number } {
  const at = handle.lastIndexOf(SEP)
  const k  = at < 0 ? NaN : Number(handle.slice(at + 1))
  return Number.isInteger(k) && k > 0 ? { port: handle.slice(0, at), slot: k } : { port: handle, slot: 0 }
}

/** The port a wire is drawn into: its slot's (React Flow's targetHandle). */
export function drawnTarget(edge: SignalEdge): string {
  return edge.slot === undefined ? edge.targetHandle : slotHandle(edge.targetHandle, edge.slot)
}

/** How many ports an input with wires on these slots draws: the slots in use, and one empty — a gap left by an unplugged wire is it. */
export function shownSlots(used: number[]): number {
  if (used.length === 0) return 1
  const last = Math.max(...used)
  const full = new Set(used).size === last + 1
  return full && last + 1 < MAX_SLOTS ? last + 2 : last + 1
}

/** The wires drawn into one port: on a `many` input, the one on that slot; else every wire into it. */
export function wiresIntoSlot(view: GraphView, nodeId: string, handle: string): SignalEdge[] {
  const graph = graphOf(view)
  const node  = graph.node(nodeId)
  const { port, slot } = slotOfHandle(handle)
  if (!node || !takesMany(node.typeKey, port)) return graph.into(nodeId).filter((e) => e.targetHandle === handle)
  return graph.into(nodeId).filter((e) => e.targetHandle === port && (e.slot ?? 0) === slot)
}

/** True when a drawn port of a `many` input is free (any other port: true — portAcceptsWire decides). */
export function slotFree(view: GraphView, node: Pick<SignalNode, 'id' | 'typeKey'>, handle: string): boolean {
  const { port } = slotOfHandle(handle)
  return !takesMany(node.typeKey, port) || wiresIntoSlot(view, node.id, handle).length === 0
}

/** A wire's place: into an input of `node` at `handle` (a drawn port), with its slot where the input takes several. */
export function wireInto(node: Pick<SignalNode, 'typeKey'>, handle: string): { targetHandle: string; slot?: number } {
  const { port, slot } = slotOfHandle(handle)
  return takesMany(node.typeKey, port) ? { targetHandle: port, slot } : { targetHandle: handle }
}

/**
 * The wires with every wire into a `many` input on a slot of its own: one already on a free slot
 * keeps it; one with none (a new wire, an opened chain, an example), or on a slot another wire
 * already holds, takes the first free one. A slot on any other wire is dropped. The same array
 * when nothing changed.
 */
export function settleSlots(view: GraphView): SignalEdge[] {
  const types = new Map(view.nodes.map((n) => [n.id, n.typeKey]))
  const taken = new Map<string, Set<number>>()
  const homeless: number[] = []
  let out = view.edges
  const set = (i: number, e: SignalEdge) => {
    if (out === view.edges) out = [...view.edges]
    out[i] = e
  }
  view.edges.forEach((e, i) => {
    const type = types.get(e.target)
    if (!type || !takesMany(type, e.targetHandle)) {
      if (e.slot !== undefined) {
        const rest = { ...e }
        delete rest.slot
        set(i, rest)
      }
      return
    }
    const key  = `${e.target}:${e.targetHandle}`
    const used = taken.get(key) ?? new Set<number>()
    taken.set(key, used)
    if (e.slot !== undefined && Number.isInteger(e.slot) && e.slot >= 0 && !used.has(e.slot)) used.add(e.slot)
    else homeless.push(i)
  })
  for (const i of homeless) {
    const e    = view.edges[i]
    const used = taken.get(`${e.target}:${e.targetHandle}`)!
    let slot = 0
    while (used.has(slot)) slot++
    used.add(slot)
    set(i, { ...e, slot })
  }
  return out
}

// One array per stack and number of ports shown: the same layout is always the same array (getPorts)
const SLOTTED = new WeakMap<NodePort[], Map<number, NodePort[]>>()

/**
 * A card's inputs as drawn: a `many` input as its ports — one per wire and an empty one (shownSlots),
 * each on a port line of its own below the input's, skipping the lines it leaves free (`skipRows`).
 * Every port gets its line (`row`). Unchanged without wires to read.
 */
export function slottedInputs(inputs: NodePort[], nodeId: string | undefined, view: GraphView | undefined): NodePort[] {
  const many = inputs.find((p) => p.many)
  if (!many || !nodeId || !view) return inputs
  const used  = graphOf(view).into(nodeId).filter((e) => e.targetHandle === many.id).map((e) => e.slot ?? 0)
  const shown = shownSlots(used)
  if (shown === 1) return inputs
  let byCount = SLOTTED.get(inputs)
  if (!byCount) SLOTTED.set(inputs, byCount = new Map())
  let ports = byCount.get(shown)
  if (!ports) {
    const rows = portRows(inputs)
    ports = inputs.flatMap((p, i): NodePort[] => {
      if (p !== many) return [{ ...p, row: rows[i] }]
      const slots: NodePort[] = []
      for (let row = rows[i]; slots.length < shown; row++) {
        if (slots.length > 0 && p.skipRows?.includes(row)) continue
        slots.push({ ...p, id: slotHandle(p.id, slots.length), slot: slots.length, row })
      }
      return slots
    })
    byCount.set(shown, ports)
  }
  return ports
}
