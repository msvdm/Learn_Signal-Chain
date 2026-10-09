import { describe, expect, it } from 'bun:test'
import type { EQBand, NodeParamValue, SignalEdge, SignalNode, TypeKey } from '../data/nodeRegistry'
import { initialParams } from '../data/nodeRegistry'
import type { WireKind } from '../graph/queries'
import type { GraphSignalResult, StageResult, StageRole, WireSignal } from './engine'
import { curveInputOf, graphSignal } from './engine'
import type { SideLevels, SignalDomain, SignalHealth } from './levels'
import { CLIP_DBU, headroomOf, hissOf, louder, snrOf, sumNoiseToDb } from './levels'
import type { StageCondition, Transfer } from './process'
import { LINE_NOISE_DBU, compressor, limiter, noiseGate, throughCurve } from './process'

// Reference chains: the level, health, domain and condition at every card. Every wire carries a
// peak and a noise reading too, but the average — the one number before them — stays what it was,
// so old chains keep their levels. Where a design decision (docs/decisions.md) changed a
// reading on purpose, the line says so:
// - D1: a hum follows the signal (a fader turns it down too); before, it only ever grew
// - D4: a card clips as soon as its peaks reach the clip level; before, a hot average stayed "hot"
// - D9: these are the number engine's readings, the instant picture: a dynamics card puts each
//   reading through its curve on its own. The cards show what a render of the chain on real sound
//   measures (audio/measure.ts — checked in the browser: Web Audio does not run in Bun), moved on by
//   the number engine between renders (signal/measured.ts)
// - D18: noise as on a real desk — a Gain's input noise lifted by its gain, every powered card's
//   own after its job (−95 dBu a line stage, −90 a bus, −112 dBFS a converter); before, every card
//   added −80 dBu (a Preamp −128) before its job. The noise columns moved with it
// Peaks, noise and the hum: the tests after the reference chains.

// ── Building a chain ────────────────────────────────────────────────────────────

/** A card with its type's starting params (as dropped at Advanced), `params` on top. */
function card(id: string, typeKey: TypeKey, params: Record<string, NodeParamValue> = {}, bypassed = false): SignalNode {
  return { id, typeKey, position: { x: 0, y: 0 }, params: { ...initialParams(typeKey, 'advanced'), ...params }, bypassed }
}

/**
 * A wire from `card:output` to `card:input` (`out` / `in` when left out). Written as the app holds
 * it once settled (graph/mainFader.ts): a Main Fader on its bus's `mix`, a Matrix send on `send`.
 */
function wire(from: string, to: string): SignalEdge {
  const [source, sourceHandle = 'out'] = from.split(':')
  const [target, targetHandle = 'in'] = to.split(':')
  return { id: `${from} → ${to}`, source, sourceHandle, target, targetHandle }
}

const signalOf = (nodes: SignalNode[], edges: SignalEdge[]) => graphSignal(nodes, edges)

// ── What a card should show ─────────────────────────────────────────────────────

/** One channel (l = r), or [left, right]. −Infinity: silence. */
type Level = number | readonly [number, number]

interface Expected {
  /** What leaves the card: one channel, or both sides of a stereo signal */
  out: Level
  health: SignalHealth
  /** What it works on (checked when given) */
  in?: Level
  /** Leaving: analog unless said */
  domain?: SignalDomain
  /** Arriving: analog unless said */
  inDomain?: SignalDomain
  condition?: StageCondition
  role?: StageRole
  /** How far a dynamics card turns the signal down */
  reduction?: number
  /** The hum leaving it */
  hum?: number
}

/** A side's average (rms): the level the tables lock. Its peaks and noise are checked further down. */
const average = (w: WireSignal, side: 'l' | 'r'): number => w[side].rms

/** dB to two decimals; silence exactly. */
function expectDb(actual: number | undefined, expected: number | undefined) {
  if (expected === undefined) expect(actual).toBeUndefined()
  else if (isFinite(expected)) expect(actual).toBeCloseTo(expected, 2)
  else expect(actual).toBe(expected)
}

function expectSignal(actual: WireSignal, expected: Level) {
  const [l, r] = typeof expected === 'number' ? [expected, expected] : expected
  expect(actual.kind).toBe(typeof expected === 'number' ? 'mono' : 'stereo')
  expectDb(average(actual, 'l'), l)
  expectDb(average(actual, 'r'), r)
}

/** What output `key` (`card:port`) sends: its kind and both sides. */
function expectWire(result: GraphSignalResult, key: string, kind: WireKind, l: number, r: number) {
  const w = result.wires.get(key)
  expect(w?.kind).toBe(kind)
  expectDb(w && average(w, 'l'), l)
  expectDb(w && average(w, 'r'), r)
}

/** One test per card, named after it, and one that every card is in the table. */
function expectCards(result: GraphSignalResult, cards: Record<string, Expected>) {
  it('has every card in the table', () => {
    expect(Object.keys(result.stages).sort()).toEqual(Object.keys(cards).sort())
  })
  for (const [id, want] of Object.entries(cards)) {
    it(id, () => {
      const stage = result.stages[id]
      if (want.in !== undefined) expectSignal(stage.in, want.in)
      expectSignal(stage.out, want.out)
      expect(stage.health).toBe(want.health)
      expect(stage.domain).toBe(want.domain ?? 'analog')
      expect(stage.inDomain).toBe(want.inDomain ?? 'analog')
      expect(stage.condition).toBe(want.condition)
      expect(stage.role).toBe(want.role)
      expectDb(stage.gainReductionDb, want.reduction)
      expectDb(stage.hum, want.hum)
    })
  }
}

const S = -Infinity

// ── Reference chains ────────────────────────────────────────────────────────────

/** An Equalizer with Low +3, Mid −2 at 1 kHz and High +2: +1.24 dB on pink noise. */
const EQ_BANDS: EQBand[] = [
  { freqHz: 200,  gainDb: 3,  Q: 1.4, type: 'low-shelf' },
  { freqHz: 500,  gainDb: 0,  Q: 1.4, type: 'bell' },
  { freqHz: 1000, gainDb: -2, Q: 1.4, type: 'bell' },
  { freqHz: 8000, gainDb: 2,  Q: 1.4, type: 'high-shelf' },
]

/** Mic → Preamp → EQ → Compressor → Fader → Master Bus → two Active Speakers. */
const channelStrip = (bypassed: boolean) => signalOf([
  card('mic', 'mic'),
  card('pre', 'gain', { preampDb: 50 }),
  card('eq', 'eq', { bands: EQ_BANDS }, bypassed),
  card('comp', 'comp', { thresholdDb: -20, ratio: 4, makeupGainDb: 3 }, bypassed),
  card('fader', 'fader', { faderDb: -5 }),
  card('bus', 'master-bus'),
  card('spkL', 'active-speaker'),
  card('spkR', 'active-speaker'),
], [
  wire('mic', 'pre'), wire('pre', 'eq'), wire('eq', 'comp'), wire('comp', 'fader'), wire('fader', 'bus'),
  wire('bus:out-l', 'spkL'), wire('bus:out-r', 'spkR'),
])

