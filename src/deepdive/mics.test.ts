import { describe, expect, test } from 'bun:test'
import {
  MIC_KINDS, PIEZO_LOAD_MOHM, RIBBON_STEP_UP, SENSITIVITY, SOUND_DB_SPL, SOUND_PA,
  airAt, dbuOf, partAt, partSpeed, peakMv, pressureAt, ribbonOwnMv, timesDynamic, voltageAt,
} from './mics'
import { getHealth } from '../signal/levels'
import { rad } from './wave'

// The numbers Microphone types says (Deep dive, D46): a change that moves one of them changes a
// text on the picture — update both.

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

describe('the sound', () => {
  test('94 dB SPL is 1 pascal on average (20 µPa × 10^(94/20))', () => {
    expect(round2(20e-6 * 10 ** (SOUND_DB_SPL / 20))).toBe(SOUND_PA)
  })

  test('at 0° the air passes its middle, moving fastest, and its pressure is highest', () => {
    expect(airAt(0)).toBe(0)
    expect(pressureAt(0)).toBe(1)
    expect(round2(pressureAt(rad(90)))).toBe(0)
  })
})

describe('each microphone, for the same sound', () => {
  test('its peaks, as the picture says them', () => {
    expect(round2(peakMv('dynamic'))).toBe(2.62)
    expect(round2(peakMv('condenser'))).toBe(39.6)
    expect(round2(peakMv('ribbon'))).toBe(2.83)
    expect(round2(peakMv('piezo'))).toBe(14.85)
  })

  test('the ribbon alone gives under a tenth of a millivolt; its transformer × 30 makes it a dynamic’s', () => {
    expect(RIBBON_STEP_UP).toBe(30)
    expect(round2(ribbonOwnMv(0) * 1000)).toBe(94.28) // µV
    expect(round1(timesDynamic('ribbon'))).toBe(1.1)
  })

  test('a condenser gives about 15 times a dynamic’s voltage, a piezo about 6 times', () => {
    expect(round1(timesDynamic('condenser'))).toBe(15.1)
    expect(round1(timesDynamic('piezo'))).toBe(5.7)
  })

  test('the piezo into a Hi-Z input: 1 MΩ', () => {
    expect(PIEZO_LOAD_MOHM).toBe(1)
  })

  test('in dBu, judged as the canvas judges a signal: the dynamic and the ribbon too quiet, the condenser and the piezo good', () => {
    const dbu = (kind: (typeof MIC_KINDS)[number]) => round1(dbuOf(SENSITIVITY[kind] * SOUND_PA))
    expect(dbu('dynamic')).toBe(-52.4)
    expect(dbu('condenser')).toBe(-28.8)
    expect(dbu('ribbon')).toBe(-51.8)
    expect(dbu('piezo')).toBe(-37.4)
    expect(getHealth(dbuOf(SENSITIVITY.dynamic), 'analog')).toBe('too-quiet')
    expect(getHealth(dbuOf(SENSITIVITY.ribbon), 'analog')).toBe('too-quiet')
    expect(getHealth(dbuOf(SENSITIVITY.condenser), 'analog')).toBe('good')
    expect(getHealth(dbuOf(SENSITIVITY.piezo), 'analog')).toBe('good')
  })
})

describe('the same transformation, four ways', () => {
  test('all four voltages follow the pressure, in step', () => {
    for (const kind of MIC_KINDS) {
      for (const deg of [0, 30, 90, 135, 200, 270, 333]) {
        expect(voltageAt(kind, rad(deg)) / peakMv(kind)).toBeCloseTo(pressureAt(rad(deg)), 9)
      }
    }
  })

  test('a dynamic’s and a ribbon’s part moves with the air; its voltage follows its speed', () => {
    for (const kind of ['dynamic', 'ribbon'] as const) {
      for (const deg of [0, 45, 120, 250]) {
        const r = rad(deg), h = 1e-6
        expect(partAt(kind, r)).toBeCloseTo(airAt(r), 9)
        // its speed is how fast its place changes
        expect((partAt(kind, r + h) - partAt(kind, r - h)) / (2 * h)).toBeCloseTo(partSpeed(kind, r), 6)
        expect(voltageAt(kind, r) / peakMv(kind)).toBeCloseTo(partSpeed(kind, r), 9)
      }
    }
    // at 0° it passes its middle, moving fastest: its voltage highest
    expect(partAt('dynamic', 0)).toBe(0)
    expect(round2(voltageAt('dynamic', 0))).toBe(2.62)
  })

  test('a condenser’s and a piezo’s part is pushed in by the pressure; its voltage follows how far', () => {
    for (const kind of ['condenser', 'piezo'] as const) {
      for (const deg of [0, 45, 120, 250]) {
        const r = rad(deg), h = 1e-6
        expect(partAt(kind, r)).toBeCloseTo(pressureAt(r), 9)
        expect((partAt(kind, r + h) - partAt(kind, r - h)) / (2 * h)).toBeCloseTo(partSpeed(kind, r), 6)
        expect(voltageAt(kind, r) / peakMv(kind)).toBeCloseTo(partAt(kind, r), 9)
      }
    }
    // at 0° pushed in furthest, standing still for a moment: its voltage highest
    expect(partAt('condenser', 0)).toBe(1)
    expect(partSpeed('condenser', 0) === 0).toBe(true)
  })
})
