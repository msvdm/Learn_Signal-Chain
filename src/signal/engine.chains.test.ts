import { describe, expect, it } from 'bun:test'
import type { EQBand, NodeParamValue } from '../data/nodeRegistry'
import type { Expected } from '../../test/chains'
import { S, VOICE, average, card, expectCards, expectDb, expectWire, heard, leaving, line, signalOf, voiceInto, wire } from '../../test/chains'


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
// Peaks, noise and the hum: engine.readings.test.ts; the marks on a dynamics card's curve: engine.curve.test.ts.

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
  ...voiceInto('mic'),
  card('pre', 'gain', { preampDb: 50 }),
  card('eq', 'eq', { bands: EQ_BANDS }, bypassed),
  card('comp', 'comp', { thresholdDb: -20, ratio: 4, makeupGainDb: 3 }, bypassed),
  card('fader', 'fader', { faderDb: -5 }),
  card('bus', 'master-bus'),
  card('spkL', 'active-speaker'),
  card('spkR', 'active-speaker'),
], [
  heard('mic'), wire('mic', 'pre'), wire('pre', 'eq'), wire('eq', 'comp'), wire('comp', 'fader'), wire('fader', 'bus'),
  wire('bus:out-l', 'spkL'), wire('bus:out-r', 'spkR'),
])

