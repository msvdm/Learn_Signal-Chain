import { describe, expect, it } from 'bun:test'
import type { EQBand, NodeParamValue, TypeKey } from '../data/nodeRegistry'
import { initialParams } from '../data/nodeRegistry'
import type { SideLevels } from './levels'
import { SILENT } from './levels'
import type { SideContext, SideResult } from './process'
import {
  AMP_NOISE_DBU, BUS_NOISE_DBU, CONVERTER_NOISE_DBFS, GAIN_FLOOR_DBU, GUITAR_AMP_NOISE_DBU, LINE_NOISE_DBU,
  balanceSides, compressor, flattenPeaks, limiter, noiseGate, panSides, processSide,
} from './process'

// What each card does to one channel, on its own (the engine tests, engine.test.ts, put the cards
// together). processSide works on a peak, an average and a noise: `run` passes the average in and
// reads it out, so the numbers here are the averages. Peaks and noise: `levels` and the tests at the end.

const S = -Infinity

const CTX: SideContext = { domain: 'analog', mixedDomains: false, side: null, preamp: false, fed: true }

/** A card of this type with its starting params (`params` on top). */
const cardOf = (typeKey: TypeKey, params: Record<string, NodeParamValue>) =>
  ({ id: typeKey, typeKey, position: { x: 0, y: 0 }, params: { ...initialParams(typeKey, 'advanced'), ...params }, bypassed: false })

/** One channel through a card of this type, with its starting params (`params` on top). */
function run(
  typeKey: TypeKey,
  input: number,
  params: Record<string, NodeParamValue> = {},
  ctx: Partial<SideContext> = {},
): Omit<SideResult, 'out'> & { out: number } {
  const result = processSide(cardOf(typeKey, params), { peak: input, rms: input, noise: S, hum: S }, { ...CTX, ...ctx })
  return { ...result, out: result.out.rms }
}

/** Every reading of one channel through a card: what leaves it. */
function levels(
  typeKey: TypeKey,
  input: SideLevels,
  params: Record<string, NodeParamValue> = {},
  ctx: Partial<SideContext> = {},
): SideLevels {
  return processSide(cardOf(typeKey, params), input, { ...CTX, ...ctx }).out
}

/** [peak, average, noise], no hum. */
const sig = (peak: number, rms: number, noise: number): SideLevels => ({ peak, rms, noise, hum: S })

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

  it('after an ADC stops at the digital ceiling, 0 dBFS — not at +20', () => {
    expect(out('gain', -10, { gainDb: 20 }, { domain: 'digital' })).toBe(0)
    expect(levels('gain', sig(-16, -28, S), { gainDb: 20 }, { domain: 'digital' })).toEqual(sig(0, -8, S))
    expect(out('gain', -28, { gainDb: 10 }, { domain: 'digital' })).toBe(-18)
  })

  it('turned all the way down is off', () => {
    expect(out('gain', -10, { gainDb: -60 })).toBe(S)
  })
})

