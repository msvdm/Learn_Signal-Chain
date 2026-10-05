import { describe, expect, it } from 'bun:test'
import type { EQBand, NodeParamValue, TypeKey } from '../data/nodeRegistry'
import { initialParams } from '../data/nodeRegistry'
import type { SideContext, SideResult } from './process'
import { balanceSides, compressor, limiter, noiseGate, panSides, processSide } from './process'

// What each card does to one channel, on its own (the engine tests, engine.test.ts, put the cards
// together). Step 4 (TODO.md) hands processSide a peak, an average and a noise instead of one number:
// `run` then passes the average in and reads it out, and the numbers here stay.

const S = -Infinity

const CTX: SideContext = { domain: 'analog', mixedDomains: false, side: null, preamp: false, fed: true }

/** One channel through a card of this type, with its starting params (`params` on top). */
function run(
  typeKey: TypeKey,
  input: number,
  params: Record<string, NodeParamValue> = {},
  ctx: Partial<SideContext> = {},
): SideResult {
  const node = { id: typeKey, typeKey, position: { x: 0, y: 0 }, params: { ...initialParams(typeKey, 'advanced'), ...params }, bypassed: false }
  return processSide(node, input, { ...CTX, ...ctx })
}

const out = (...args: Parameters<typeof run>) => run(...args).out

describe('sources', () => {
  it('send their level', () => {
    expect(out('line-in', S)).toBe(-10)
    expect(out('line-in', S, { levelDb: 4 })).toBe(4)
    expect(out('instrument', S)).toBe(-30)
    expect(run('instrument', S).domain).toBe('analog')
  })

  it('a microphone on its own picks up a voice at its usual level', () => {
    expect(out('mic', S, {}, { fed: false })).toBe(-60)
    expect(out('mic', S, { sensitivityDb: -50 }, { fed: false })).toBe(-50)
  })

  it('a microphone in front of a Guitar Amp follows how loud the amp plays', () => {
    expect(out('mic', -30)).toBe(-60)
    expect(out('mic', -24)).toBe(-54)
    expect(out('mic', S)).toBe(S)
  })
})

describe('Gain', () => {
  it('as a Preamp adds its preamp gain, up to the clip level', () => {
    expect(out('gain', -60, {}, { preamp: true })).toBe(-20)
    expect(out('gain', -60, { preampDb: 55, gainDb: -10 }, { preamp: true })).toBe(-5)
    expect(out('gain', -10, { preampDb: 60 }, { preamp: true })).toBe(20)
  })

  it('anywhere else adds its gain, up to the clip level', () => {
    expect(out('gain', -10)).toBe(-10)
    expect(out('gain', -10, { gainDb: 6, preampDb: 60 })).toBe(-4)
    expect(out('gain', 10, { gainDb: 20 })).toBe(20)
    expect(out('gain', -10, { gainDb: -59 })).toBe(-69)
  })

  it('turned all the way down is off', () => {
    expect(out('gain', -10, { gainDb: -60 })).toBe(S)
  })
})

describe('cards that pass the level on', () => {
  it('a fader adds its setting', () => {
    expect(out('fader', -10)).toBe(-10)
    expect(out('fader', -10, { faderDb: 10 })).toBe(0)
    expect(out('fader', -10, { faderDb: -100 })).toBe(-110)
  })

  it('a pad takes 20 dB off while it is in', () => {
    expect(out('pad', 4)).toBe(-16)
    expect(out('pad', 4, { engaged: false })).toBe(4)
  })

  it('a switch passes it or nothing', () => {
    expect(out('switch', -10)).toBe(-10)
    expect(out('switch', -10, { on: false })).toBe(S)
  })

  it('the Pre / Post switch and Pan pass on what reaches them (the engine picks and spreads it)', () => {
    expect(out('relay', -12)).toBe(-12)
    expect(out('pan', -12)).toBe(-12)
  })

  it('a DI Box brings an instrument down to mic level on its XLR Out', () => {
    expect(out('di-box', -30)).toBe(-50)
    expect(out('di-box', S)).toBe(S)
  })
})

