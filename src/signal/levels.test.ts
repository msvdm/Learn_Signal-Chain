import { describe, expect, it } from 'bun:test'
import {
  ALIGNMENT_DB, CLIP_DBU, CLIP_ZONE_DB, HUM_DBU, METER_RANGE_DB, METER_TAIL, SILENCE_DB, SILENT, SPL_DB, SPL_SCALE_DB, TAPER_UNITY, UNITY_DBU,
  ceilingOf, crestOf, dbToPercent, fitScaleMarks, formatDb, formatSpl, getHealth, headroomOf, healthColor, hissOf, humStrength, louder, meterZones,
  scaleMarks, shifted, snrOf, sumNoiseToDb, sumSides, sumSignalsToDb, taperToDb,
} from './levels'
import { AT_THE_MIC_DB, GUITAR_AMP_MAX, GUITAR_REF_DB, guitarAmpGainDb } from './process'
import { NODE_REGISTRY } from '../data/nodeRegistry'

// The dB scale: its fixed points, the health zones, how a reading is written, how signals add up,
// and the readings one side of a signal carries (peak, average, noise, hum).

const S = -Infinity

describe('the scale', () => {
  it('is built around unity (0 dBu), clips at +20 dBu, lines unity up with −18 dBFS', () => {
    expect(UNITY_DBU).toBe(0)
    expect(CLIP_DBU).toBe(20)
    expect(ALIGNMENT_DB).toBe(18)
    expect(HUM_DBU).toBe(-80)
    expect(TAPER_UNITY).toBe(75)
  })
})

describe('getHealth', () => {
  it('analog: too quiet below −40 dBu, good up to unity, hot above it, clipping from +20 dBu', () => {
    expect(getHealth(S)).toBe('too-quiet')
    expect(getHealth(-40.1)).toBe('too-quiet')
    expect(getHealth(-40)).toBe('good')
    expect(getHealth(0)).toBe('good')
    expect(getHealth(0.1)).toBe('hot')
    expect(getHealth(19.9)).toBe('hot')
    expect(getHealth(20)).toBe('clipping')
    expect(getHealth(30, 'analog')).toBe('clipping')
  })

  it('digital: the same zones 18 dB lower, but clipping from 0 dBFS', () => {
    expect(getHealth(-58.1, 'digital')).toBe('too-quiet')
    expect(getHealth(-58, 'digital')).toBe('good')
    expect(getHealth(-18, 'digital')).toBe('good')
    expect(getHealth(-17.9, 'digital')).toBe('hot')
    expect(getHealth(-0.1, 'digital')).toBe('hot')
    expect(getHealth(0, 'digital')).toBe('clipping')
  })

  it('clips as soon as the peaks reach the clip level, whatever the average', () => {
    // A voice at +8 dBu: its peaks (12 dB above) at +20
    expect(getHealth(8, 'analog', 20)).toBe('clipping')
    expect(getHealth(8, 'analog', 19.9)).toBe('hot')
    expect(getHealth(-10, 'analog', 2)).toBe('good')
    expect(getHealth(-12, 'digital', 0)).toBe('clipping')
    expect(getHealth(-12, 'digital', -0.1)).toBe('hot')
    // Left out, the peaks are the average
    expect(getHealth(19.9, 'analog', undefined)).toBe('hot')
  })

  it('has a ceiling per domain: +20 dBu analog, 0 dBFS digital', () => {
    expect(ceilingOf('analog')).toBe(CLIP_DBU)
    expect(ceilingOf('digital')).toBe(0)
  })

  it('gives each zone its colour', () => {
    expect(healthColor('clipping')).toBe('var(--signal-clipping)')
    expect(healthColor('too-quiet')).toBe('var(--signal-too-quiet)')
  })
})

describe('formatDb', () => {
  it('writes a reading with its sign, one decimal and its unit', () => {
    expect(formatDb(0)).toBe('+0.0 dBu')
    expect(formatDb(4.04)).toBe('+4.0 dBu')
    expect(formatDb(-60)).toBe('-60.0 dBu')
    expect(formatDb(-18, 'digital')).toBe('-18.0 dBFS')
    // A render's 0 dBu comes back a hair under: still "+0.0", never "-0.0"
    expect(formatDb(-0.00001)).toBe('+0.0 dBu')
    expect(formatDb(-0.04, 'digital')).toBe('+0.0 dBFS')
    expect(formatDb(-0.06)).toBe('-0.1 dBu')
  })

  it('is a real reading down to −99.9, silence below', () => {
    expect(formatDb(-99.9)).toBe('-99.9 dBu')
    expect(formatDb(SILENCE_DB)).toBe('-∞ dBu')
    expect(formatDb(-140)).toBe('-∞ dBu')
    expect(formatDb(S, 'digital')).toBe('-∞ dBFS')
  })
})