describe('a channel strip: mic → preamp → EQ → compressor → fader → Master Bus → speakers', () => {
  expectCards(channelStrip(false), {
    mic:   { out: -60, health: 'too-quiet' },
    pre:   { in: -60, out: -10, health: 'good', role: 'preamp' },
    eq:    { in: -10, out: -8.76, health: 'good' },
    // D9: (−8.76 − −20) × (1 − 1/4) = 8.43 dB down, then +3 dB makeup
    comp:  { in: -8.76, out: -14.19, health: 'good', reduction: 8.43 },
    fader: { in: -14.19, out: -19.19, health: 'good' },
    // A mono wire lands on both sides at full level
    bus:   { in: [-19.19, -19.19], out: [-19.19, -19.19], health: 'good' },
    spkL:  { in: -19.19, out: -19.19, health: 'good' },
    spkR:  { in: -19.19, out: -19.19, health: 'good' },
  })
})

describe('the same strip with the EQ and the compressor bypassed', () => {
  expectCards(channelStrip(true), {
    mic:   { out: -60, health: 'too-quiet' },
    pre:   { in: -60, out: -10, health: 'good', role: 'preamp' },
    eq:    { in: -10, out: -10, health: 'good' },
    comp:  { in: -10, out: -10, health: 'good' },
    fader: { in: -10, out: -15, health: 'good' },
    bus:   { in: [-15, -15], out: [-15, -15], health: 'good' },
    spkL:  { in: -15, out: -15, health: 'good' },
    spkR:  { in: -15, out: -15, health: 'good' },
  })
})

describe('a stereo Master Bus: Pan, Balance and the Main Fader', () => {
  const result = signalOf([
    card('vox', 'mic'),
    card('pre', 'gain'),
    card('voxPan', 'pan'),
    card('gtr', 'line-in'),
    card('gtrPan', 'pan', { panPosition: 0 }),
    card('keys', 'line-in', { stereo: true }),
    card('keysBal', 'pan', { panPosition: 75 }),
    card('bus', 'master-bus'),
    card('main', 'fader', { faderDb: -3 }),
    card('spkL', 'active-speaker'),
    card('spkR', 'active-speaker'),
  ], [
    wire('vox', 'pre'), wire('pre', 'voxPan'), wire('voxPan', 'bus'),
    wire('gtr', 'gtrPan'), wire('gtrPan', 'bus'),
    wire('keys', 'keysBal'), wire('keysBal', 'bus'),
    wire('bus:mix', 'main'), wire('main:out-l', 'spkL'), wire('main:out-r', 'spkR'),
  ])

  expectCards(result, {
    vox:     { out: -60, health: 'too-quiet' },
    pre:     { in: -60, out: -20, health: 'good', role: 'preamp' },
    // Pan in the centre: −3 dB on each side (equal power)
    voxPan:  { in: -20, out: [-23.01, -23.01], health: 'good' },
    gtr:     { out: -10, health: 'good' },
    // Pan fully left: all of it on the left, nothing on the right
    gtrPan:  { in: -10, out: [-10, S], health: 'good' },
    keys:    { out: [-10, -10], health: 'good' },
    // A stereo wire turns the Pan into Balance: three quarters right halves the left (−6 dB)
    keysBal: { in: [-10, -10], out: [-16.02, -10], health: 'good', role: 'balance' },
    // Left: −23.01, −10 and −16.02 added · Right: −23.01 and −10
    bus:     { in: [-5.27, -8.25], out: [-5.27, -8.25], health: 'good' },
    main:    { in: [-5.27, -8.25], out: [-8.27, -11.25], health: 'good', role: 'main-fader' },
    spkL:    { in: -8.27, out: -8.27, health: 'good' },
    spkR:    { in: -11.25, out: -11.25, health: 'good' },
  })

  it('sends the mix to the Main Fader on one stereo wire, and one side to each speaker', () => {
    expectWire(result, 'bus:mix', 'stereo', -5.27, -8.25)
    expectWire(result, 'main:out-l', 'left', -8.27, S)
    expectWire(result, 'main:out-r', 'right', S, -11.25)
  })
})

describe('on a stereo bus a mono wire lands on both sides, a side wire keeps its side', () => {
  const result = signalOf([
    card('line', 'line-in', { levelDb: -20 }),
    card('aux', 'aux-bus', { stereo: true }),
    card('comp', 'comp'),
    card('line2', 'line-in'),
    card('bus', 'master-bus'),
    card('spkL', 'active-speaker'),
    card('spkR', 'active-speaker'),
  ], [
    wire('line', 'aux'), wire('aux:out-l', 'comp'), wire('comp', 'bus'),
    wire('line2', 'bus'),
    wire('bus:out-l', 'spkL'), wire('bus:out-r', 'spkR'),
  ])

  expectCards(result, {
    line:  { out: -20, health: 'good' },
    aux:   { in: [-20, -20], out: [-20, -20], health: 'good' },
    // The Aux's L through a compressor (D9: on average just below its threshold): still the left side only
    comp:  { in: -20, out: -20, health: 'good', reduction: 0 },
    line2: { out: -10, health: 'good' },
    // Left: −10 and −20 added · Right: only the mono −10
    bus:   { in: [-7.61, -10], out: [-7.61, -10], health: 'good' },
    spkL:  { in: -7.61, out: -7.61, health: 'good' },
    spkR:  { in: -10, out: -10, health: 'good' },
  })

  it('carries one side through the compressor', () => {
    expectWire(result, 'aux:out-l', 'left', -20, S)
    expectWire(result, 'comp:out', 'left', -20, S)
  })
})

describe('a Generator set to Stereo sends the same sound on both sides of one wire', () => {
  const result = signalOf([
    card('gen', 'generator', { stereo: true, levelDb: -6 }),
    card('bal', 'pan', { panPosition: 0 }),
  ], [wire('gen', 'bal')])

  expectCards(result, {
    gen: { out: [-6, -6], health: 'good' },
    // Balance fully left: the right side fades out
    bal: { in: [-6, -6], out: [-6, S], health: 'good', role: 'balance' },
  })

  it('is one stereo wire', () => {
    expectWire(result, 'gen:out', 'stereo', -6, -6)
  })
})

/**
 * A guitar through a DI Box: its Direct Out to a Guitar Amp with a mic in front of it, its XLR Out
 * to a Preamp, a fader and a speaker.
 */
const guitarRig = (groundLift: boolean) => signalOf([
  card('gtr', 'instrument'),
  card('di', 'di-box', { groundLift }),
  card('amp', 'guitar-amp'),
  card('mic', 'mic'),
  card('micPre', 'gain'),
  card('pre', 'gain'),
  card('fader', 'fader', { faderDb: -10 }),
  card('spk', 'active-speaker'),
], [
  wire('gtr', 'di'),
  wire('di:direct', 'amp'), wire('amp:sound', 'mic'), wire('mic', 'micPre'),
  wire('di', 'pre'), wire('pre', 'fader'), wire('fader', 'spk'),
])