describe('amplifiers and speakers', () => {
  it('an Amplifier only turns down, and fully down is off', () => {
    expect(out('amp', -10)).toBe(-10)
    expect(out('amp', -10, { gainDb: 6 })).toBe(-10)
    expect(out('amp', -10, { gainDb: -6 })).toBe(-16)
    expect(out('amp', -10, { gainDb: -60 })).toBe(S)
  })

  it('a stereo Amplifier has its own Right volume, which follows the Left until turned', () => {
    expect(out('amp', -10, { gainDb: -6 }, { side: 'r' })).toBe(-16)
    expect(out('amp', -10, { gainDb: -6, gainDbR: -2 }, { side: 'r' })).toBe(-12)
    expect(out('amp', -10, { gainDb: -6, gainDbR: -2 }, { side: 'l' })).toBe(-16)
  })

  it('a Guitar Amp plays the guitar turned up or down by its Volume', () => {
    expect(out('guitar-amp', -30)).toBe(-30)
    expect(out('guitar-amp', -30, { volumeDb: 6 })).toBe(-24)
  })

  it('speakers play what reaches them, turned up or down', () => {
    expect(out('active-speaker', -10)).toBe(-10)
    expect(out('active-speaker', -10, { volumeDb: -4 })).toBe(-14)
    expect(out('speaker', -10, { outputTrimDb: -2 })).toBe(-12)
  })

  it('none of them takes a digital signal', () => {
    const digital = { domain: 'digital' } as const
    expect(run('amp', -28, {}, digital)).toEqual({ out: S, domain: 'digital', condition: 'digitalToAmp' })
    expect(run('guitar-amp', -28, {}, digital)).toEqual({ out: S, domain: 'digital', condition: 'digitalToSpeaker' })
    expect(run('speaker', -28, {}, digital)).toEqual({ out: S, domain: 'digital', condition: 'digitalToSpeaker' })
    expect(run('active-speaker', -28, {}, digital)).toEqual({ out: S, domain: 'digital', condition: 'digitalToSpeaker' })
  })
})

describe('ADC / DAC', () => {
  it('move a level between dBu and dBFS by the alignment (18 dB unless set)', () => {
    expect(run('adc', 0)).toEqual({ out: -18, domain: 'digital' })
    expect(run('adc', 0, { alignmentDb: 20 })).toEqual({ out: -20, domain: 'digital' })
    expect(run('dac', -18, {}, { domain: 'digital' })).toEqual({ out: 0, domain: 'analog' })
    expect(run('adc', S).out).toBe(S)
  })

  it('take only the domain they convert from', () => {
    expect(run('adc', -28, {}, { domain: 'digital' })).toEqual({ out: S, domain: 'digital', condition: 'adcExpectsAnalog' })
    expect(run('dac', -10)).toEqual({ out: S, domain: 'analog', condition: 'dacExpectsDigital' })
  })
})

describe('buses', () => {
  it('turn what arrives (already added up) up or down by their fader', () => {
    expect(out('master-bus', -4)).toBe(-4)
    expect(out('aux-bus', -4, { faderDb: -6 })).toBe(-10)
    expect(out('matrix-bus', -4, { faderDb: 3 })).toBe(-1)
    expect(out('master-bus', S, { faderDb: 6 })).toBe(S)
  })

  it('cannot add analog and digital signals together', () => {
    expect(run('aux-bus', -4, {}, { mixedDomains: true })).toEqual({ out: S, domain: 'analog', condition: 'domainMixedBus' })
  })

  it('work in the domain they are fed', () => {
    expect(run('master-bus', -30, {}, { domain: 'digital' })).toEqual({ out: -30, domain: 'digital' })
  })
})

describe('filters: the level change of pink noise through them', () => {
  it('High-Pass Filter', () => {
    expect(out('hpf', -10)).toBeCloseTo(-11.00, 2)
    expect(out('hpf', -10, { cutoffHz: 200 })).toBeCloseTo(-11.78, 2)
    expect(out('hpf', -10, { cutoffHz: 20 })).toBe(-10)
  })

  it('Equalizer', () => {
    expect(out('eq', -10)).toBe(-10)
    const bands: EQBand[] = [
      { freqHz: 200,  gainDb: 3,  Q: 1.4, type: 'low-shelf' },
      { freqHz: 500,  gainDb: 0,  Q: 1.4, type: 'bell' },
      { freqHz: 1000, gainDb: -2, Q: 1.4, type: 'bell' },
      { freqHz: 8000, gainDb: 2,  Q: 1.4, type: 'high-shelf' },
    ]
    expect(out('eq', -10, { bands })).toBeCloseTo(-8.76, 2)
  })

  it('Graphic EQ: one band, and the right side copying the left until touched', () => {
    expect(out('graphic-eq', -10)).toBe(-10)
    // +6 dB at 1 kHz (band 17)
    expect(out('graphic-eq', -10, { b17: 6 })).toBeCloseTo(-9.43, 2)
    expect(out('graphic-eq', -10, { b17: 6 }, { side: 'r' })).toBeCloseTo(-9.43, 2)
    expect(out('graphic-eq', -10, { b17: 6, r17: 0 }, { side: 'r' })).toBe(-10)
  })
})