describe('sumSignalsToDb', () => {
  it('adds voltages: two equal signals give +6 dB, three +9.5 dB', () => {
    expect(sumSignalsToDb([-10])).toBeCloseTo(-10, 2)
    expect(sumSignalsToDb([-10, -10])).toBeCloseTo(-3.98, 2)
    expect(sumSignalsToDb([0, 0, 0])).toBeCloseTo(9.54, 2)
    expect(sumSignalsToDb([-10, -20])).toBeCloseTo(-7.61, 2)
  })

  it('adds nothing for a silent signal', () => {
    expect(sumSignalsToDb([-10, S])).toBeCloseTo(-10, 2)
    expect(sumSignalsToDb([S, S])).toBe(S)
    expect(sumSignalsToDb([])).toBe(S)
  })
})

describe('sumNoiseToDb', () => {
  it('adds powers: two equal noises give +3 dB, four +6 dB — noise from different places never lines up', () => {
    expect(sumNoiseToDb([-80, -80])).toBeCloseTo(-76.99, 2)
    expect(sumNoiseToDb([-80, -80, -80, -80])).toBeCloseTo(-73.98, 2)
    expect(sumNoiseToDb([-80, -90])).toBeCloseTo(-79.59, 2)
  })

  it('passes one noise on exactly, and adds nothing for silence', () => {
    expect(sumNoiseToDb([-80])).toBe(-80)
    expect(sumNoiseToDb([-80, S])).toBe(-80)
    expect(sumNoiseToDb([S])).toBe(S)
    expect(sumNoiseToDb([])).toBe(S)
  })
})

describe('one side of a signal: peak, average, noise and hum', () => {
  const voice = { peak: 2, rms: -10, noise: -74, hum: S }
  const humming = { peak: -8, rms: -20, noise: -40, hum: -40 }

  it('turned up or down, everything moves together', () => {
    expect(shifted(voice, -6)).toEqual({ peak: -4, rms: -16, noise: -80, hum: S })
    expect(shifted(voice, S)).toEqual(SILENT)
  })

  it('added on a bus: the music as voltages, the noise and the hum as noise', () => {
    const sum = sumSides([voice, voice])
    expect(sum.peak).toBeCloseTo(8.02, 2)
    expect(sum.rms).toBeCloseTo(-3.98, 2)
    expect(sum.noise).toBeCloseTo(-70.99, 2)
    expect(sum.hum).toBe(S)
    expect(sumSides([voice, humming]).hum).toBe(-40)
    expect(sumSides([])).toEqual(SILENT)
  })

  it('the louder of two sides, reading by reading', () => {
    expect(louder(voice, humming)).toEqual({ peak: 2, rms: -10, noise: -40, hum: -40 })
  })

  it('signal-to-noise: the average over the noise; headroom: the peaks under the ceiling', () => {
    expect(snrOf(voice)).toBe(64)
    expect(headroomOf(voice)).toBe(18)
    expect(headroomOf({ ...voice, peak: -6 }, 'digital')).toBe(6)
  })

  it('crest: the peaks over the average', () => {
    expect(crestOf(voice)).toBe(12)
  })

  it('the hiss: the noise with its hum taken out', () => {
    expect(hissOf(voice)).toBe(-74)
    // Hiss and hum both at −43 dBu make a noise of −40
    expect(hissOf({ ...humming, noise: sumNoiseToDb([-43, -43]), hum: -43 })).toBeCloseTo(-43, 2)
    // Nothing but hum: no hiss
    expect(hissOf(humming)).toBe(S)
    expect(hissOf(SILENT)).toBe(S)
  })
})

describe('taperToDb (the Matrix Bus send knobs)', () => {
  it('is off at 0, unity at 75, +10 dB at 100', () => {
    expect(taperToDb(0)).toBe(S)
    expect(taperToDb(-5)).toBe(S)
    expect(taperToDb(50)).toBeCloseTo(-10.5655, 3)
    expect(taperToDb(75)).toBe(0)
    expect(taperToDb(87.5)).toBeCloseTo(5, 2)
    expect(taperToDb(100)).toBe(10)
  })
})