describe('a DI Box in a ground loop (Ground Lift off): the hum', () => {
  const result = guitarRig(false)

  expectCards(result, {
    gtr:    { out: -30, health: 'good' },
    // XLR Out: down to mic level (−20 dB). The loop starts a hum there.
    di:     { in: -30, out: -50, health: 'too-quiet', hum: -80 },
    // Changed on purpose (2026-10-06): the Guitar Amp goes to 11; at its default 5 it plays the
    // guitar 20 dB up (106 dB SPL), and the mic in front of it picks it up at −40, not −60
    amp:    { in: -30, out: -10, health: 'good' },
    mic:    { out: -40, health: 'good' },
    micPre: { in: -40, out: 0, health: 'good', role: 'preamp' },
    // The Preamp lifts the hum with the guitar: +40 dB
    pre:    { in: -50, out: -10, health: 'good', role: 'preamp', hum: -40 },
    // D1: the fader turns the hum down with the guitar, 10 dB (it was −40: a hum never went down)
    fader:  { in: -10, out: -20, health: 'good', hum: -50 },
    // D1: the hum the fader left (it was −40)
    spk:    { in: -20, out: -20, health: 'good', hum: -50 },
  })

  it('sends the instrument on unchanged from the Direct Out, without the hum', () => {
    expectWire(result, 'di:out', 'mono', -50, -50)
    expectWire(result, 'di:direct', 'mono', -30, -30)
    expect(result.hums.get('di:out')).toBe(-80)
    expect(result.hums.get('di:direct')).toBeUndefined()
    expect(result.hums.get('pre:out')).toBe(-40)
  })
})

describe('the same rig with Ground Lift on: no hum', () => {
  const result = guitarRig(true)

  expectCards(result, {
    gtr:    { out: -30, health: 'good' },
    di:     { in: -30, out: -50, health: 'too-quiet' },
    // The Guitar Amp at 5, 20 dB up: the mic at −40 (see above)
    amp:    { in: -30, out: -10, health: 'good' },
    mic:    { out: -40, health: 'good' },
    micPre: { in: -40, out: 0, health: 'good', role: 'preamp' },
    pre:    { in: -50, out: -10, health: 'good', role: 'preamp' },
    fader:  { in: -10, out: -20, health: 'good' },
    spk:    { in: -20, out: -20, health: 'good' },
  })

  it('has no hum on any wire', () => {
    expect(result.hums.size).toBe(0)
  })
})

describe('a hum through an ADC moves to the digital scale', () => {
  expectCards(signalOf([
    card('gtr', 'instrument'),
    card('di', 'di-box'),
    card('amp', 'guitar-amp'),
    card('pre', 'gain'),
    card('adc', 'adc'),
  ], [
    wire('gtr', 'di'), wire('di:direct', 'amp'), wire('di', 'pre'), wire('pre', 'adc'),
  ]), {
    gtr: { out: -30, health: 'good' },
    di:  { in: -30, out: -50, health: 'too-quiet', hum: -80 },
    // The Guitar Amp at 5 plays the guitar 20 dB up (it goes to 11)
    amp: { in: -30, out: -10, health: 'good' },
    pre: { in: -50, out: -10, health: 'good', role: 'preamp', hum: -40 },
    adc: { in: -10, out: -28, health: 'good', domain: 'digital', hum: -58 },
  })
})

describe('a guitar into a desk input without a DI Box', () => {
  expectCards(signalOf([
    card('gtr', 'instrument'),
    card('gain', 'gain'),
    card('gtr2', 'instrument'),
    card('di', 'di-box', {}, true),
    card('gain2', 'gain'),
    card('spk', 'active-speaker'),
  ], [
    wire('gtr', 'gain'),
    // A bypassed DI Box passes the guitar on as it is, on both outputs
    wire('gtr2', 'di'), wire('di', 'gain2'), wire('gain2', 'spk'),
  ]), {
    // The level is fine; the guitar loses its high notes
    gtr:   { out: -30, health: 'good', condition: 'needsDi' },
    // Not a Preamp (no microphone before it): a plain gain at 0 dB
    gain:  { in: -30, out: -30, health: 'good' },
    gtr2:  { out: -30, health: 'good', condition: 'needsDi' },
    di:    { in: -30, out: -30, health: 'good' },
    gain2: { in: -30, out: -30, health: 'good' },
    spk:   { in: -30, out: -30, health: 'good' },
  })
})

describe('ADC / DAC: dBu to dBFS and back (0 dBu = −18 dBFS)', () => {
  expectCards(signalOf([
    card('mic', 'mic'),
    card('pre', 'gain'),
    card('adc', 'adc'),
    card('fader', 'fader', { faderDb: 6 }),
    card('dac', 'dac'),
    card('spk', 'active-speaker'),
  ], [
    wire('mic', 'pre'), wire('pre', 'adc'), wire('adc', 'fader'), wire('fader', 'dac'), wire('dac', 'spk'),
  ]), {
    mic:   { out: -60, health: 'too-quiet' },
    pre:   { in: -60, out: -20, health: 'good', role: 'preamp' },
    adc:   { in: -20, out: -38, health: 'good', domain: 'digital' },
    fader: { in: -38, out: -32, health: 'good', domain: 'digital', inDomain: 'digital' },
    dac:   { in: -32, out: -14, health: 'good', inDomain: 'digital' },
    spk:   { in: -14, out: -14, health: 'good' },
  })
})

describe('digital levels near the ceiling (0 dBFS)', () => {
  expectCards(signalOf([
    card('a', 'line-in', { levelDb: 0 }),
    card('gainA', 'gain', { gainDb: 15 }),
    card('adcA', 'adc'),
    card('b', 'line-in', { levelDb: 0 }),
    card('gainB', 'gain', { gainDb: 20 }),
    card('adcB', 'adc'),
  ], [
    wire('a', 'gainA'), wire('gainA', 'adcA'),
    wire('b', 'gainB'), wire('gainB', 'adcB'),
  ]), {
    a:     { out: 0, health: 'good' },
    // D4: the average is hot, but a line's peaks (12 dB above it) reach the clip level (it was 'hot')
    gainA: { in: 0, out: 15, health: 'clipping' },
    // D4: likewise, its peaks reach 0 dBFS (it was 'hot')
    adcA:  { in: 15, out: -3, health: 'clipping', domain: 'digital' },
    b:     { out: 0, health: 'good' },
    // +20 dBu: the clip level
    gainB: { in: 0, out: 20, health: 'clipping' },
    adcB:  { in: 20, out: 2, health: 'clipping', domain: 'digital' },
  })
})

