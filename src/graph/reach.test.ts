import { describe, expect, it } from 'bun:test'
import type { SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { SOUND_PORT, TO_PC_PORT } from '../data/nodeRegistry'
import { reachOf, soundAt } from './reach'
import { withUsbReturns } from './usbLink'

// Beginner (D20): no engine — the wiring alone says where the sound goes, what each end point gets
// and which wires flow.

const node = (id: string, typeKey: TypeKey, params: SignalNode['params'] = {}): SignalNode =>
  ({ id, typeKey, position: { x: 0, y: 0 }, params, bypassed: false })
/** A wire from `card:output` to `card:input` (`out` / `in` when left out), its id both in full. */
const wire = (from: string, to: string): SignalEdge => {
  const [source, sourceHandle = 'out'] = from.split(':')
  const [target, targetHandle = 'in'] = to.split(':')
  return { id: `${source}:${sourceHandle}>${target}:${targetHandle}`, source, sourceHandle, target, targetHandle }
}
/** Where the sound goes, the wires as the store keeps them (every USB wire with its way back). */
const reach = (nodes: SignalNode[], edges: SignalEdge[]) => reachOf({ nodes, edges: withUsbReturns({ nodes, edges }) })
const flowing = (r: ReturnType<typeof reach>) => [...r.flowing].sort()

describe('what an end point gets', () => {
  it('a sound wired straight in: sound, and its wire flows', () => {
    const r = reach([node('keys', 'keyboard'), node('spk', 'active-speaker')], [wire('keys', 'spk')])
    expect(r.verdicts.get('spk')).toBe('sound')
    expect(flowing(r)).toEqual(['keys:out>spk:in'])
  })

  it('nothing plugged in: not connected; a wire with no sound before it: no source', () => {
    const r = reach([node('mix', 'mixer'), node('a', 'headphones'), node('b', 'recorder')], [wire('mix:main', 'b')])
    expect(r.verdicts.get('a')).toBe('not-connected')
    expect(r.verdicts.get('b')).toBe('no-source')
    expect(flowing(r)).toEqual([])
  })

  it('a passive speaker plays only what an Amplifier sends it', () => {
    const alone = reach([node('keys', 'keyboard'), node('pass', 'speaker')], [wire('keys', 'pass')])
    expect(alone.verdicts.get('pass')).toBe('needs-amp')
    expect(flowing(alone)).toEqual([])

    const amped = reach([node('keys', 'keyboard'), node('amp', 'amp'), node('pass', 'speaker')], [wire('keys', 'amp'), wire('amp', 'pass')])
    expect(amped.verdicts.get('pass')).toBe('sound')
    expect(flowing(amped)).toEqual(['amp:out>pass:in', 'keys:out>amp:in'])
  })

  it('a microphone sends only what it hears', () => {
    const nodes = [node('voice', 'vocal'), node('mic', 'mic'), node('spk', 'active-speaker')]
    expect(reach(nodes, [wire('mic', 'spk')]).verdicts.get('spk')).toBe('no-source')
    const r = reach(nodes, [wire(`voice:${SOUND_PORT}`, 'mic'), wire('mic', 'spk')])
    expect(r.verdicts.get('spk')).toBe('sound')
    // The sound in the air flows into the microphone too
    expect(flowing(r)).toEqual(['mic:out>spk:in', `voice:${SOUND_PORT}>mic:in`])
  })

  it('a wire whose sound plays nowhere does not flow', () => {
    const r = reach([node('keys', 'keyboard'), node('mix', 'mixer')], [wire('keys', 'mix')])
    expect(soundAt(r, 'mix')).toBe(true)
    expect([...r.carrying]).toEqual(['keys:out>mix:in'])
    expect(flowing(r)).toEqual([])
  })
})

describe('the stage plan', () => {
  // Microphones on a drum kit and a singer, a keyboard: all into the Stage Box, its snake into the
  // Mixer; the Mixer's Main through an Amplifier (its L and R) to two passive speakers, its Monitor to a wedge, its
  // mix recorded through an Audio Interface; a computer plays into the Mixer
  const nodes = [
    node('kit', 'drum-kit'), node('kitMic', 'mic'), node('voice', 'vocal'), node('voiceMic', 'mic'), node('keys', 'keyboard'),
    node('box', 'stage-box'), node('mix', 'mixer'), node('pc', 'pc'),
    node('amp', 'amp'), node('left', 'speaker'), node('right', 'speaker'), node('wedge', 'active-speaker'),
    node('usb', 'interface'), node('daw', 'daw'),
  ]
  const edges = [
    wire(`kit:${SOUND_PORT}`, 'kitMic'), wire(`voice:${SOUND_PORT}`, 'voiceMic'),
    wire('kitMic', 'box'), wire('voiceMic', 'box'), wire('keys', 'box'), wire('box', 'mix'), wire('pc', 'mix'),
    wire('mix:main', 'amp'), wire('amp:out-l', 'left'), wire('amp:out-r', 'right'), wire('mix:monitor', 'wedge'),
    wire('mix:main', 'usb'), wire(`usb:${TO_PC_PORT}`, 'daw'),
  ]

  it('every speaker plays; the computer records', () => {
    const r = reach(nodes, edges)
    expect(Object.fromEntries(r.verdicts)).toEqual({ left: 'sound', right: 'sound', wedge: 'sound' })
    expect(soundAt(r, 'daw', 'in')).toBe(true)
    // Every wire flows: the USB wire too (the canvas draws it both ways, with no flow)
    expect(edges.filter((e) => !r.flowing.has(e.id))).toEqual([])
  })

  it('the Interface keeps its two paths apart: what it records never comes out of its line output', () => {
    const plus = [...nodes, node('phones', 'headphones')]
    const out  = wire('usb', 'phones')
    // The DAW plays back along the USB wire: that is what the line output sends
    expect(reach(plus, [...edges, out]).verdicts.get('phones')).toBe('sound')
    expect(reach(plus, [...edges.filter((e) => e.target !== 'daw'), out]).verdicts.get('phones')).toBe('no-source')
  })

  it('a loop does not hang it', () => {
    const r = reach(nodes, [...edges, wire('mix:monitor', 'box')])
    expect(r.verdicts.get('left')).toBe('sound')
  })
})

describe('the Amplifier (D27): two channels and a power switch', () => {
  const speakers = [node('left', 'speaker'), node('right', 'speaker')]
  const out      = [wire('amp:out-l', 'left'), wire('amp:out-r', 'right')]

  it('input A plays out of L, B out of R', () => {
    const r = reach([node('gen', 'generator'), node('amp', 'amp'), ...speakers], [wire('gen', 'amp:in-b'), ...out])
    expect(Object.fromEntries(r.verdicts)).toEqual({ left: 'no-source', right: 'sound' })
    expect(soundAt(r, 'amp', 'in')).toBe(false)
  })

  it('one stereo wire goes into both, whichever input it is plugged into', () => {
    const r = reach([node('keys', 'keyboard'), node('amp', 'amp'), ...speakers], [wire('keys', 'amp:in-b'), ...out])
    expect(Object.fromEntries(r.verdicts)).toEqual({ left: 'sound', right: 'sound' })
  })

  it('switched off: no sound past it, and its speakers say why', () => {
    const r = reach([node('keys', 'keyboard'), node('amp', 'amp', { on: false }), ...speakers], [wire('keys', 'amp'), ...out])
    expect(Object.fromEntries(r.verdicts)).toEqual({ left: 'switched-off', right: 'switched-off' })
    expect(flowing(r)).toEqual([])
  })

  it('a Guitar Amp switched off: its microphone hears nothing', () => {
    const nodes = [node('gtr', 'instrument'), node('gamp', 'guitar-amp', { on: false }), node('mic', 'mic'), node('spk', 'active-speaker')]
    const r = reach(nodes, [wire('gtr', 'gamp'), wire(`gamp:${SOUND_PORT}`, 'mic'), wire('mic', 'spk')])
    expect(r.verdicts.get('spk')).toBe('switched-off')
    expect(soundAt(r, 'mic')).toBe(false)
  })
})

describe('a Mixer wired into a DAW: a desk with USB', () => {
  it('the DAW records the mix and plays back into the Mixer', () => {
    const nodes = [node('mix', 'mixer'), node('daw', 'daw'), node('spk', 'studio-monitor')]
    const r = reach(nodes, [wire('mix:main', 'daw'), wire('mix:monitor', 'spk')])
    expect(r.verdicts.get('spk')).toBe('sound')
    expect(soundAt(r, 'daw', 'in')).toBe(true)
  })
})