describe('cards that pass the level on', () => {
  it('a fader adds its setting', () => {
    expect(out('fader', -10)).toBe(-10)
    expect(out('fader', -10, { faderDb: 10 })).toBe(0)
    expect(out('fader', -10, { faderDb: -98 })).toBe(-108)
  })

  it('a fader at the bottom of its travel mutes the signal (−∞, like the bottom of a meter)', () => {
    expect(out('fader', -10, { faderDb: -100 })).toBe(S)
    const muted = levels('fader', sig(2, -10, -80), { faderDb: -100 })
    expect(muted.peak).toBe(S)
    // What arrives is gone, hiss and all; its own output stage still hisses (D18)
    expect(muted.noise).toBe(LINE_NOISE_DBU)
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

  // Changed on purpose (2026-10-06): its Volume goes to 11 — 1 plays a guitar at −16 (100 dB SPL),
  // 1.5 dB more a step, 11 at −1 (115 dB SPL); 0 is silent
  it('a Guitar Amp plays the guitar louder as its Volume goes up to 11', () => {
    expect(out('guitar-amp', -30)).toBe(-10)
    expect(out('guitar-amp', -30, { volume: 1 })).toBe(-16)
    expect(out('guitar-amp', -30, { volume: 11 })).toBe(-1)
    expect(out('guitar-amp', -30, { volume: 0 })).toBe(S)
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
    // Only the sibilance (its "s" sounds 6 dB under the average) is turned down, 8:1 over the threshold (−20)
    expect(run('deesser', 10)).toEqual({ out: 10, domain: 'analog', gainReductionDb: 21 })
    expect(run('deesser', -20)).toEqual({ out: -20, domain: 'analog', gainReductionDb: 0 })
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

describe('sources: their peaks above the average, their noise below it', () => {
  it('a microphone: a voice (peaks 12 dB up), the room and its own hiss 66 dB down', () => {
    expect(levels('mic', SILENT, {}, { fed: false })).toEqual(sig(-48, -60, -126))
    expect(levels('mic', SILENT, { sensitivityDb: -50 }, { fed: false })).toEqual(sig(-38, -50, -116))
  })

  it('a Line Input: keys (peaks 12 dB up), its noise 80 dB down', () => {
    expect(levels('line-in', SILENT)).toEqual(sig(2, -10, -90))
  })

  it('an Instrument: a guitar (plucks, peaks 15 dB up), the noise of its pickups 70 dB down', () => {
    expect(levels('instrument', SILENT)).toEqual(sig(-15, -30, -100))
  })

  it('set to Drums, a Line Input plays drums: peaks 18 dB up, the same average and noise', () => {
    expect(levels('line-in', SILENT, { character: 'drums' })).toEqual(sig(8, -10, -90))
    expect(levels('line-in', SILENT, { character: 'music' })).toEqual(sig(2, -10, -90))
  })

  // Changed on purpose (2026-10-06): a Microphone's level follows how loud what it picks up is —
  // singing 10 dB above speech, drums 24 (AT_THE_MIC_DB); the room and its own hiss stay at −126
  it('a microphone hears drums 24 dB louder than speech, peaks 18 dB up; the room and its hiss stay', () => {
    expect(levels('mic', SILENT, { character: 'drums' }, { fed: false })).toEqual(sig(-18, -36, -126))
  })

  it('a voice peaks 12 dB above its average; singing reaches the microphone 10 dB louder than speech', () => {
    expect(levels('mic', SILENT, { character: 'speech' }, { fed: false })).toEqual(sig(-48, -60, -126))
    expect(levels('mic', SILENT, { character: 'singing' }, { fed: false })).toEqual(sig(-38, -50, -126))
  })

  it('a microphone set to Drums in front of a Guitar Amp hears the guitar: the amp decides the peaks', () => {
    expect(levels('mic', sig(-15, -30, -80), { character: 'drums' }).peak).toBe(-45)
  })

  it('a Generator: its sound at its level (0 dBu), its noise 90 dB down', () => {
    expect(levels('generator', SILENT)).toEqual(sig(3, 0, -90))
    expect(levels('generator', SILENT, { levelDb: -20 })).toEqual(sig(-17, -20, -110))
  })

  it('each Generator sound has its own peaks: a sine 3 dB up, noise 12, clicks 18', () => {
    const peakAbove = (sound: string) => {
      const out = levels('generator', SILENT, { sound })
      return out.peak - out.rms
    }
    expect(peakAbove('sine')).toBe(3)
    expect(peakAbove('noise')).toBe(12)
    expect(peakAbove('click')).toBe(18)
  })

  it('clicks at +10 dBu would peak at +28: flattened at the clip level, where a sine passes', () => {
    expect(levels('generator', SILENT, { sound: 'click', levelDb: 10 })).toEqual(sig(20, 10, -80))
    expect(levels('generator', SILENT, { sound: 'sine', levelDb: 10 })).toEqual(sig(13, 10, -80))
  })

  it('a microphone in front of a Guitar Amp: what the amp plays, at mic level, and the room on top', () => {
    const heard = levels('mic', sig(-15, -30, -80))
    expect(heard.peak).toBe(-45)
    expect(heard.rms).toBe(-60)
    // The amp's noise at mic level (−110) and the room (−126)
    expect(heard.noise).toBeCloseTo(-109.89, 2)
  })
})

describe('noise as on a real desk (D18): a Gain lifts its input noise, every card adds its own after its job', () => {
  const quiet = sig(-48, -60, S)

  it('a Preamp: its input noise (−128 dBu) rises with its gain once it passes its floor (−100)', () => {
    const at = (preampDb: number) => levels('gain', quiet, { preampDb }, { preamp: true }).noise
    expect(at(0)).toBeCloseTo(-99.99, 2)
    expect(at(20)).toBeCloseTo(-99.36, 2)
    expect(at(40)).toBeCloseTo(-87.73, 2)
    expect(at(60)).toBeCloseTo(-68, 2)
  })

  it('a trim (a Gain on a line): the same preamp behind a 20 dB pad — its floor turned down, its noise up from unity', () => {
    const at = (gainDb: number) => levels('gain', sig(2, -10, S), { gainDb }).noise
    expect(at(-20)).toBeCloseTo(-99.99, 2)
    expect(at(0)).toBeCloseTo(-99.36, 2)
    expect(at(20)).toBeCloseTo(-87.73, 2)
  })

  it('a Gain turned all the way down sends nothing but its own floor', () => {
    expect(levels('gain', sig(2, -10, -80), { gainDb: -60 })).toEqual({ peak: S, rms: S, noise: GAIN_FLOOR_DBU, hum: S })
  })

  it('a card never turns its own noise down: a fader pulled down leaves its floor (−95)', () => {
    expect(levels('fader', sig(2, -10, S), { faderDb: -20 }).noise).toBe(LINE_NOISE_DBU)
    // What arrives (−80) is turned down with the music, its own floor stays
    expect(levels('fader', sig(2, -10, -80), { faderDb: -20 }).noise).toBeCloseTo(-93.81, 2)
  })

  it('added to the noise that arrives as noise (+3 dB for two equal ones)', () => {
    expect(levels('eq', sig(2, -10, -95)).noise).toBeCloseTo(-91.99, 2)
  })

  it('a bus −90 dBu; an amplifier, a powered speaker −85 after their Volume; a Guitar Amp −76', () => {
    expect(levels('master-bus', sig(2, -10, S)).noise).toBe(BUS_NOISE_DBU)
    expect(levels('amp', sig(2, -10, S), { gainDb: -20 }).noise).toBe(AMP_NOISE_DBU)
    expect(levels('active-speaker', sig(2, -10, S)).noise).toBe(AMP_NOISE_DBU)
    expect(levels('guitar-amp', sig(-15, -30, S)).noise).toBe(GUITAR_AMP_NOISE_DBU)
  })

  it('passive cards add none: DI Box, Pad, the switches, Pan, a passive speaker', () => {
    for (const typeKey of ['di-box', 'pad', 'switch', 'relay', 'pan', 'speaker'] as const) {
      expect(levels(typeKey, sig(2, -10, S)).noise).toBe(S)
    }
  })

  it('none with nothing plugged in, none working digitally — the converters 112 dB under full scale', () => {
    expect(levels('fader', SILENT, {}, { fed: false }).noise).toBe(S)
    expect(levels('fader', sig(-16, -28, S), {}, { domain: 'digital' }).noise).toBe(S)
    // An ADC on its digital side, a DAC on its analog side (−94 dBu at the usual alignment)
    expect(levels('adc', sig(2, -10, S)).noise).toBe(CONVERTER_NOISE_DBFS)
    expect(levels('dac', sig(-16, -28, S), {}, { domain: 'digital' }).noise).toBe(-94)
  })
})

describe('peaks', () => {
  it('are flattened at the clip level (+20 dBu) or the digital ceiling (0 dBFS), never below the average', () => {
    expect(flattenPeaks(sig(27, 15, -60), 'analog')).toEqual(sig(20, 15, -60))
    expect(flattenPeaks(sig(5, -3, -80), 'digital')).toEqual(sig(0, -3, -80))
    expect(flattenPeaks(sig(25, 25, -60), 'analog')).toEqual(sig(25, 25, -60))
    expect(flattenPeaks(sig(2, -10, -80), 'analog')).toEqual(sig(2, -10, -80))
  })

  it('by every card: a gain pushing a line too far, a digital fader past 0 dBFS', () => {
    expect(levels('gain', sig(12, 0, S), { gainDb: 15 }).peak).toBe(20)
    expect(levels('fader', sig(-6, -18, S), { faderDb: 12 }, { domain: 'digital' }).peak).toBe(0)
  })

  it('move with the average through gains, faders and filters: the gap stays', () => {
    const out = levels('fader', sig(2, -10, S), { faderDb: -6 })
    expect(out.peak - out.rms).toBe(12)
  })
})

describe('dynamics work on every reading: the peaks, the average and the noise in the pauses', () => {
  it('a compressor turns the peaks down more than the average; the noise only gets the makeup gain', () => {
    const out = processSide(cardOf('comp', { thresholdDb: -20, ratio: 4, makeupGainDb: 3 }), sig(2, -10, -90), CTX)
    expect(out.out.peak).toBe(-11.5)
    expect(out.out.rms).toBe(-14.5)
    // The line's noise, under the threshold, only gets the makeup gain (−87); the compressor's own (−95) comes after
    expect(out.out.noise).toBeCloseTo(-86.36, 2)
    expect(out.gainReductionDb).toBe(7.5)
  })

  it('a noise gate between the noise and the signal: open for the music, closed in the pauses', () => {
    const out = levels('noise-gate', sig(2, -10, S))
    expect(out.rms).toBe(-10)
    // Nothing arrives in the pauses; its own noise comes after it (D18)
    expect(out.noise).toBe(LINE_NOISE_DBU)
  })

  it('a limiter caps the peaks and leaves an average under its ceiling alone', () => {
    expect(levels('limiter', sig(2, -10, S))).toEqual(sig(-3, -10, LINE_NOISE_DBU))
  })
})
