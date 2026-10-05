import { describe, expect, it } from 'bun:test'
import {
  ALIGNMENT_DB, CLIP_DBU, HUM_DBU, TAPER_UNITY, UNITY_DBU,
  dbToPercent, formatDb, getHealth, healthColor, humStrength, sumSignalsToDb, taperToDb,
} from './levels'

// The dB scale: its fixed points, the health zones, how a reading is written, how signals add up.

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
    expect(formatDb(-100)).toBe('-∞ dBu')
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