describe('a channel strip: mic → preamp → EQ → compressor → fader → Master Bus → speakers', () => {
  expectCards(channelStrip(false), {
    micVoice: VOICE,
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
    micVoice: VOICE,
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
    ...voiceInto('vox'),
    card('pre', 'gain'),
    card('voxPan', 'pan'),
    line('gtr'),
    card('gtrPan', 'pan', { panPosition: 0 }),
    card('keys', 'keyboard'),
    card('keysBal', 'pan', { panPosition: 75 }),
    card('bus', 'master-bus'),
    card('main', 'fader', { faderDb: -3 }),
    card('spkL', 'active-speaker'),
    card('spkR', 'active-speaker'),
  ], [
    heard('vox'), wire('vox', 'pre'), wire('pre', 'voxPan'), wire('voxPan', 'bus'),
    wire('gtr', 'gtrPan'), wire('gtrPan', 'bus'),
    wire('keys', 'keysBal'), wire('keysBal', 'bus'),
    wire('bus:mix', 'main'), wire('main:out-l', 'spkL'), wire('main:out-r', 'spkR'),
  ])

  expectCards(result, {
    voxVoice: VOICE,
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
    line('line', { levelDb: -20 }),
    card('aux', 'aux-bus', { stereo: true }),
    card('comp', 'comp'),
    line('line2'),
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

/**
 * A guitar into a Guitar Amp, its DI Out to a Preamp (D26): mic level, the same whatever the amp's
 * Volume; in a ground loop until its Ground Lift is on — the hum on the DI Out, not on its Sound.
 */
const ampDi = (amp: Record<string, NodeParamValue>) => signalOf([
  card('gtr', 'instrument'),
  card('amp', 'guitar-amp', amp),
  card('mic', 'mic'),
  card('pre', 'gain'),
], [
  wire('gtr', 'amp'), wire('amp:sound', 'mic'), wire('amp:di-out', 'pre'),
])

describe("a Guitar Amp's DI Out", () => {
  it('sends the guitar at mic level, as loud as a microphone in front of the amp at 5: −40 dBu', () => {
    const result = ampDi({ groundLift: true })
    expectWire(result, 'amp:di-out', 'mono', -40, -40)
    expect(result.stages.mic.out.l.rms).toBe(-40)
  })

  it('the same at any Volume: it is taken before it (only the Sound changes)', () => {
    for (const volume of [0, 1, 11]) expectWire(ampDi({ volume, groundLift: true }), 'amp:di-out', 'mono', -40, -40)
    expect(ampDi({ volume: 0, groundLift: true }).stages.mic.out.l.rms).toBe(-Infinity)
  })

  it('the Gain after it works as its Preamp', () => {
    expect(ampDi({ groundLift: true }).stages.pre.role).toBe('preamp')
  })

  it('Ground Lift off: a hum on the DI Out, and from there on — none on its Sound', () => {
    const result = ampDi({})
    expect(result.hums.get('amp:di-out')).toBe(-80)
    expect(result.hums.has('amp:sound')).toBe(false)
    expect(result.stages.amp.hum).toBeUndefined()
    expect(result.stages.pre.hum).toBe(-40)
  })

  it('Ground Lift on: no hum', () => {
    expect(ampDi({ groundLift: true }).hums.size).toBe(0)
  })

  it('no wire on the DI Out: no ground loop', () => {
    const result = signalOf([card('gtr', 'instrument'), card('amp', 'guitar-amp'), card('mic', 'mic')], [
      wire('gtr', 'amp'), wire('amp:sound', 'mic'),
    ])
    expect(result.hums.size).toBe(0)
  })

  it('switched off (D27): nothing out of its Sound or its DI Out — not even the hum, Ground Lift or not', () => {
    const result = ampDi({ on: false })
    expect(result.stages.amp.condition).toBe('switchedOff')
    expectWire(result, 'amp:sound', 'mono', S, S)
    expectWire(result, 'amp:di-out', 'mono', S, S)
    expect(result.wires.get('amp:di-out')!.l.noise).toBe(-Infinity)
    expect(result.hums.size).toBe(0)
  })
})

/**
 * The Amplifier (D27): two channels, input A out of L and B out of R, each with its own Volume (B
 * follows A until it is turned); one stereo wire goes into both; switched off it sends nothing.
 */
describe('the Amplifier: two channels, one stereo wire into both, a power switch', () => {
  const result = signalOf([
    line('a'), line('b', { levelDb: -20 }), card('keys', 'keyboard'),
    card('amp', 'amp', { gainDb: -6 }), card('spkL', 'speaker'), card('spkR', 'speaker'),
    card('amp2', 'amp', { gainDb: -6, gainDbR: 0 }), card('spk2L', 'speaker'), card('spk2R', 'speaker'),
    card('off', 'amp', { on: false }), card('spkOff', 'speaker'),
  ], [
    // Two mono wires: each plays on its own channel
    wire('a', 'amp'), wire('b', 'amp:in-b'), wire('amp:out-l', 'spkL'), wire('amp:out-r', 'spkR'),
    // One stereo wire, plugged into B: its left side out of L, its right out of R
    wire('keys', 'amp2:in-b'), wire('amp2:out-l', 'spk2L'), wire('amp2:out-r', 'spk2R'),
    wire('keys', 'off'), wire('off:out-l', 'spkOff'),
  ])
  expectCards(result, {
    a:      { out: -10, health: 'good' },
    b:      { out: -20, health: 'good' },
    keys:   { out: [-10, -10], health: 'good' },
    // B's Volume follows A's (−6)
    amp:    { in: [-10, -20], out: [-16, -26], health: 'good' },
    spkL:   { in: -16, out: -16, health: 'good' },
    spkR:   { in: -26, out: -26, health: 'good' },
    amp2:   { in: [-10, -10], out: [-16, -10], health: 'good' },
    spk2L:  { in: -16, out: -16, health: 'good' },
    spk2R:  { in: -10, out: -10, health: 'good' },
    off:    { in: [-10, -10], out: [S, S], health: 'too-quiet', condition: 'switchedOff' },
    spkOff: { in: S, out: S, health: 'too-quiet' },
  })

  it('one mono wire leaves the other channel silent', () => {
    const one = signalOf([line('a'), card('amp', 'amp'), card('spkL', 'speaker'), card('spkR', 'speaker')], [
      wire('a', 'amp:in-b'), wire('amp:out-l', 'spkL'), wire('amp:out-r', 'spkR'),
    ])
    expectDb(one.stages.spkR.out.l.rms, -10)
    expectDb(one.stages.spkL.out.l.rms, S)
  })

  it('switched off, not even its hiss', () => {
    expect(leaving(result, 'off').noise).toBe(-Infinity)
    expect(leaving(result, 'spkOff').noise).toBe(-Infinity)
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
    ...voiceInto('mic'),
    card('pre', 'gain'),
    card('adc', 'adc'),
    card('fader', 'fader', { faderDb: 6 }),
    card('dac', 'dac'),
    card('spk', 'active-speaker'),
  ], [
    heard('mic'), wire('mic', 'pre'), wire('pre', 'adc'), wire('adc', 'fader'), wire('fader', 'dac'), wire('dac', 'spk'),
  ]), {
    micVoice: VOICE,
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
    line('a', { levelDb: 0 }),
    card('gainA', 'gain', { gainDb: 15 }),
    card('adcA', 'adc'),
    line('b', { levelDb: 0 }),
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
    line('line'),
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
    // (An Amplifier is two channels — D27: a mono wire on A arrives on its left only)
    amp:  { in: [-28, S], out: [S, S], health: 'too-quiet', domain: 'digital', inDomain: 'digital', condition: 'digitalToAmp' },
    // −10 dBu and −28 dBFS arrive: a bus cannot add them up
    aux:  { in: -8.97, out: S, health: 'too-quiet', condition: 'domainMixedBus' },
  })
})

describe('a noise gate: closed below its threshold (−40), open from it up', () => {
  expectCards(signalOf([
    ...voiceInto('mic'),
    card('gate', 'noise-gate'),
    ...voiceInto('mic2'),
    card('pre2', 'gain', { preampDb: 5 }),
    card('gate2', 'noise-gate', { rangeDb: -20 }),
    ...voiceInto('mic3'),
    card('pre3', 'gain', { preampDb: 20 }),
    card('gate3', 'noise-gate'),
    ...voiceInto('mic4'),
    card('pre4', 'gain'),
    card('gate4', 'noise-gate'),
  ], [
    heard('mic'), wire('mic', 'gate'),
    heard('mic2'), wire('mic2', 'pre2'), wire('pre2', 'gate2'),
    heard('mic3'), wire('mic3', 'pre3'), wire('pre3', 'gate3'),
    heard('mic4'), wire('mic4', 'pre4'), wire('pre4', 'gate4'),
  ]), {
    micVoice: VOICE,
    mic:   { out: -60, health: 'too-quiet' },
    // Closed: turned down by its Range (−80 dB, about silence)
    gate:  { in: -60, out: -140, health: 'too-quiet', reduction: 80 },
    mic2Voice: VOICE,
    mic2:  { out: -60, health: 'too-quiet' },
    pre2:  { in: -60, out: -55, health: 'too-quiet', role: 'preamp' },
    // Closed, with a Range of −20 dB
    gate2: { in: -55, out: -75, health: 'too-quiet', reduction: 20 },
    mic3Voice: VOICE,
    mic3:  { out: -60, health: 'too-quiet' },
    pre3:  { in: -60, out: -40, health: 'good', role: 'preamp' },
    // D9: right at the threshold: open
    gate3: { in: -40, out: -40, health: 'good', reduction: 0 },
    mic4Voice: VOICE,
    mic4:  { out: -60, health: 'too-quiet' },
    pre4:  { in: -60, out: -20, health: 'good', role: 'preamp' },
    gate4: { in: -20, out: -20, health: 'good', reduction: 0 },
  })
})

describe('a limiter: nothing above its ceiling (−3), then the makeup gain', () => {
  expectCards(signalOf([
    line('line', { levelDb: 0 }),
    card('gain', 'gain', { gainDb: 10 }),
    card('lim', 'limiter'),
    line('line2'),
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
    card('keys', 'keyboard', { levelDb: 0 }),
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
    line('a'),
    line('b'),
    card('aux', 'aux-bus'),
    line('c'),
    line('d'),
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
    line('line'),
    card('bus', 'master-bus'),
    card('main', 'fader', { faderDb: -5 }),
    card('spkL', 'active-speaker'),
    card('spkR', 'active-speaker'),
    line('line2', { levelDb: -20 }),
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
    ...voiceInto('mic'),
    card('pre', 'gain'),
    card('fader', 'fader', { faderDb: -10 }),
    card('prePost', 'relay', { selectedInput }),
    card('sendLevel', 'gain', { gainDb: -6 }),
    card('aux', 'aux-bus'),
  ], [
    heard('mic'), wire('mic', 'pre'), wire('pre', 'fader'),
    wire('pre', 'prePost:in-a'), wire('fader', 'prePost:in-b'),
    wire('prePost', 'sendLevel'), wire('sendLevel', 'aux'),
  ])
  const channel = {
    micVoice: VOICE,
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

describe('a condenser microphone needs 48V phantom power; a dynamic one does not (D21)', () => {
  expectCards(signalOf([
    card('conVoice', 'vocal'), card('con', 'mic', { micType: 'condenser' }), card('con48', 'phantom'), card('conPre', 'gain'),
    card('offVoice', 'vocal'), card('off', 'mic', { micType: 'condenser' }), card('off48', 'phantom', { on: false }), card('offPre', 'gain'),
    ...voiceInto('dyn'), card('dynPre', 'gain'),
  ], [
    wire('conVoice:sound', 'con'), wire('con', 'con48'), wire('con48', 'conPre'),
    wire('offVoice:sound', 'off'), wire('off', 'off48'), wire('off48', 'offPre'),
    heard('dyn'), wire('dyn', 'dynPre'),
  ]), {
    // 12 dB more than a dynamic microphone; the 48V passes it on as it is, and the Preamp is still its Preamp
    conVoice: VOICE,
    con:      { out: -48, health: 'too-quiet' },
    con48:    { in: -48, out: -48, health: 'too-quiet' },
    conPre:   { in: -48, out: -8, health: 'good', role: 'preamp' },
    // Its 48V switched off: it hears the voice and sends nothing
    offVoice: VOICE,
    off:      { out: S, health: 'too-quiet', condition: 'noPhantom' },
    off48:    { in: S, out: S, health: 'too-quiet' },
    offPre:   { in: S, out: S, health: 'too-quiet', role: 'preamp' },
    dynVoice: VOICE,
    dyn:      { out: -60, health: 'too-quiet' },
    dynPre:   { in: -60, out: -20, health: 'good', role: 'preamp' },
  })
})

describe('speakers: a passive one needs an amplifier, an active one (or headphones) is blown by it; headphones need a Gain', () => {
  expectCards(signalOf([
    line('line'),
    card('passive', 'speaker'),
    card('amp', 'amp', { gainDb: -6 }),
    card('passive2', 'speaker'),
    card('active', 'active-speaker'),
    card('knob', 'gain', { gainDb: -6 }),
    card('phones', 'headphones'),
    card('phones2', 'headphones'),
    card('phones3', 'headphones'),
  ], [
    wire('line', 'passive'), wire('line', 'knob'), wire('knob', 'phones'), wire('line', 'phones3'),
    // The app draws an Amplifier only into a passive speaker (connectionRules); the other two wires
    // come from one taking a bus's L / R over, or from an older file. Its input A plays out of L (D27)
    wire('line', 'amp'), wire('amp:out-l', 'passive2'), wire('amp:out-l', 'active'), wire('amp:out-l', 'phones2'),
  ]), {
    line:     { out: -10, health: 'good' },
    passive:  { in: -10, out: S, health: 'too-quiet', condition: 'needsAmp' },
    amp:      { in: [-10, S], out: [-16, S], health: 'good' },
    passive2: { in: -16, out: -16, health: 'good' },
    // Speaker level, 40 dB over the line level it expects
    active:   { in: -16, out: 24, health: 'clipping', condition: 'blown' },
    knob:     { in: -10, out: -16, health: 'good' },
    // Headphones have no knob: the Gain right before them sets their level; with none they are
    // silent (the user's call, 2026-10-11); an amplifier blows them, Gain or not
    phones:   { in: -16, out: -16, health: 'good' },
    phones2:  { in: -16, out: 24, health: 'clipping', condition: 'blown' },
    phones3:  { in: -10, out: S, health: 'too-quiet', condition: 'needsGain' },
  })
})

describe('the ends: a Studio Monitor works as an Active Speaker, a Recorder keeps what arrives, Stream / Broadcast sends stereo', () => {
  expectCards(signalOf([
    line('line'),
    card('keys', 'keyboard'),
    card('monitor', 'studio-monitor', { volumeDb: -6 }),
    card('rec', 'recorder'),
    card('rec2', 'recorder'),
    card('air', 'broadcast'),
  ], [
    wire('line', 'monitor'), wire('line', 'rec'), wire('keys', 'rec2'), wire('line', 'air'),
  ]), {
    line:    { out: -10, health: 'good' },
    keys:    { out: [-10, -10], health: 'good' },
    monitor: { in: -10, out: -16, health: 'good' },
    // One channel in, one recorded; a stereo wire, both sides
    rec:     { in: -10, out: -10, health: 'good' },
    rec2:    { in: [-10, -10], out: [-10, -10], health: 'good' },
    // A mono wire goes out on both sides
    air:     { in: [-10, -10], out: [-10, -10], health: 'good' },
  })
})

describe('record and play back (D22): an Audio Interface\'s two paths never meet, a DAW plays a song of its own', () => {
  // One USB wire between them carries both ways (its way back: signalOf adds it, as the store does)
  // A Computer at 0 dBu recorded: the Interface turns it into numbers (−18 dBFS) for the DAW. The
  // DAW's song (−18 dBFS) comes back out of the Interface at 0 dBu, Left and Right to two monitors
  const chain = (pcDb: number) => signalOf([
    card('pc', 'pc', { levelDb: pcDb }),
    card('box', 'interface'),
    card('daw', 'daw'),
    card('monL', 'studio-monitor'),
    card('monR', 'studio-monitor'),
  ], [
    wire('pc', 'box'), wire('box:to-pc', 'daw'), wire('box', 'monL'), wire('box', 'monR'),
  ])
  const result = chain(0)

  expectCards(result, {
    pc:   { out: [0, 0], health: 'good' },
    // The card shows what it records: in at 0 dBu, to the computer at −18 dBFS
    box:  { in: [0, 0], out: [-18, -18], health: 'good', domain: 'digital' },
    // The DAW shows what it records
    daw:  { in: [-18, -18], out: [-18, -18], health: 'good', domain: 'digital', inDomain: 'digital' },
    // One stereo line output (the user's call, 2026-10-11: it was Line out L / R): straight into a
    // one-channel monitor its two sides fold into one, 6 dB up
    monL: { in: 6.02, out: 6.02, health: 'hot' },
    monR: { in: 6.02, out: 6.02, health: 'hot' },
  })

  it('plays back its song at −18 dBFS, back along the USB wire and out of the Interface at 0 dBu', () => {
    expectWire(result, 'daw:playback', 'stereo', -18, -18)
    expectWire(result, 'box:to-pc', 'stereo', -18, -18)
    expectWire(result, 'box:out', 'stereo', 0, 0)
  })

  it('each output leaves in its own domain: numbers to the computer, an analog signal out', () => {
    expect(result.stages.box.outDomains).toEqual({ 'to-pc': 'digital', out: 'analog' })
  })

  it('what it plays back never depends on what it records', () => {
    const quieter = chain(-20)
    expectDb(average(quieter.stages.daw.in, 'l'), -38)
    expectWire(quieter, 'box:out', 'stereo', 0, 0)
  })
})

describe('the PFL Bus: stereo on one wire, every channel on both sides, no fader of its own', () => {
  // The user's call, 2026-10-11: a listening bus — no Main Fader, never into a Matrix Bus
  const result = signalOf([
    line('line'),
    card('keys', 'keyboard'),
    card('sw', 'switch'),
    card('pfl', 'pfl-bus'),
    card('fader', 'fader'),
  ], [
    wire('line', 'sw'), wire('sw', 'pfl'), wire('keys', 'pfl'), wire('pfl', 'fader'),
  ])

  expectCards(result, {
    line:  { out: -10, health: 'good' },
    keys:  { out: [-10, -10], health: 'good' },
    // An On Off Switch into it is that channel's PFL button: named so, it works the same
    sw:    { in: -10, out: -10, health: 'good', role: 'pfl' },
    // The mono line on both sides at full level, each side of the Keyboard on its own: −10 and −10 add up
    pfl:   { in: [-3.98, -3.98], out: [-3.98, -3.98], health: 'good' },
    // A plain fader after it, not its Main Fader
    fader: { in: [-3.98, -3.98], out: [-3.98, -3.98], health: 'good' },
  })

  it('sends one stereo wire', () => {
    expectWire(result, 'pfl:out', 'stereo', -3.98, -3.98)
  })
})

describe('the song played back into the desk and the desk recorded: two paths of one Interface, no loop', () => {
  // DAW → Interface → Master Bus → the same Interface → DAW: card by card a loop, path by path none
  expectCards(signalOf([
    card('box', 'interface'),
    card('daw', 'daw'),
    card('bus', 'master-bus'),
  ], [
    wire('box', 'bus'), wire('bus:out-l', 'box'), wire('bus:out-r', 'box'), wire('box:to-pc', 'daw'),
  ]), {
    box: { in: [0, 0], out: [-18, -18], health: 'good', domain: 'digital' },
    daw: { in: [-18, -18], out: [-18, -18], health: 'good', domain: 'digital', inDomain: 'digital' },
    bus: { in: [0, 0], out: [0, 0], health: 'good' },
  })
})

describe('a clip before a speaker is heard there, however green its meter (distorted)', () => {
  // A Gain 20 dB too hot clips the music's peaks; the Fader after it brings the level back down
  const chain = (on: boolean) => signalOf([
    line('line'),
    card('hot', 'gain', { gainDb: 20 }),
    card('fader', 'fader', { faderDb: -20 }),
    card('sw', 'switch', { on }),
    card('spk', 'active-speaker'),
    line('clean'),
    card('bus', 'master-bus'),
    card('knob', 'gain'),
    card('phones', 'headphones'),
  ], [
    wire('line', 'hot'), wire('hot', 'fader'), wire('fader', 'sw'), wire('sw', 'spk'),
    wire('fader', 'bus'), wire('clean', 'bus'), wire('bus:out-l', 'knob'), wire('knob', 'phones'),
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

describe('the digital picture (D23): a Decoder, an Encoder, a Recorder Track, the DAW at Advanced', () => {
  // A stream played (a Decoder: numbers from the start, its peaks at −18 dBFS, its average −30),
  // through a digital Gain, packed by an Encoder for Stream / Broadcast: digital all the way, the
  // level kept. (The Decoder averaged −18 until 2026-10-11: the user put its peaks there, EBU's level)
  describe('a Decoder through an Encoder to Stream / Broadcast', () => {
    expectCards(signalOf([
      card('dec', 'decoder'),
      card('gain', 'gain'),
      card('cod', 'encoder'),
      card('air', 'broadcast'),
    ], [
      wire('dec', 'gain'), wire('gain', 'cod'), wire('cod', 'air'),
    ]), {
      dec:  { out: [-30, -30], health: 'good', domain: 'digital' },
      gain: { in: [-30, -30], out: [-30, -30], health: 'good', domain: 'digital', inDomain: 'digital' },
      cod:  { in: [-30, -30], out: [-30, -30], health: 'good', domain: 'digital', inDomain: 'digital' },
      air:  { in: [-30, -30], out: [-30, -30], health: 'good', domain: 'digital', inDomain: 'digital' },
    })
  })

  // Encoding is more than converting: an analog signal into an Encoder gives nothing to send. Nothing
  // plugged in, it says nothing. A Decoder meets the analog desk only after a DAC
  describe('an Encoder fed an analog signal is silent; a Decoder cannot be mixed with analog channels', () => {
    expectCards(signalOf([
      card('keys', 'keyboard'),
      card('cod', 'encoder'),
      card('air', 'broadcast'),
      card('idle', 'encoder'),
      card('keys2', 'keyboard'),
      card('dec', 'decoder'),
      card('bus', 'master-bus'),
    ], [
      wire('keys', 'cod'), wire('cod', 'air'), wire('keys2', 'bus'), wire('dec', 'bus'),
    ]), {
      keys:  { out: [-10, -10], health: 'good' },
      cod:   { in: [-10, -10], out: [S, S], health: 'too-quiet', condition: 'encoderNeedsDigital' },
      air:   { in: [S, S], out: [S, S], health: 'too-quiet' },
      // (Mono until 2026-10-11: an Encoder is always stereo now, like what it feeds — the user's call)
      idle:  { out: [S, S], health: 'too-quiet' },
      keys2: { out: [-10, -10], health: 'good' },
      dec:   { out: [-30, -30], health: 'good', domain: 'digital' },
      bus:   { out: [S, S], health: 'too-quiet', condition: 'domainMixedBus' },
    })
  })

  // What it records decides its meter: dBFS after an ADC, a VU meter on an analog signal (the
  // card's) — and its Monitor out passes on what it records, back into a channel
  describe('a Recorder Track records in the domain that reaches it, and passes it on', () => {
    const result = signalOf([
      card('keys', 'keyboard'),
      card('adc', 'adc'),
      card('rec', 'recorder'),
      card('fad', 'fader'),
      card('keys2', 'keyboard'),
      card('rec2', 'recorder'),
      card('gain', 'gain'),
    ], [
      wire('keys', 'adc'), wire('adc', 'rec'), wire('rec', 'fad'), wire('keys2', 'rec2'), wire('rec2', 'gain'),
    ])
    expectCards(result, {
      keys:  { out: [-10, -10], health: 'good' },
      adc:   { in: [-10, -10], out: [-28, -28], health: 'good', domain: 'digital' },
      rec:   { in: [-28, -28], out: [-28, -28], health: 'good', domain: 'digital', inDomain: 'digital' },
      fad:   { in: [-28, -28], out: [-28, -28], health: 'good', domain: 'digital', inDomain: 'digital' },
      keys2: { out: [-10, -10], health: 'good' },
      rec2:  { in: [-10, -10], out: [-10, -10], health: 'good' },
      gain:  { in: [-10, -10], out: [-10, -10], health: 'good' },
    })

    it('sends what it records out of its Monitor out', () => {
      expectWire(result, 'rec:out', 'stereo', -28, -28)
    })
  })

  // No Interface at Advanced: the DAW is a digital summing bus into a Recorder Track (the user's
  // call, 2026-10-11 — until then it played its own song there). Nothing in: silent; numbers only
  describe('the DAW at Advanced adds up what it records, into a Recorder Track', () => {
    const result = signalOf([
      card('dec', 'decoder'),
      card('dec2', 'decoder'),
      card('daw', 'daw'),
      card('rec', 'recorder'),
      card('fad', 'fader'),
      card('idle', 'daw'),
      card('rec2', 'recorder'),
      card('keys', 'keyboard'),
      card('daw3', 'daw'),
    ], [
      wire('dec', 'daw'), wire('dec2', 'daw'), wire('daw', 'rec'), wire('rec', 'fad'),
      wire('idle', 'rec2'), wire('keys', 'daw3'),
    ])
    expectCards(result, {
      dec:  { out: [-30, -30], health: 'good', domain: 'digital' },
      dec2: { out: [-30, -30], health: 'good', domain: 'digital' },
      // Two songs at −30 dBFS added as voltages: +6 dB
      daw:  { in: [-23.98, -23.98], out: [-23.98, -23.98], health: 'good', domain: 'digital', inDomain: 'digital' },
      rec:  { in: [-23.98, -23.98], out: [-23.98, -23.98], health: 'good', domain: 'digital', inDomain: 'digital' },
      fad:  { in: [-23.98, -23.98], out: [-23.98, -23.98], health: 'good', domain: 'digital', inDomain: 'digital' },
      keys: { out: [-10, -10], health: 'good' },
      idle: { out: [S, S], health: 'too-quiet' },
      rec2: { in: [S, S], out: [S, S], health: 'too-quiet' },
      daw3: { in: [-10, -10], out: [S, S], health: 'too-quiet', condition: 'dawNeedsDigital' },
    })
  })
})

describe('the engine', () => {
  it('gives cards in a loop, and after one, no reading', () => {
    const result = signalOf([
      line('line'),
      card('a', 'fader'),
      card('b', 'fader'),
      card('after', 'fader'),
    ], [
      wire('line', 'a'), wire('a', 'b'), wire('b', 'a'), wire('b', 'after'),
    ])
    expect(Object.keys(result.stages)).toEqual(['line'])
  })

  it('works a chain out once, and hands back what came out the same', () => {
    const nodes = [line('line'), card('fader', 'fader'), card('spk', 'active-speaker')]
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