describe('analog and digital in the wrong place', () => {
  expectCards(signalOf([
    card('line', 'line-in'),
    card('adc', 'adc'),
    card('adc2', 'adc'),
    card('dac', 'dac'),
    card('spk', 'active-speaker'),
    card('amp', 'amp'),
    card('aux', 'aux-bus'),
  ], [
    wire('line', 'adc'),
    wire('adc', 'adc2'), wire('line', 'dac'), wire('adc', 'spk'), wire('adc', 'amp'),
    wire('line', 'aux'), wire('adc', 'aux'),
  ]), {
    line: { out: -10, health: 'good' },
    adc:  { in: -10, out: -28, health: 'good', domain: 'digital' },
    adc2: { in: -28, out: S, health: 'too-quiet', domain: 'digital', inDomain: 'digital', condition: 'adcExpectsAnalog' },
    dac:  { in: -10, out: S, health: 'too-quiet', condition: 'dacExpectsDigital' },
    spk:  { in: -28, out: S, health: 'too-quiet', domain: 'digital', inDomain: 'digital', condition: 'digitalToSpeaker' },
    amp:  { in: -28, out: S, health: 'too-quiet', domain: 'digital', inDomain: 'digital', condition: 'digitalToAmp' },
    // −10 dBu and −28 dBFS arrive: a bus cannot add them up
    aux:  { in: -8.97, out: S, health: 'too-quiet', condition: 'domainMixedBus' },
  })
})

describe('a noise gate: closed below its threshold (−40), open from it up', () => {
  expectCards(signalOf([
    card('mic', 'mic'),
    card('gate', 'noise-gate'),
    card('mic2', 'mic'),
    card('pre2', 'gain', { preampDb: 5 }),
    card('gate2', 'noise-gate', { rangeDb: -20 }),
    card('mic3', 'mic'),
    card('pre3', 'gain', { preampDb: 20 }),
    card('gate3', 'noise-gate'),
    card('mic4', 'mic'),
    card('pre4', 'gain'),
    card('gate4', 'noise-gate'),
  ], [
    wire('mic', 'gate'),
    wire('mic2', 'pre2'), wire('pre2', 'gate2'),
    wire('mic3', 'pre3'), wire('pre3', 'gate3'),
    wire('mic4', 'pre4'), wire('pre4', 'gate4'),
  ]), {
    mic:   { out: -60, health: 'too-quiet' },
    // Closed: turned down by its Range (−80 dB, about silence)
    gate:  { in: -60, out: -140, health: 'too-quiet', reduction: 80 },
    mic2:  { out: -60, health: 'too-quiet' },
    pre2:  { in: -60, out: -55, health: 'too-quiet', role: 'preamp' },
    // Closed, with a Range of −20 dB
    gate2: { in: -55, out: -75, health: 'too-quiet', reduction: 20 },
    mic3:  { out: -60, health: 'too-quiet' },
    pre3:  { in: -60, out: -40, health: 'good', role: 'preamp' },
    // D9: right at the threshold: open
    gate3: { in: -40, out: -40, health: 'good', reduction: 0 },
    mic4:  { out: -60, health: 'too-quiet' },
    pre4:  { in: -60, out: -20, health: 'good', role: 'preamp' },
    gate4: { in: -20, out: -20, health: 'good', reduction: 0 },
  })
})

describe('a limiter: nothing above its ceiling (−3), then the makeup gain', () => {
  expectCards(signalOf([
    card('line', 'line-in', { levelDb: 0 }),
    card('gain', 'gain', { gainDb: 10 }),
    card('lim', 'limiter'),
    card('line2', 'line-in'),
    card('lim2', 'limiter', { makeupGainDb: 2 }),
  ], [
    wire('line', 'gain'), wire('gain', 'lim'),
    wire('line2', 'lim2'),
  ]), {
    line:  { out: 0, health: 'good' },
    // D4: a line's peaks (12 dB above +10 dBu) reach the clip level (it was 'hot')
    gain:  { in: 0, out: 10, health: 'clipping' },
    // D9: the average capped at the ceiling
    lim:   { in: 10, out: -3, health: 'good', reduction: 13 },
    line2: { out: -10, health: 'good' },
    // D9: under the ceiling on average: untouched, then +2 dB
    lim2:  { in: -10, out: -8, health: 'good', reduction: 0 },
  })
})

describe('dynamics in stereo are linked: the louder side sets the change for both', () => {
  expectCards(signalOf([
    card('keys', 'line-in', { stereo: true, levelDb: 0 }),
    card('bal', 'pan', { panPosition: 25 }),
    card('comp', 'comp'),
  ], [
    wire('keys', 'bal'), wire('bal', 'comp'),
  ]), {
    keys: { out: [0, 0], health: 'good' },
    bal:  { in: [0, 0], out: [0, -6.02], health: 'good', role: 'balance' },
    // The left (0 dBu) is 20 dB over the threshold: 10 dB down at 2:1, on both sides (D9)
    comp: { in: [0, -6.02], out: [-10, -16.02], health: 'good', reduction: 10 },
  })
})

describe('wires added up on a bus: two equal signals give +6 dB', () => {
  expectCards(signalOf([
    card('a', 'line-in'),
    card('b', 'line-in'),
    card('aux', 'aux-bus'),
    card('c', 'line-in'),
    card('d', 'line-in'),
    card('off', 'switch', { on: false }),
    card('bus', 'master-bus'),
  ], [
    wire('a', 'aux'), wire('b', 'aux'),
    // A silent wire adds nothing
    wire('a', 'bus'), wire('c', 'bus'), wire('d', 'off'), wire('off', 'bus'),
  ]), {
    a:   { out: -10, health: 'good' },
    b:   { out: -10, health: 'good' },
    aux: { in: -3.98, out: -3.98, health: 'good' },
    c:   { out: -10, health: 'good' },
    d:   { out: -10, health: 'good' },
    off: { in: -10, out: S, health: 'too-quiet' },
    bus: { in: [-3.98, -3.98], out: [-3.98, -3.98], health: 'good' },
  })
})

describe('the Matrix Bus: finished mixes, each through its send knob', () => {
  const result = signalOf([
    card('line', 'line-in'),
    card('bus', 'master-bus'),
    card('main', 'fader', { faderDb: -5 }),
    card('spkL', 'active-speaker'),
    card('spkR', 'active-speaker'),
    card('line2', 'line-in', { levelDb: -20 }),
    card('aux', 'aux-bus'),
    // The Master's send is left at unity; the Aux's is at half way (−10.57 dB)
    card('mtx', 'matrix-bus', { 'send-aux': 50 }),
    card('mtxL', 'active-speaker'),
    card('mtxR', 'active-speaker'),
  ], [
    wire('line', 'bus'), wire('bus:mix', 'main'), wire('main:out-l', 'spkL'), wire('main:out-r', 'spkR'),
    wire('line2', 'aux'),
    wire('main:send', 'mtx'), wire('aux', 'mtx'),
    wire('mtx:out-l', 'mtxL'), wire('mtx:out-r', 'mtxR'),
  ])

  expectCards(result, {
    line:  { out: -10, health: 'good' },
    bus:   { in: [-10, -10], out: [-10, -10], health: 'good' },
    main:  { in: [-10, -10], out: [-15, -15], health: 'good', role: 'main-fader' },
    spkL:  { in: -15, out: -15, health: 'good' },
    spkR:  { in: -15, out: -15, health: 'good' },
    line2: { out: -20, health: 'good' },
    aux:   { in: -20, out: -20, health: 'good' },
    // −15 (the Master, after its fader) and −30.57 (the mono Aux, on both sides) added
    mtx:   { in: [-13.66, -13.66], out: [-13.66, -13.66], health: 'good' },
    mtxL:  { in: -13.66, out: -13.66, health: 'good' },
    mtxR:  { in: -13.66, out: -13.66, health: 'good' },
  })

  it('takes the Master after its fader, on one stereo wire', () => {
    expectWire(result, 'main:send', 'stereo', -15, -15)
  })
})