describe('meters', () => {
  // D16: the even part −60 … +20 takes the top 90 % of the bar; the bottom 10 % (METER_TAIL) runs
  // on down to silence, so the bar's bottom is −∞ (it was −60 dBu: 0 %, −20: 50 %)
  it('dbToPercent maps −60 … +20 onto the bar above a 10 % tail down to −∞, held at both ends', () => {
    expect(dbToPercent(-60)).toBe(METER_TAIL)
    expect(dbToPercent(-20)).toBe(55)
    expect(dbToPercent(20)).toBe(100)
    expect(dbToPercent(30)).toBe(100)
    // The tail: −60 … −100 dBu (silence) squeezed into 10 %
    expect(dbToPercent(-80)).toBe(5)
    expect(dbToPercent(SILENCE_DB)).toBe(0)
    expect(dbToPercent(-120)).toBe(0)
    expect(dbToPercent(S)).toBe(0)
  })

  it('a digital meter runs −80 … 0 dBFS, then down to −∞: the top of the bar is where it clips, as analog', () => {
    expect(dbToPercent(0, 'digital')).toBe(100)
    expect(dbToPercent(ceilingOf('digital'), 'digital')).toBe(dbToPercent(ceilingOf('analog'), 'analog'))
    expect(dbToPercent(-80, 'digital')).toBe(METER_TAIL)
    expect(dbToPercent(-40, 'digital')).toBe(55)
    expect(dbToPercent(-90, 'digital')).toBe(5)
    expect(dbToPercent(S, 'digital')).toBe(0)
    // Unity on either side of a converter: within 2.25 % of the bar of each other (2 dB)
    expect(dbToPercent(UNITY_DBU - ALIGNMENT_DB, 'digital') - dbToPercent(UNITY_DBU)).toBeCloseTo(2.25, 9)
  })

  it('meterZones colours the bar at the health edges: blue, green, yellow, red in the top 2 dB', () => {
    const at = (db: number, domain: 'analog' | 'digital' = 'analog') => dbToPercent(db, domain)
    expect(meterZones()).toEqual([
      { health: 'too-quiet', from: 0, to: at(-40) },
      { health: 'good', from: at(-40), to: at(0) },
      { health: 'hot', from: at(0), to: at(CLIP_DBU - CLIP_ZONE_DB) },
      { health: 'clipping', from: at(CLIP_DBU - CLIP_ZONE_DB), to: 100 },
    ])
    // Digital: the same zones moved down by the alignment — good up to −18 dBFS, red from −2
    expect(meterZones('digital').map((z) => z.to)).toEqual([at(-58, 'digital'), at(-18, 'digital'), at(-2, 'digital'), 100])
    // Every edge is where getHealth changes its verdict
    for (const domain of ['analog', 'digital'] as const) {
      for (const zone of meterZones(domain).slice(0, 2)) {
        const edge = ceilingOf(domain) - METER_RANGE_DB + ((zone.to - METER_TAIL) / (100 - METER_TAIL)) * METER_RANGE_DB
        expect(getHealth(edge - 0.01, domain)).toBe(zone.health)
      }
    }
  })

  it('meterZones on a dB SPL meter: the colours still judge the signal in the cable', () => {
    // A Microphone (+36 on its bar): blue up to a −40 dBu signal (106 dB SPL), green above, nothing else on the bar
    expect(meterZones('analog', SPL_DB.mic! - SPL_SCALE_DB)).toEqual([
      { health: 'too-quiet', from: 0, to: dbToPercent(-4) },
      { health: 'good', from: dbToPercent(-4), to: 100 },
    ])
    // Headphones (−15): red from a +18 dBu signal (113 dB SPL) to the top of the bar
    const phones = meterZones('analog', SPL_DB.headphones! - SPL_SCALE_DB)
    expect(phones.map((z) => z.health)).toEqual(['too-quiet', 'good', 'hot', 'clipping'])
    expect(phones[3]).toEqual({ health: 'clipping', from: dbToPercent(3), to: 100 })
  })

  it('scaleMarks: every 10 dB, then −∞ — dBu, dBFS (−18 for −20) or dB SPL', () => {
    const labels = (...args: Parameters<typeof scaleMarks>) => scaleMarks(...args).map((m) => m.label)
    expect(labels()).toEqual(['+20', '+10', '0', '-10', '-20', '-30', '-40', '-50', '-60', '-∞'])
    expect(labels('digital')).toEqual(['0', '-10', '-18', '-30', '-40', '-50', '-60', '-70', '-80', '-∞'])
    expect(labels('analog', { spl: 110 })).toEqual(['130', '120', '110', '100', '90', '80', '70', '60', '50', '-∞'])
    // Each where its level sits; −∞ at the very bottom; unity strong, the clip level the top
    expect(scaleMarks().map((m) => m.at)).toEqual([100, 88.75, 77.5, 66.25, 55, 43.75, 32.5, 21.25, METER_TAIL, 0])
    expect(scaleMarks('digital').find((m) => m.strong)).toEqual({ at: dbToPercent(-18, 'digital'), label: '-18', strong: true, top: false })
    expect(scaleMarks().filter((m) => m.top).map((m) => m.label)).toEqual(['+20'])
    // dB SPL: neither (the top of the bar is not where every card clips)
    expect(scaleMarks('analog', { spl: 146 }).some((m) => m.strong || m.top)).toBe(false)
  })

  it('fitScaleMarks keeps the numbers a short meter has room for, never two on top of each other', () => {
    const labels = (length: number) => fitScaleMarks(scaleMarks(), length, 10).map((m) => m.label)
    // 100 px (a card's meter): 10 dB is 11.25 px, the tail 10 — all of them
    expect(labels(100)).toEqual(['+20', '+10', '0', '-10', '-20', '-30', '-40', '-50', '-60', '-∞'])
    // 90 px: the tail is 9 px — −60 goes, the rest (10.1 px apart) stays
    expect(labels(90)).toEqual(['+20', '+10', '0', '-10', '-20', '-30', '-40', '-50', '-∞'])
    // 60 px: every other one, from the top; unity and −∞ always
    expect(labels(60)).toEqual(['+20', '0', '-20', '-40', '-∞'])
    expect(fitScaleMarks(scaleMarks('digital'), 0, 10).map((m) => m.label)).toEqual(['0', '-18', '-∞'])
  })

  it('scaleMarks zoomed out: only the top, unity and −∞', () => {
    const labels = (...args: Parameters<typeof scaleMarks>) => scaleMarks(...args).map((m) => m.label)
    expect(labels('analog', { overview: true })).toEqual(['+20', '0', '-∞'])
    expect(labels('digital', { overview: true })).toEqual(['0', '-18', '-∞'])
    expect(labels('analog', { spl: 110, overview: true })).toEqual(['130', '110', '-∞'])
  })

  it('humStrength grows from 0 where a hum starts to 1 at 60 dB louder', () => {
    expect(humStrength(HUM_DBU)).toBe(0)
    expect(humStrength(-50)).toBe(0.5)
    expect(humStrength(-20)).toBe(1)
    expect(humStrength(-100)).toBe(0)
    expect(humStrength(0)).toBe(1)
  })
})

