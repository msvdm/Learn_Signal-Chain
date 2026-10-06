import { describe, expect, it } from 'bun:test'
import {
  ALIGNMENT_DB, CLIP_DBU, HUM_DBU, SILENCE_DB, SILENT, SPL_DB, TAPER_UNITY, UNITY_DBU,
  ceilingOf, crestOf, dbToPercent, formatDb, formatSpl, getHealth, headroomOf, healthColor, hissOf, humStrength, louder, shifted, snrOf,
  sumNoiseToDb, sumSides, sumSignalsToDb, taperToDb,
} from './levels'
import { AT_THE_MIC_DB, GUITAR_REF_DB } from './process'
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
  it('dbToPercent maps −60 … +20 onto the bar, held at both ends', () => {
    expect(dbToPercent(-60)).toBe(0)
    expect(dbToPercent(-20)).toBe(50)
    expect(dbToPercent(20)).toBe(100)
    expect(dbToPercent(S)).toBe(0)
    expect(dbToPercent(30)).toBe(100)
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

  it('silence reads −∞', () => {
    expect(formatSpl(-Infinity, SPL_DB.mic!)).toBe('-∞ dB SPL')
  })
})