describe('an aux send: a Relay Switch takes its copy before (A) or after (B) the fader', () => {
  const send = (selectedInput: 'a' | 'b') => signalOf([
    card('mic', 'mic'),
    card('pre', 'gain'),
    card('fader', 'fader', { faderDb: -10 }),
    card('prePost', 'relay', { selectedInput }),
    card('sendLevel', 'gain', { gainDb: -6 }),
    card('aux', 'aux-bus'),
  ], [
    wire('mic', 'pre'), wire('pre', 'fader'),
    wire('pre', 'prePost:in-a'), wire('fader', 'prePost:in-b'),
    wire('prePost', 'sendLevel'), wire('sendLevel', 'aux'),
  ])
  const channel = {
    mic:   { out: -60, health: 'too-quiet' },
    pre:   { in: -60, out: -20, health: 'good', role: 'preamp' },
    fader: { in: -20, out: -30, health: 'good' },
  } satisfies Record<string, Expected>

  describe('PRE: before the fader', () => {
    expectCards(send('a'), {
      ...channel,
      prePost:   { in: -20, out: -20, health: 'good' },
      // After the switch, not a Preamp: a plain gain
      sendLevel: { in: -20, out: -26, health: 'good' },
      aux:       { in: -26, out: -26, health: 'good' },
    })
  })

  describe('POST: after the fader', () => {
    expectCards(send('b'), {
      ...channel,
      prePost:   { in: -30, out: -30, health: 'good' },
      sendLevel: { in: -30, out: -36, health: 'good' },
      aux:       { in: -36, out: -36, health: 'good' },
    })
  })
})

describe('speakers: a passive one needs an amplifier, an active one (or headphones) is blown by it', () => {
  expectCards(signalOf([
    card('line', 'line-in'),
    card('passive', 'speaker'),
    card('amp', 'amp', { gainDb: -6 }),
    card('passive2', 'speaker'),
    card('active', 'active-speaker'),
    card('phones', 'headphones', { volumeDb: -6 }),
    card('phones2', 'headphones'),
  ], [
    wire('line', 'passive'), wire('line', 'phones'),
    wire('line', 'amp'), wire('amp', 'passive2'), wire('amp', 'active'), wire('amp', 'phones2'),
  ]), {
    line:     { out: -10, health: 'good' },
    passive:  { in: -10, out: S, health: 'too-quiet', condition: 'needsAmp' },
    amp:      { in: -10, out: -16, health: 'good' },
    passive2: { in: -16, out: -16, health: 'good' },
    // Speaker level, 40 dB over the line level it expects
    active:   { in: -16, out: 24, health: 'clipping', condition: 'blown' },
    // Headphones work as an Active Speaker: their Volume, and blown by an amplifier
    phones:   { in: -10, out: -16, health: 'good' },
    phones2:  { in: -16, out: 24, health: 'clipping', condition: 'blown' },
  })
})

describe('a clip before a speaker is heard there, however green its meter (distorted)', () => {
  // A Gain 20 dB too hot clips the music's peaks; the Fader after it brings the level back down
  const chain = (on: boolean) => signalOf([
    card('line', 'line-in'),
    card('hot', 'gain', { gainDb: 20 }),
    card('fader', 'fader', { faderDb: -20 }),
    card('sw', 'switch', { on }),
    card('spk', 'active-speaker'),
    card('clean', 'line-in'),
    card('bus', 'master-bus'),
    card('phones', 'headphones'),
  ], [
    wire('line', 'hot'), wire('hot', 'fader'), wire('fader', 'sw'), wire('sw', 'spk'),
    wire('fader', 'bus'), wire('clean', 'bus'), wire('bus:out-l', 'phones'),
  ])
  const result = chain(true)
  const distorted = (id: string, r = result) => r.stages[id].distorted ?? false

  it('marks the card that clips and everything after it, the speaker green', () => {
    expect(result.stages.hot.health).toBe('clipping')
    expect(result.stages.spk.health).toBe('good')
    expect(['hot', 'fader', 'sw', 'spk'].map((id) => distorted(id))).toEqual([true, true, true, true])
  })

  it('a bus with one clipped channel in it is distorted too, and what it feeds', () => {
    expect(distorted('bus')).toBe(true)
    expect(distorted('phones')).toBe(true)
  })

  it('leaves clean cards alone: before the clip, another source', () => {
    expect(distorted('line')).toBe(false)
    expect(distorted('clean')).toBe(false)
  })

  it('a Switch turned off sends nothing: nothing distorted after it', () => {
    const off = chain(false)
    expect(distorted('sw', off)).toBe(false)
    expect(distorted('spk', off)).toBe(false)
  })
})

// ── Peaks, noise and the hum ────────────────────────────────────────────────────

/** What leaves a card: its peak, average and noise (the louder side). */
const leaving = (result: GraphSignalResult, id: string): SideLevels =>
  louder(result.stages[id].out.l, result.stages[id].out.r)

/** Each card's [peak, average, noise] leaving it, one test per card. */
function expectReadings(result: GraphSignalResult, cards: Record<string, readonly [peak: number, rms: number, noise: number]>) {
  for (const [id, [peak, rms, noise]] of Object.entries(cards)) {
    it(`${id}: peaks ${peak}, average ${rms}, noise ${noise}`, () => {
      const s = leaving(result, id)
      expectDb(s.peak, peak)
      expectDb(s.rms, rms)
      expectDb(s.noise, noise)
    })
  }
}

/**
 * Mic → Preamp → EQ → Gain → Fader → Master Bus → speaker, ending at −10 dBu either way: the gain
 * made early, or the classic mistake — the Preamp 30 dB too low, made up later with a gain and the
 * fader. A voice: peaks 12 dB above its average, the room's noise 66 dB under it.
 */
const gainStaging = (preampDb: number, gainDb: number, faderDb: number) => signalOf([
  card('mic', 'mic'),
  card('pre', 'gain', { preampDb }),
  card('eq', 'eq'),
  card('gain', 'gain', { gainDb }),
  card('fader', 'fader', { faderDb }),
  card('bus', 'master-bus'),
  card('spk', 'active-speaker'),
], [
  wire('mic', 'pre'), wire('pre', 'eq'), wire('eq', 'gain'), wire('gain', 'fader'), wire('fader', 'bus'),
  wire('bus:out-l', 'spk'),
])

describe('gain staging, well set: the Preamp makes the gain (+50 dB)', () => {
  const result = gainStaging(50, 0, 0)

  expectReadings(result, {
    mic:   [-48, -60, -126],
    // D18: its input noise (EIN, −128 dBu) joins before its gain, its floor (−100) after: the
    // room the microphone hears rules, 64 dB under the voice
    pre:   [2, -10, -73.86],
    // Every other card adds its own after its job — a line stage −95 dBu, the bus −90, the
    // speaker's amp −85: next to a voice at −10, hardly anything
    eq:    [2, -10, -73.83],
    gain:  [2, -10, -73.82],
    fader: [2, -10, -73.79],
    bus:   [2, -10, -73.68],
    spk:   [2, -10, -73.37],
  })

  // D18: 63 dB (with every card at −80 dBu it was 60)
  it('ends about 63 dB above its noise, its peaks 18 dB under the clip level', () => {
    expectDb(snrOf(leaving(result, 'spk')), 63.37)
    expectDb(headroomOf(leaving(result, 'spk')), 18)
  })
})

