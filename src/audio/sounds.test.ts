import { describe, expect, it } from 'bun:test'
import { PEAKS_ABOVE } from '../signal/process'
import { LOOP_S, generatorSound, whiteNoise } from './sounds'

// The sounds made in code: one loop long, an average (RMS) of 1, their loudest moments as far above
// it as the number engine says (PEAKS_ABOVE).

const RATE = 48000

const rmsOf = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length)
const crestOf = (x: Float32Array) => 20 * Math.log10(x.reduce((m, v) => Math.max(m, Math.abs(v)), 0) / rmsOf(x))

describe("the Generator's sounds", () => {
  for (const sound of ['sine', 'noise', 'click'] as const) {
    it(`${sound}: a loop long, an RMS of 1, peaks ${PEAKS_ABOVE[sound]} dB above it`, () => {
      const x = generatorSound(sound, RATE)
      expect(x.length).toBe(LOOP_S * RATE)
      expect(rmsOf(x)).toBeCloseTo(1, 4)
      // A sine's are 3.01
      expect(Math.abs(crestOf(x) - PEAKS_ABOVE[sound])).toBeLessThan(0.02)
    })
  }

  it('clicks are silent between the beats (a gate can close there)', () => {
    const x = generatorSound('click', RATE)
    expect(x.filter((v) => Math.abs(v) < 1e-6).length / x.length).toBeGreaterThan(0.8)
  })

  it('made once, then the same every time', () => {
    expect(generatorSound('noise', RATE)).toBe(generatorSound('noise', RATE))
  })
})

describe('the hiss', () => {
  it('white noise, an RMS of 1, the same from the same seed', () => {
    const a = whiteNoise(RATE)
    expect(rmsOf(a)).toBeCloseTo(1, 4)
    expect(whiteNoise(RATE)).toEqual(a)
  })

  it('two stretches far apart do not move together: their hisses add up as powers (+3 dB)', () => {
    const x = whiteNoise(RATE)
    const shift = Math.round(0.618 * x.length)
    let sum = 0
    for (let i = 0; i < x.length; i++) {
      const v = x[i] + x[(i + shift) % x.length]
      sum += v * v
    }
    expect(10 * Math.log10(sum / x.length)).toBeCloseTo(10 * Math.log10(2), 1)
  })
})
