import type { SignalEdge, TypeKey } from '../data/nodeRegistry'
import { NODE_REGISTRY } from '../data/nodeRegistry'
import type { GraphView } from './graph'
import { graphOf } from './graph'

// Wire colours by where the sound goes (D24): each wire takes the colour of where its sound ends
// up — the Master Bus (green), an Aux Bus (blue), a Matrix Bus (magenta), the PFL Bus (yellow), an
// Audio Interface, a DAW or Stream / Broadcast (black, white on the dark theme). A wire whose sound
// goes to several of them stays green, the main flow; a wire that ends at a speaker or anything
// else takes the colour of the bus it comes from (an Aux Bus into a wedge: blue), green when none.
// Red (clipping, problems) is laid over this where the canvas draws it (hooks/useFlowElements.ts).

/** Where a wire's sound goes: the flow it is coloured for. */
export type WireFlow = 'main' | 'aux' | 'matrix' | 'pfl' | 'record'

/** The cards a wire's sound ends its way at, and the flow each gives the wires into it. */
const DESTINATION: Partial<Record<TypeKey, WireFlow>> = {
  'master-bus': 'main', 'aux-bus': 'aux', 'matrix-bus': 'matrix', 'pfl-bus': 'pfl',
  interface: 'record', daw: 'record', broadcast: 'record',
}

/** A way that ends with no destination (at a speaker, a Recorder …): it takes the colour it comes with */
const END = 'end'
type Way = WireFlow | typeof END

/** Every wire's flow, by wire id. */
export function wireFlows(view: GraphView): Map<string, WireFlow> {
  const graph = graphOf(view)
  const routesOf = (id: string) => {
    const node = graph.node(id)
    return node && NODE_REGISTRY[node.typeKey].routes
  }
  const destinationOf = (id: string) => {
    const node = graph.node(id)
    return node && DESTINATION[node.typeKey]
  }

  /** The wires leaving a card that carry what arrives on its input `port` (a card of several paths: that path's) */
  const onward = (id: string, port: string): readonly SignalEdge[] => {
    const routes = routesOf(id)
    if (!routes) return graph.from(id)
    const to = new Set(routes.filter((r) => r.from === port).flatMap((r) => r.to))
    return graph.from(id).filter((e) => to.has(e.sourceHandle))
  }
  /** The wires into a card whose sound leaves on its output `port` */
  const feeding = (id: string, port: string): readonly SignalEdge[] => {
    const routes = routesOf(id)
    if (!routes) return graph.into(id)
    const from = routes.find((r) => r.to.includes(port))?.from
    return from ? graph.into(id).filter((e) => e.targetHandle === from) : []
  }

  // Worked out once per card input / output; a loop adds nothing (it is left out of the signal too)
  const downs = new Map<string, Set<Way>>()
  const ups   = new Map<string, Set<WireFlow>>()

  /** Where a wire's sound ends its ways: each first destination, or END */
  function down(e: SignalEdge): Set<Way> {
    const at = destinationOf(e.target)
    if (at) return new Set([at])
    const key = `${e.target}:${e.targetHandle}`
    const known = downs.get(key)
    if (known) return known
    const ways = new Set<Way>()
    downs.set(key, ways)
    const next = onward(e.target, e.targetHandle)
    if (next.length === 0) ways.add(END)
    for (const n of next) for (const w of down(n)) ways.add(w)
    return ways
  }

  /** The buses a wire's sound comes from (the nearest on each way back; not what records) */
  function up(e: SignalEdge): Set<WireFlow> {
    const from = destinationOf(e.source)
    if (from && from !== 'record') return new Set([from])
    const key = `${e.source}:${e.sourceHandle}`
    const known = ups.get(key)
    if (known) return known
    const buses = new Set<WireFlow>()
    ups.set(key, buses)
    for (const f of feeding(e.source, e.sourceHandle)) for (const b of up(f)) buses.add(b)
    return buses
  }

  const only = <T>(set: Set<T>): T | undefined => (set.size === 1 ? [...set][0] : undefined)

  const flows = new Map<string, WireFlow>()
  for (const e of view.edges) {
    const comesWith = only(up(e)) ?? 'main'
    const ways = new Set([...down(e)].map((w) => (w === END ? comesWith : w)))
    flows.set(e.id, only(ways) ?? 'main')
  }
  return flows
}
