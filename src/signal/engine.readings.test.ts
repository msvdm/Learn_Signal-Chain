import { describe, expect, it } from 'bun:test'
import type { SignalNode } from '../data/nodeRegistry'
import type { GraphSignalResult } from './engine'
import { headroomOf, hissOf, louder, snrOf, sumNoiseToDb } from './levels'
import { LINE_NOISE_DBU } from './process'
import { card, expectCards, expectDb, expectReadings, leaving, signalOf, wire } from '../../test/chains'

// ── Peaks, noise and the hum ────────────────────────────────────────────────────
// The reference chains' readings beyond their average (engine.chains.test.ts says which design
// decisions changed them: D1, D4, D9, D18).

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