describe('gain staging, the classic mistake: Preamp +20, made up later (Gain +20, Fader +10)', () => {
  const result = gainStaging(20, 20, 10)

  expectReadings(result, {
    mic:   [-48, -60, -126],
    pre:   [-28, -40, -98.51],
    // D18: the Preamp's floor (−100) and the EQ's (−95) land on a voice 30 dB too weak: only
    // 53 dB under it
    eq:    [-28, -40, -93.4],
    // Making it up later lifts that noise with the voice: the gap stays
    gain:  [-8, -20, -73.24],
    fader: [2, -10, -63.24],
    bus:   [2, -10, -63.23],
    spk:   [2, -10, -63.2],
  })

  // D18: about 10 dB lost (with every card at −80 dBu: 23)
  it('ends at the same level with the same peaks, but about 10 dB more noise', () => {
    const good = leaving(gainStaging(50, 0, 0), 'spk')
    const bad  = leaving(result, 'spk')
    expectDb(bad.rms, good.rms)
    expectDb(bad.peak, good.peak)
    expectDb(snrOf(bad), 53.2)
    expect(snrOf(good) - snrOf(bad)).toBeGreaterThan(10)
  })
})

describe('where the gain is made, on a real desk (D18)', () => {
  // One after another (a Master Bus through its L)
  const chain = (...cards: SignalNode[]) =>
    signalOf(cards, cards.slice(1).map((c, i) => wire(cards[i].typeKey === 'master-bus' ? `${cards[i].id}:out-l` : cards[i].id, c.id)))
  const speakerSnr = (result: GraphSignalResult, id = 'spk') => snrOf(leaving(result, id))

  it('before the converter: a Preamp 30 dB low costs more made up digitally (the ADC\'s own noise lifted) than before it', () => {
    const wellSet  = chain(card('mic', 'mic'), card('pre', 'gain', { preampDb: 50 }), card('adc', 'adc'), card('dac', 'dac'), card('spk', 'active-speaker'))
    const upBefore = chain(card('mic', 'mic'), card('pre', 'gain', { preampDb: 20 }), card('trim', 'gain', { gainDb: 30 }), card('adc', 'adc'), card('dac', 'dac'), card('spk', 'active-speaker'))
    const upAfter  = chain(card('mic', 'mic'), card('pre', 'gain', { preampDb: 20 }), card('adc', 'adc'), card('trim', 'gain', { gainDb: 30 }), card('dac', 'dac'), card('spk', 'active-speaker'))
    expectDb(speakerSnr(wellSet), 63.465)
    expectDb(speakerSnr(upBefore), 57.935)
    expectDb(speakerSnr(upAfter), 52.655)
  })

  it('at the amplifier: the desk turned down into an amp wide open is noisier than the desk well set into an amp turned down', () => {
    // The amp's own noise comes after its Volume: it decides most of it (−85 dBu, 25 dB SPL)
    const ampOpen = chain(card('line', 'line-in'), card('bus', 'master-bus', { faderDb: -20 }), card('amp', 'amp', { gainDb: 0 }), card('spk', 'speaker'))
    const ampDown = chain(card('line', 'line-in'), card('bus', 'master-bus', { faderDb: 0 }), card('amp', 'amp', { gainDb: -20 }), card('spk', 'speaker'))
    expectDb(leaving(ampOpen, 'spk').rms, leaving(ampDown, 'spk').rms)
    expectDb(speakerSnr(ampOpen), 53.796)
    expectDb(speakerSnr(ampDown), 54.973)
  })
})

describe('peaks: the loudest moments, above the average', () => {
  expectReadings(signalOf([
    card('line', 'line-in'),
    card('comp', 'comp', { thresholdDb: -20, ratio: 4 }),
    card('lim', 'limiter'),
    card('loud', 'line-in', { levelDb: 0 }),
    card('gain', 'gain', { gainDb: 15 }),
    card('fader', 'fader', { faderDb: -20 }),
  ], [
    wire('line', 'comp'), wire('line', 'lim'),
    wire('loud', 'gain'), wire('gain', 'fader'),
  ]), {
    // Keys: peaks 12 dB above the average
    line:  [2, -10, -90],
    // D9: 4:1 from −20: the average comes down 7.5 dB, the peaks 16.5 — the gap shrinks from 12 dB to 3
    comp:  [-14.5, -17.5, -88.81],
    // D9: a limiter at −3: the average passes untouched, the peaks are capped
    lim:   [-3, -10, -88.81],
    loud:  [12, 0, -80],
    // +15 dB: the peaks would reach +27, an analog stage flattens them at the clip level (+20)
    gain:  [20, 15, -64.99],
    // Turned down 20 dB, the gap stays 5 dB: flattened peaks do not come back
    fader: [0, -5, -84.58],
  })
})

describe('the same average, another sound: the peaks decide when it clips (D4)', () => {
  const result = signalOf([
    card('sine', 'generator', { sound: 'sine', levelDb: 10 }),
    card('sineFader', 'fader'),
    card('click', 'generator', { sound: 'click', levelDb: 10 }),
    card('clickFader', 'fader', { faderDb: -20 }),
    // Professional line level (+4 dBu): keys, and a drum machine
    card('keys', 'line-in', { levelDb: 4 }),
    card('drums', 'line-in', { levelDb: 4, character: 'drums' }),
  ], [
    wire('sine', 'sineFader'), wire('click', 'clickFader'),
  ])

  expectCards(result, {
    // A sine's peaks are 3 dB above its average: +13 dBu, hot but clean
    sine:       { out: 10, health: 'hot' },
    sineFader:  { in: 10, out: 10, health: 'hot' },
    // Clicks at the same average would peak at +28: clipping
    click:      { out: 10, health: 'clipping' },
    // Turned down after the clip it is healthy again — but the flattened peaks stay flattened
    clickFader: { in: 10, out: -10, health: 'good' },
    keys:       { out: 4, health: 'hot' },
    drums:      { out: 4, health: 'clipping' },
  })

  expectReadings(result, {
    sine:       [13, 10, -80],
    sineFader:  [13, 10, -79.86],
    click:      [20, 10, -80],
    // 10 dB between the peaks and the average, where the clicks had 18
    clickFader: [0, -10, -93.81],
    keys:       [16, 4, -76],
    drums:      [20, 4, -76],
  })
})