describe('dynamics', () => {
  it('compressor: above the threshold every `ratio` dB comes out as 1, then the makeup gain', () => {
    const comp = compressor(-20, 4, 3)
    expect(comp(-30)).toEqual({ out: -27, gainReductionDb: 0 })
    expect(comp(-20)).toEqual({ out: -17, gainReductionDb: 0 })
    expect(comp(-8)).toEqual({ out: -14, gainReductionDb: 9 })
    expect(comp(S)).toEqual({ out: S, gainReductionDb: 0 })
  })

  it('noise gate: closed below the threshold, turned down by its Range', () => {
    const gate = noiseGate(-40, -80)
    expect(gate(-40)).toEqual({ out: -40, gainReductionDb: 0 })
    expect(gate(-41)).toEqual({ out: -121, gainReductionDb: 80 })
    expect(noiseGate(-40, -20)(-50)).toEqual({ out: -70, gainReductionDb: 20 })
    expect(gate(S)).toEqual({ out: S, gainReductionDb: 0 })
  })

  it('limiter: nothing above the ceiling, then the makeup gain', () => {
    expect(limiter(-3, 0)(10)).toEqual({ out: -3, gainReductionDb: 13 })
    expect(limiter(-3, 2)(10)).toEqual({ out: -1, gainReductionDb: 13 })
    expect(limiter(-3, 0)(-10)).toEqual({ out: -10, gainReductionDb: 0 })
  })

  it('the cards use the same curves, in the domain they are fed', () => {
    expect(run('comp', 0)).toEqual({ out: -10, domain: 'analog', gainReductionDb: 10 })
    expect(run('noise-gate', -60, {}, { domain: 'digital' })).toEqual({ out: -140, domain: 'digital', gainReductionDb: 80 })
    expect(run('limiter', 0, { thresholdDb: -6, makeupGainDb: 1 })).toEqual({ out: -5, domain: 'analog', gainReductionDb: 6 })
  })

  it('de-esser: 8:1 above its threshold', () => {
    expect(run('deesser', 0)).toEqual({ out: -17.5, domain: 'analog', gainReductionDb: 17.5 })
    expect(run('deesser', -30)).toEqual({ out: -30, domain: 'analog', gainReductionDb: 0 })
  })
})

describe('Pan and Balance', () => {
  it('Pan spreads one channel over L / R at equal power: −3 dB each side in the centre', () => {
    const centre = panSides(50, -20)
    expect(centre.l).toBeCloseTo(-23.01, 2)
    expect(centre.r).toBeCloseTo(-23.01, 2)
    const quarter = panSides(25, -20)
    expect(quarter.l).toBeCloseTo(-20.69, 2)
    expect(quarter.r).toBeCloseTo(-28.34, 2)
    expect(panSides(0, -20)).toEqual({ l: -20, r: S })
    expect(panSides(100, -20).l).toBe(S)
    expect(panSides(100, -20).r).toBeCloseTo(-20, 2)
    expect(panSides(50, S)).toEqual({ l: S, r: S })
  })

  it('Balance keeps both sides in the centre and fades only the other side', () => {
    expect(balanceSides(50, -10, -12)).toEqual({ l: -10, r: -12 })
    const right = balanceSides(75, -10, -12)
    expect(right.l).toBeCloseTo(-16.02, 2)
    expect(right.r).toBe(-12)
    expect(balanceSides(0, -10, -12)).toEqual({ l: -10, r: S })
    expect(balanceSides(100, -10, -12)).toEqual({ l: S, r: -12 })
  })
})
