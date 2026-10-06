import { describe, expect, it } from 'bun:test'
import type { NodeParamValue, SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { initialParams } from '../data/nodeRegistry'
import type { SideLevels } from './levels'
import { CLIP_DBU } from './levels'
import type { WireSignal } from './chain'
import { graphSignal, stillPicture } from './engine'
import type { MeasuredChain, MeasuredStage } from './measured'
import { withMeasured } from './measured'

// The readings of a render put into the number engine's picture (decision D9): exactly as measured
// while the chain is as it was rendered; moved on by the number engine's step after a change, until
// the next render.

function card(id: string, typeKey: TypeKey, params: Record<string, NodeParamValue> = {}): SignalNode {
  return { id, typeKey, position: { x: 0, y: 0 }, params: { ...initialParams(typeKey, 'advanced'), ...params }, bypassed: false }
}

function wire(from: string, to: string): SignalEdge {
  const [source, sourceHandle = 'out'] = from.split(':')
  const [target, targetHandle = 'in'] = to.split(':')
  return { id: `${from} → ${to}`, source, sourceHandle, target, targetHandle }
}

const side = (peak: number, rms: number, noise: number): SideLevels => ({ peak, rms, noise, hum: -Infinity })
const mono = (s: SideLevels): WireSignal => ({ kind: 'mono', l: s, r: s })

/** Mic → Preamp → Switch → Fader → Compressor. */
const chain = ({ on = true, faderDb = 0 } = {}): [SignalNode[], SignalEdge[]] => [
  [card('mic', 'mic'), card('pre', 'gain', { preampDb: 50 }), card('sw', 'switch', { on }), card('fader', 'fader', { faderDb }), card('comp', 'comp')],
  [wire('mic', 'pre'), wire('pre', 'sw'), wire('sw', 'fader'), wire('fader', 'comp')],
]

/**
 * A render of `chain()` as audio/measure.ts hands it over: each card a little off the number
 * engine, as real sound is (`faderPeak`: the peaks leaving the fader).
 */
function rendered(faderPeak = 1.86): MeasuredChain {
  const [nodes, edges] = chain()
  const at = stillPicture(nodes, edges).result
  const pre = mono(side(1.86, -10, -73.88))
  const fader = mono(side(faderPeak, -10, -72.94))
  const stages = new Map<string, MeasuredStage>([
    ['mic',   { in: at.stages.mic.in, out: mono(side(-48.14, -60, -126)) }],
    ['pre',   { in: mono(side(-48.14, -60, -126)), out: pre }],
    ['sw',    { in: pre, out: pre }],
    ['fader', { in: pre, out: fader }],
    ['comp',  { in: fader, out: mono(side(2.25, -16.95, -69.94)), gainReductionDb: 6.95, curveIn: side(1.86, -10, -72.0) }],
  ])
  const wires = new Map([...stages].map(([id, s]) => [`${id}:out`, s.out]))
  return { at, stages, wires }
}

const shownFor = (c: [SignalNode[], SignalEdge[]], measured: MeasuredChain) => withMeasured(stillPicture(...c).result, measured)

describe('a render put into the picture', () => {
  it('nothing measured yet: the number engine as it is', () => {
    const result = stillPicture(...chain()).result
    expect(withMeasured(result, null)).toBe(result)
  })

  it('the chain as it was rendered: every card reads what was measured', () => {
    const shown = shownFor(chain(), rendered())
    expect(shown.stages.mic.out.l).toEqual(side(-48.14, -60, -126))
    expect(shown.stages.comp.out.l).toEqual(side(2.25, -16.95, -69.94))
    expect(shown.stages.comp.gainReductionDb).toBeCloseTo(6.95, 6)
    // The marks on its curve: what went in, what came out
    expect(shown.stages.comp.curveIn).toEqual(side(1.86, -10, -72.0))
    expect(shown.stages.comp.curveOut).toEqual(side(2.25, -16.95, -69.94))
    expect(shown.wires.get('comp:out')?.l).toEqual(side(2.25, -16.95, -69.94))
    // Health is judged on what is shown
    expect(shown.stages.comp.health).toBe('good')
  })

  it('a fader turned since: it and everything after it move by the number engine’s step at once', () => {
    const now   = stillPicture(...chain({ faderDb: -6 })).result
    const shown = withMeasured(now, rendered())
    const at    = rendered().at
    // Before the fader: as measured
    expect(shown.stages.pre.out.l).toEqual(side(1.86, -10, -73.88))
    // The fader: 6 dB down, peaks and wire too
    expect(shown.stages.fader.out.l.rms).toBeCloseTo(-16, 6)
    expect(shown.stages.fader.out.l.peak).toBeCloseTo(1.86 - 6, 6)
    expect(shown.wires.get('fader:out')?.l.rms).toBeCloseTo(-16, 6)
    // The compressor: what arrives 6 dB down; what leaves moved by what its curve says, and so its reduction
    expect(shown.stages.comp.in.l.rms).toBeCloseTo(-16, 6)
    expect(shown.stages.comp.out.l.rms).toBeCloseTo(-16.95 + now.stages.comp.out.l.rms - at.stages.comp.out.l.rms, 6)
    expect(shown.stages.comp.gainReductionDb).toBeCloseTo(6.95 + now.stages.comp.gainReductionDb! - at.stages.comp.gainReductionDb!, 6)
  })

  it('silence now: the number engine’s reading (nothing to move on from)', () => {
    const shown = shownFor(chain({ on: false }), rendered())
    expect(shown.stages.sw.out.l.rms).toBe(-Infinity)
    expect(shown.stages.comp.in.l.rms).toBe(-Infinity)
    // Its hiss is still there after the switch: the number engine's reading of it, moved on
    expect(isFinite(shown.stages.comp.out.l.noise)).toBe(true)
  })

  it('a card the render did not have: the number engine’s reading', () => {
    const [nodes, edges] = chain()
    const more: [SignalNode[], SignalEdge[]] = [[...nodes, card('spk', 'active-speaker')], [...edges, wire('comp', 'spk')]]
    expect(shownFor(more, rendered()).stages.spk).toEqual(stillPicture(...more).result.stages.spk)
  })

  it('moved on, the peaks stay between the average and the ceiling', () => {
    // Measured hot (+18 dBu peaks); then the fader goes up 6 dB: not past the clip level
    const shown = shownFor(chain({ faderDb: 6 }), rendered(18))
    expect(shown.stages.fader.out.l.peak).toBe(CLIP_DBU)
    expect(shown.stages.fader.health).toBe('clipping')
  })

  it('graphSignal hands back the same objects for what came out the same', () => {
    const [nodes, edges] = chain()
    const measured = rendered()
    const first  = graphSignal(nodes, edges, measured)
    const second = graphSignal(nodes.slice(), edges.slice(), measured)
    expect(second.stages.mic).toBe(first.stages.mic)
    expect(second.wires.get('comp:out')).toBe(first.wires.get('comp:out'))
  })
})