describe('noise: what is left when the music stops', () => {
  describe('a noise gate with its threshold between the noise and the signal', () => {
    const result = signalOf([
      card('mic', 'mic'),
      card('pre', 'gain', { preampDb: 50 }),
      // Threshold −40 (its default): under the voice (−10), over the noise (−74)
      card('gate', 'noise-gate'),
      card('gate20', 'noise-gate', { rangeDb: -20 }),
      // Threshold under the noise: open all the time
      card('open', 'noise-gate', { thresholdDb: -100 }),
    ], [
      wire('mic', 'pre'), wire('pre', 'gate'), wire('pre', 'gate20'), wire('pre', 'open'),
    ])

    expectReadings(result, {
      pre:    [2, -10, -73.86],
      // Open, the noise passes, with the gate's own (−95 dBu, after it — D18)
      open:   [2, -10, -73.83],
      gate:   [2, -10, -95],
      gate20: [2, -10, -91.39],
    })

    it('drops the noise that arrives by its Range, leaves the music alone — and its own floor after it (D18)', () => {
      // −80: far under its own floor, which is all that is left
      expectDb(leaving(result, 'gate').noise, LINE_NOISE_DBU)
      expectDb(leaving(result, 'gate20').noise, sumNoiseToDb([leaving(result, 'pre').noise - 20, LINE_NOISE_DBU]))
      expectDb(result.stages.gate.gainReductionDb, 0)
    })
  })

  it('a compressor costs as much as it turns the average down: the noise stays under its threshold', () => {
    const result = signalOf([
      card('line', 'line-in'),
      card('comp', 'comp', { thresholdDb: -20, ratio: 4 }),
      card('comp6', 'comp', { thresholdDb: -20, ratio: 4, makeupGainDb: 6 }),
    ], [wire('line', 'comp'), wire('line', 'comp6')])
    // The line (80 dB), 7.5 dB of gain reduction (D9), then the compressor's own noise (−95, D18)
    expectDb(snrOf(leaving(result, 'comp')), 71.31)
    expectDb(result.stages.comp.gainReductionDb, 7.5)
    // The makeup gain lifts the noise that arrived with the music; its own floor comes after it
    expectDb(leaving(result, 'comp6').noise - leaving(result, 'comp').noise, 5.14)
    expectDb(leaving(result, 'comp6').rms - leaving(result, 'comp').rms, 6)
  })

  it('a bus adds the music as voltages (+6 dB per doubling) and the noise as noise (+3 dB)', () => {
    // Digital, so the buses add no noise of their own and the sums show alone
    const result = signalOf([
      card('a', 'line-in'), card('adcA', 'adc'),
      card('b', 'line-in'), card('adcB', 'adc'),
      card('c', 'line-in'), card('adcC', 'adc'),
      card('d', 'line-in'), card('adcD', 'adc'),
      card('one', 'aux-bus'), card('two', 'aux-bus'), card('four', 'aux-bus'),
    ], [
      wire('a', 'adcA'), wire('b', 'adcB'), wire('c', 'adcC'), wire('d', 'adcD'),
      wire('adcA', 'one'),
      wire('adcA', 'two'), wire('adcB', 'two'),
      wire('adcA', 'four'), wire('adcB', 'four'), wire('adcC', 'four'), wire('adcD', 'four'),
    ])
    const one  = leaving(result, 'one')
    const two  = leaving(result, 'two')
    const four = leaving(result, 'four')
    // The line's noise (−108 dBFS) and the ADC's own (−112 dBFS — D18)
    expectDb(one.noise, -106.54)
    expectDb(two.noise - one.noise, 3.01)
    expectDb(four.noise - two.noise, 3.01)
    expectDb(two.rms - one.rms, 6.02)
    expectDb(four.rms - two.rms, 6.02)
  })

  it('an analog bus adds its own noise on top of what it sums', () => {
    const result = signalOf([
      card('a', 'line-in'), card('b', 'line-in'), card('aux', 'aux-bus'),
    ], [wire('a', 'aux'), wire('b', 'aux')])
    // Two line noises at −90 (−86.99 together) and the bus's own −90 (D18)
    expectDb(leaving(result, 'aux').noise, -85.23)
  })

  describe('digital stages add none; converters add their own, 112 dB under full scale (D18)', () => {
    expectReadings(signalOf([
      card('line', 'line-in'),
      card('adc', 'adc'),
      card('fader', 'fader', { faderDb: -6 }),
      card('dac', 'dac'),
    ], [
      wire('line', 'adc'), wire('adc', 'fader'), wire('fader', 'dac'),
    ]), {
      line:  [2, -10, -90],
      // The line's noise (−108 dBFS) and the ADC's own (−112 dBFS)
      adc:   [-16, -28, -106.54],
      // A digital fader: exactly 6 dB down, no noise of its own
      fader: [-22, -34, -112.54],
      // Back to dBu (−94.54) and the DAC's own (−94 dBu)
      dac:   [-4, -16, -91.25],
    })
  })
})

describe('D1: a hum is part of the noise and follows the signal', () => {
  const rig = (groundLift: boolean) => signalOf([
    card('gtr', 'instrument'),
    card('di', 'di-box', { groundLift }),
    card('amp', 'guitar-amp'),
    card('pre', 'gain'),
    card('fader', 'fader', { faderDb: -10 }),
    // Threshold −30: under the guitar (−10), over the hum (−40)
    card('gate', 'noise-gate', { thresholdDb: -30 }),
  ], [
    wire('gtr', 'di'), wire('di:direct', 'amp'), wire('di', 'pre'), wire('pre', 'fader'), wire('pre', 'gate'),
  ])
  const hum = rig(false)

  it('starts on the XLR Out and drowns the guitar\'s own noise', () => {
    expectDb(leaving(hum, 'di').hum, -80)
    expectDb(leaving(hum, 'di').noise, -80)
    // A guitar 30 dB over the hum
    expectDb(snrOf(leaving(hum, 'pre')), 30)
  })

  it('a fader turns it down with the guitar: the gap between them stays', () => {
    expectDb(hum.stages.fader.hum, -50)
    expectDb(snrOf(leaving(hum, 'fader')), 30)
  })

  it('a gate shuts it off in the pauses, with the rest of the noise: its own floor is left (D18)', () => {
    expectDb(hum.stages.gate.hum, -120)
    expectDb(leaving(hum, 'gate').noise, -94.99)
  })

  it('Ground Lift takes it away: only the hiss is left', () => {
    const lifted = rig(true)
    expect(lifted.stages.pre.hum).toBeUndefined()
    expectDb(snrOf(leaving(lifted, 'pre')), 69.32)
  })
})

describe('a hum is not hiss: the noise without its hum reads the same either way', () => {
  const rig = (groundLift: boolean) => signalOf([
    card('gtr', 'instrument'),
    card('di', 'di-box', { groundLift }),
    card('amp', 'guitar-amp'),
    card('pre', 'gain'),
  ], [
    wire('gtr', 'di'), wire('di:direct', 'amp'), wire('di', 'pre'),
  ])

  it('a hum 30 dB under the guitar; the hiss under it as with Ground Lift on', () => {
    const humming = rig(false).stages.pre
    expectDb(snrOf(louder(humming.out.l, humming.out.r)), 30)
    expectDb(hissOf(louder(humming.out.l, humming.out.r)), hissOf(louder(rig(true).stages.pre.out.l, rig(true).stages.pre.out.r)))
  })
})

