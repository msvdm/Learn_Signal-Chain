import type { ComplexityLevel } from '../data/levels'
import { NODE_REGISTRY, initialParams } from '../data/nodeRegistry'
import type { NodeParamValue, SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import type { Size } from './geometry'
import { withNodes } from '../graph/edits'
import { CHAIN_APP, CHAIN_VERSION } from './chainFile'
import type { ChainFile } from './chainFile'
import { GRID, PORT_TOP } from './layoutHelpers'

// The tutorial's example chains (D25): built here, opened like a saved chain (File → Open).
// Cards in a row share their port line, so the wires between them are straight: their first port
// line — a sound source's Sound output is halfway down its card, so the rest of its row sits lower.

export type ExampleKey =
  | 'singer' | 'band' | 'recording'
  | 'vocalChannel' | 'monitorMix' | 'guitarDi'
  | 'converters' | 'stream'

/** The examples by level, in the order the tutorial lists them. */
export const EXAMPLES: Record<ComplexityLevel, ExampleKey[]> = {
  beginner:     ['singer', 'band', 'recording'],
  intermediate: ['vocalChannel', 'monitorMix', 'guitarDi'],
  advanced:     ['converters', 'stream'],
}

/**
 * Each card's size as the app draws it (measured in the app, 2026-10-25): the registry's minimum
 * leaves out a face's meter, and some cards grow past it. Only the spacing depends on it.
 */
const SIZES: Record<ComplexityLevel, Partial<Record<TypeKey, [w: number, h: number]>>> = {
  beginner: {
    'vocal': [320, 328], 'drum-kit': [320, 328], 'mic': [160, 164], 'instrument': [320, 328], 'keyboard': [320, 350],
    'stage-box': [320, 328], 'mixer': [1230, 728], 'interface': [412, 328], 'daw': [412, 328], 'amp': [692, 342],
    'speaker': [292, 340], 'active-speaker': [292, 340], 'studio-monitor': [292, 340],
  },
  intermediate: {
    'vocal': [412, 328], 'mic': [160, 164], 'instrument': [412, 328], 'di-box': [432, 309], 'guitar-amp': [352, 413],
    'gain': [217, 275], 'hpf': [196, 206], 'eq': [603, 308], 'comp': [273, 315], 'fader': [198, 572], 'pan': [232, 298],
    'master-bus': [398, 361], 'aux-bus': [398, 397], 'active-speaker': [458, 412],
  },
  advanced: {
    'vocal': [412, 328], 'mic': [160, 164], 'gain': [217, 275], 'adc': [320, 218], 'eq': [682, 466], 'comp': [618, 366],
    'dac': [320, 259], 'fader': [198, 572], 'master-bus': [398, 361], 'encoder': [320, 259], 'broadcast': [412, 328],
    'active-speaker': [458, 412],
  },
}

function sizeOf(typeKey: TypeKey, level: ComplexityLevel): Size {
  const size = SIZES[level][typeKey]
  if (!size) throw new Error(`No size for ${typeKey} at ${level}`)
  return { w: size[0], h: size[1] }
}

/** How far below a card's top its wires leave or arrive: its first port line, or halfway down (a Sound output). */
function portLineOf(typeKey: TypeKey, level: ComplexityLevel): number {
  return NODE_REGISTRY[typeKey].outputs[0]?.middle ? sizeOf(typeKey, level).h / 2 : PORT_TOP
}

/** Room between two cards (px). */
const GAP = 2 * GRID
const snap = (v: number) => Math.ceil(v / GRID) * GRID

type Card = [id: string, typeKey: TypeKey, params?: Record<string, NodeParamValue>]

/** A chain drawn card by card at one level. */
function sketch(level: ComplexityLevel) {
  const nodes: SignalNode[] = []
  const edges: SignalEdge[] = []
  const node = (id: string) => nodes.find((n) => n.id === id)!
  const size = (id: string) => sizeOf(node(id).typeKey, level)

  function put([id, typeKey, params = {}]: Card, x: number, y: number) {
    nodes.push({ id, typeKey, position: { x, y }, params: { ...initialParams(typeKey, level), ...params }, bypassed: false })
  }

  return {
    put,
    /** Cards left to right from (x, y), on one port line (the lowest of theirs: the highest card's top is y) */
    row(x: number, y: number, cards: Card[]) {
      const line = Math.max(...cards.map(([, typeKey]) => portLineOf(typeKey, level)))
      for (const card of cards) {
        put(card, x, y + line - portLineOf(card[1], level))
        x += snap(sizeOf(card[1], level).w) + GAP
      }
    },
    /** Where the next card right of `id` goes */
    right: (id: string) => node(id).position.x + snap(size(id).w) + GAP,
    /** Where the next card below `id` goes */
    below: (id: string) => node(id).position.y + snap(size(id).h) + GAP,
    /** The lowest a card of `ids` reaches, plus a gap: the next row's top */
    under: (...ids: string[]) => Math.max(...ids.map((id) => node(id).position.y + snap(size(id).h))) + GAP,
    x: (id: string) => node(id).position.x,
    y: (id: string) => node(id).position.y,
    /** Where a card's first port line is */
    portY: (id: string) => node(id).position.y + PORT_TOP,
    /**
     * A wire from `from`'s output (`out`, else its first) into `to`'s input (`into`, else its first),
     * with its bends (as clicks on empty space make them) when given
     */
    wire(from: string, to: string, out?: string, into?: string, bends?: { x: number; y: number }[]) {
      edges.push({
        id: `${from}-${to}-${edges.length}`,
        source: from, sourceHandle: out ?? NODE_REGISTRY[node(from).typeKey].outputs[0].id,
        target: to, targetHandle: into ?? NODE_REGISTRY[node(to).typeKey].inputs[0].id,
        ...(bends ? { waypoints: bends } : {}),
      })
    },
    /**
     * A wire back to the start of the next row: down into the gap above that row, left past the
     * card, and into it — not through the cards between (bends, as a click on empty space makes)
     */
    wrap(from: string, to: string, out?: string) {
      const gap = node(to).position.y - GAP / 2
      this.wire(from, to, out, undefined, [
        { x: node(from).position.x + snap(size(from).w) + GRID, y: gap },
        { x: node(to).position.x - GRID, y: gap },
      ])
    },
    /** Each card wired into the next, first output to first input */
    chain(...ids: string[]) {
      for (let i = 1; i < ids.length; i++) this.wire(ids[i - 1], ids[i])
    },
    file(name: string): ChainFile {
      // The sources get their chain colours, as when dropped on the canvas
      const view = withNodes({ nodes: [], edges: [] }, nodes, edges)
      const sizes = Object.fromEntries(nodes.map((n) => [n.id, size(n.id)]))
      return { app: CHAIN_APP, version: CHAIN_VERSION, name, level, nodes: view.nodes, edges: view.edges, sizes }
    },
  }
}

const FLIPPED = { flipH: true }

const BUILD: Record<ExampleKey, (name: string) => ChainFile> = {
  // ── Beginner ──
  singer: (name) => {
    const s = sketch('beginner')
    s.row(0, 0, [['voice', 'vocal'], ['mic', 'mic'], ['desk', 'mixer']])
    s.put(['left', 'active-speaker'], s.right('desk'), s.y('desk'))
    s.put(['right', 'active-speaker'], s.right('desk'), s.below('left'))
    s.chain('voice', 'mic', 'desk')
    s.wire('desk', 'left', 'main')
    s.wire('desk', 'right', 'main')
    return s.file(name)
  },
  band: (name) => {
    const s = sketch('beginner')
    s.row(0, 0, [['voice', 'vocal'], ['voiceMic', 'mic']])
    s.row(0, s.below('voice'), [['drums', 'drum-kit'], ['drumMic', 'mic']])
    // The guitar and keys end where the microphones do: every wire bends in the gap before the stage box
    const end = s.right('voiceMic') - GAP
    s.put(['guitar', 'instrument'], end - snap(sizeOf('instrument', 'beginner').w), s.below('drums'))
    s.put(['keys', 'keyboard'], end - snap(sizeOf('keyboard', 'beginner').w), s.below('guitar'))
    // On the voice's port line, as its microphone
    const top = s.y('voiceMic')
    s.put(['box', 'stage-box'], s.right('voiceMic'), top)
    s.put(['desk', 'mixer'], s.right('box'), top)
    // A gap more before the rack: the Main's split into A and B stays clear of the monitor wire's drop
    s.put(['amp', 'amp'], s.right('desk') + GAP, top)
    s.put(['left', 'speaker'], s.right('amp'), top)
    s.put(['right', 'speaker'], s.right('amp'), s.below('left'))
    s.put(['wedge', 'active-speaker', FLIPPED], s.right('amp'), s.below('right'))
    s.chain('voice', 'voiceMic', 'box')
    s.chain('drums', 'drumMic', 'box')
    s.wire('guitar', 'box')
    s.wire('keys', 'box')
    // The Mixer's Main is one stereo wire into the Amplifier (both its inputs — D27): L and R out
    s.chain('box', 'desk', 'amp', 'left')
    s.wire('amp', 'right', 'out-r')
    s.wire('desk', 'wedge', 'monitor')
    return s.file(name)
  },
  recording: (name) => {
    const s = sketch('beginner')
    s.row(0, 0, [['voice', 'vocal'], ['mic', 'mic'], ['interface', 'interface'], ['computer', 'daw']])
    s.put(['left', 'studio-monitor'], s.x('computer'), s.below('computer'))
    s.put(['right', 'studio-monitor'], s.x('left'), s.below('left'))
    s.chain('voice', 'mic', 'interface', 'computer')
    s.wire('interface', 'left', 'out')
    s.wire('interface', 'right', 'out')
    return s.file(name)
  },

  // ── Intermediate ──
  vocalChannel: (name) => {
    const s = sketch('intermediate')
    s.row(0, 0, [['voice', 'vocal'], ['mic', 'mic'], ['preamp', 'gain'], ['hpf', 'hpf'], ['eq', 'eq'], ['comp', 'comp']])
    const y = s.under('voice', 'mic', 'preamp', 'hpf', 'eq', 'comp')
    s.row(s.x('preamp'), y, [['fader', 'fader'], ['pan', 'pan'], ['master', 'master-bus'], ['left', 'active-speaker']])
    s.put(['right', 'active-speaker'], s.x('left'), s.below('left'))
    s.chain('voice', 'mic', 'preamp', 'hpf', 'eq', 'comp')
    s.wrap('comp', 'fader')
    s.chain('fader', 'pan', 'master', 'left')
    s.wire('master', 'right', 'out-r')
    return s.file(name)
  },
  monitorMix: (name) => {
    const s = sketch('intermediate')
    s.row(0, 0, [['voice', 'vocal'], ['mic', 'mic'], ['preamp', 'gain'], ['hpf', 'hpf'], ['fader', 'fader'], ['pan', 'pan'], ['master', 'master-bus'], ['left', 'active-speaker']])
    s.put(['right', 'active-speaker'], s.x('left'), s.below('left'))
    // The aux send: its own level for the voice in the wedge, before the fader
    s.row(s.x('fader'), s.under('fader', 'right'), [['send', 'gain'], ['aux', 'aux-bus'], ['wedge', 'active-speaker', FLIPPED]])
    s.chain('voice', 'mic', 'preamp', 'hpf', 'fader', 'pan', 'master', 'left')
    s.wire('master', 'right', 'out-r')
    s.chain('hpf', 'send', 'aux', 'wedge')
    return s.file(name)
  },
  guitarDi: (name) => {
    const s = sketch('intermediate')
    // The amp is loud and the DI's signal strong: each preamp set lower than a voice's, so the two
    // channels add up to a good level
    s.row(0, 0, [['guitar', 'instrument'], ['di', 'di-box', { groundLift: true }], ['preamp', 'gain', { preampDb: 30 }], ['fader', 'fader'], ['master', 'master-bus'], ['left', 'active-speaker']])
    s.put(['right', 'active-speaker'], s.x('left'), s.below('left'))
    // The DI feeds the desk and the amp: both grounded through it, so its Ground Lift is on (no hum)
    s.row(0, s.under('fader', 'right'), [['amp', 'guitar-amp'], ['ampMic', 'mic'], ['ampPreamp', 'gain', { preampDb: 20 }], ['ampFader', 'fader']])
    s.chain('guitar', 'di', 'preamp', 'fader', 'master', 'left')
    s.wire('master', 'right', 'out-r')
    s.wrap('di', 'amp', 'direct')
    s.chain('amp', 'ampMic', 'ampPreamp', 'ampFader')
    s.wire('ampFader', 'master', undefined, undefined, [{ x: s.x('master') - GRID, y: s.portY('ampFader') }])
    return s.file(name)
  },

  // ── Advanced ──
  converters: (name) => {
    const s = sketch('advanced')
    s.row(0, 0, [['voice', 'vocal'], ['mic', 'mic'], ['preamp', 'gain'], ['adc', 'adc'], ['eq', 'eq']])
    s.row(s.x('preamp'), s.under('voice', 'mic', 'preamp', 'adc', 'eq'), [['comp', 'comp'], ['dac', 'dac'], ['speaker', 'active-speaker']])
    s.chain('voice', 'mic', 'preamp', 'adc', 'eq')
    s.wrap('eq', 'comp')
    s.chain('comp', 'dac', 'speaker')
    return s.file(name)
  },
  stream: (name) => {
    const s = sketch('advanced')
    s.row(0, 0, [['voice', 'vocal'], ['mic', 'mic'], ['preamp', 'gain'], ['adc', 'adc'], ['comp', 'comp']])
    s.row(s.x('preamp'), s.under('voice', 'mic', 'preamp', 'adc', 'comp'), [['fader', 'fader'], ['master', 'master-bus'], ['encoder', 'encoder'], ['stream', 'broadcast']])
    s.chain('voice', 'mic', 'preamp', 'adc', 'comp')
    s.wrap('comp', 'fader')
    s.chain('fader', 'master', 'encoder', 'stream')
    return s.file(name)
  },
}

/** An example as a chain file, named `name` (in the app's language). */
export function exampleChain(key: ExampleKey, name: string): ChainFile {
  return BUILD[key](name)
}