describe('dB SPL — the sound in the air, on a Microphone, a Guitar Amp, a speaker', () => {
  it('a Microphone hears speech at 86 dB SPL (its usual −60 dBu), singing at 96, drums at 110', () => {
    expect(formatSpl(-60, SPL_DB.mic!)).toBe('86 dB SPL')
    expect(formatSpl(-60 + AT_THE_MIC_DB.singing, SPL_DB.mic!)).toBe('96 dB SPL')
    expect(formatSpl(-60 + AT_THE_MIC_DB.drums, SPL_DB.mic!)).toBe('110 dB SPL')
  })

  it('a speaker fed −10 dBu plays 100 dB SPL, at the clip level 130 — a powerful PA speaker; passive the same', () => {
    expect(formatSpl(-10, SPL_DB['active-speaker']!)).toBe('100 dB SPL')
    expect(formatSpl(20, SPL_DB['active-speaker']!)).toBe('130 dB SPL')
    expect(SPL_DB.speaker).toBe(SPL_DB['active-speaker'])
  })

  it('Headphones fed −10 dBu play 85 dB SPL, the level studios mix at; 115 at most', () => {
    expect(formatSpl(-10, SPL_DB.headphones!)).toBe('85 dB SPL')
    expect(formatSpl(20, SPL_DB.headphones!)).toBe('115 dB SPL')
  })

  it('a Guitar Amp reads as loud as the Microphone in front of it hears it', () => {
    const amp = -30
    const mic = (NODE_REGISTRY.mic.defaultParams.sensitivityDb as number) + amp - GUITAR_REF_DB
    expect(amp + SPL_DB['guitar-amp']!).toBe(mic + SPL_DB.mic!)
  })

  it('a Guitar Amp plays 100 dB SPL at 1, 106 at 5, 115 at 11 (it goes to 11)', () => {
    expect(formatSpl(-30 + guitarAmpGainDb(1), SPL_DB['guitar-amp']!)).toBe('100 dB SPL')
    expect(formatSpl(-30 + guitarAmpGainDb(5), SPL_DB['guitar-amp']!)).toBe('106 dB SPL')
    expect(formatSpl(-30 + guitarAmpGainDb(GUITAR_AMP_MAX), SPL_DB['guitar-amp']!)).toBe('115 dB SPL')
  })

  it('silence reads −∞', () => {
    expect(formatSpl(-Infinity, SPL_DB.mic!)).toBe('-∞ dB SPL')
  })
})