// ── The marks on a dynamics card's curve ────────────────────────────────────────
// A Compressor, Noise Gate or Limiter draws the peaks, the average and the noise of what goes into
// its curve (curveIn: what arrives — its own noise comes after its curve, D18), each where the curve
// sends it, then its own noise added. Those must be what leaves the card, or the marks and the
// meters disagree.

/** A side's [peak, average, noise]. */
function expectSide(actual: SideLevels | undefined, [peak, rms, noise]: readonly [number, number, number]) {
  expectDb(actual?.peak, peak)
  expectDb(actual?.rms, rms)
  expectDb(actual?.noise, noise)
}

/**
 * The readings through the card's curve on their own (peaks flattened at the clip level, as the
 * engine does), then its own noise after it (a dynamics card: a line stage's, D18).
 */
function marksOf(stage: StageResult, curve: Transfer): SideLevels {
  const out = throughCurve(curve, curveInputOf(stage))
  return { ...out, peak: Math.min(out.peak, CLIP_DBU), noise: sumNoiseToDb([out.noise, LINE_NOISE_DBU]) }
}

/**
 * The marks leave where the card sends each reading: what leaves it, its louder side (`curveOut`);
 * the noise where the curve sends it — what you hear when the music stops, the gain settled on it.
 */
function expectMarksLeave(result: GraphSignalResult, id: string, curve: Transfer) {
  const out = leaving(result, id)
  expectSide(result.stages[id].curveOut, [out.peak, out.rms, out.noise])
  expectDb(result.stages[id].curveOut?.noise, marksOf(result.stages[id], curve).noise)
}

describe("the marks on a dynamics card's curve: what goes in, and where the card sends it", () => {
  // Mic → Preamp +50: a voice at −10 dBu, peaks at +2, noise at −73.86. D9: the number engine sends
  // each through the curve; D18: each card adds its own noise (−95) after it.
  const result = signalOf([
    card('mic', 'mic'),
    card('pre', 'gain', { preampDb: 50 }),
    card('comp', 'comp', { thresholdDb: -20, ratio: 4, makeupGainDb: 6 }),
    card('gate', 'noise-gate'),
    card('high', 'noise-gate', { thresholdDb: 0 }),
    card('lim', 'limiter', { thresholdDb: -3, makeupGainDb: 10 }),
    card('hot', 'comp', { thresholdDb: 0, ratio: 1, makeupGainDb: 20 }),
    card('off', 'comp', {}, true),
    card('fader', 'fader'),
  ], [
    wire('mic', 'pre'),
    ...['comp', 'gate', 'high', 'lim', 'hot', 'off', 'fader'].map((id) => wire('pre', id)),
  ])

  it('go in as they arrive: a dynamics card adds its own noise after its curve (D18)', () => {
    expectSide(result.stages.comp.curveIn, [2, -10, -73.86])
    expectSide(result.stages.gate.curveIn, [2, -10, -73.86])
  })

  it('a compressor: the peaks come down further than the average — 12 dB apart in, 3 out (D9)', () => {
    expectSide(result.stages.comp.curveOut, [-8.5, -11.5, -67.86])
    expectMarksLeave(result, 'comp', compressor(-20, 4, 6))
  })

  it('a noise gate with its threshold between the noise and the music: only the noise drops, to its own floor', () => {
    expectSide(result.stages.gate.curveOut, [2, -10, -95])
    expectMarksLeave(result, 'gate', noiseGate(-40, -80))
  })

  it('a noise gate set above the average: it cuts into the music, only the peaks get through (D9)', () => {
    expectSide(result.stages.high.curveOut, [2, -90, -95])
    expectMarksLeave(result, 'high', noiseGate(0, -80))
  })

  it('a limiter: the peaks stop at its ceiling, then the makeup gain lifts all three (D9)', () => {
    expectSide(result.stages.lim.curveOut, [7, 0, -63.86])
    expectMarksLeave(result, 'lim', limiter(-3, 10))
  })

  it('a peak the card sends past the clip level is flattened there (the top of the curve)', () => {
    expectDb(result.stages.hot.curveOut?.peak, CLIP_DBU)
    expectMarksLeave(result, 'hot', compressor(0, 1, 20))
  })

  it('bypassed: nothing of its own goes in — the marks show what arrives', () => {
    expect(result.stages.off.curveIn).toBeUndefined()
    expect(result.stages.off.curveOut).toBeUndefined()
    expectSide(curveInputOf(result.stages.off), [2, -10, -73.86])
  })

  it('only dynamics cards have a curve', () => {
    expect(result.stages.fader.curveIn).toBeUndefined()
    expect(result.stages.pre.curveIn).toBeUndefined()
  })

  it("a gate does not hear its own noise (D18): set over a line's (−90), it closes on it — its own floor stays", () => {
    const line = signalOf([card('line', 'line-in'), card('gate', 'noise-gate', { thresholdDb: -85 })], [wire('line', 'gate')])
    expectDb(line.stages.gate.curveIn?.noise, -90)
    expectDb(leaving(line, 'gate').noise, LINE_NOISE_DBU)
    expectMarksLeave(line, 'gate', noiseGate(-85, -80))
  })

  it('in stereo (linked): the louder side goes in, and its marks are what leaves on that side', () => {
    // Pan a quarter left: the left side 7.66 dB louder than the right
    const panned = signalOf([
      card('line', 'line-in'),
      card('pan', 'pan', { panPosition: 25 }),
      card('comp', 'comp', { thresholdDb: -20, ratio: 4 }),
    ], [wire('line', 'pan'), wire('pan', 'comp')])
    const comp = panned.stages.comp
    expectDb(comp.curveIn?.rms, Math.max(comp.in.l.rms, comp.in.r.rms))
    expectMarksLeave(panned, 'comp', compressor(-20, 4, 0))
  })
})

describe('the engine', () => {
  it('gives cards in a loop, and after one, no reading', () => {
    const result = signalOf([
      card('line', 'line-in'),
      card('a', 'fader'),
      card('b', 'fader'),
      card('after', 'fader'),
    ], [
      wire('line', 'a'), wire('a', 'b'), wire('b', 'a'), wire('b', 'after'),
    ])
    expect(Object.keys(result.stages)).toEqual(['line'])
  })

  it('works a chain out once, and hands back what came out the same', () => {
    const nodes = [card('line', 'line-in'), card('fader', 'fader'), card('spk', 'active-speaker')]
    const edges = [wire('line', 'fader'), wire('fader', 'spk')]
    const first = signalOf(nodes, edges)
    expect(signalOf(nodes, edges)).toBe(first)

    // The fader moves: the line's reading is the same object, the fader's and the speaker's are new
    const moved = signalOf([nodes[0], card('fader', 'fader', { faderDb: -6 }), nodes[2]], edges)
    expect(moved.stages.line).toBe(first.stages.line)
    expect(moved.stages.fader).not.toBe(first.stages.fader)
    expectDb(average(moved.stages.spk.out, 'l'), -16)
    expect(moved.wires.get('line:out')).toBe(first.wires.get('line:out'))
  })
})
