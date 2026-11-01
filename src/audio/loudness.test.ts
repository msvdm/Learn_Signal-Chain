import { describe, expect, it } from 'bun:test'
import { integratedLoudness } from './loudness'

// D38: integrated loudness (BS.1770) from the K-weighted mean square of each 10 ms slice of a loop.

const SLICE = 0.01
/** A loop of `n` slices, every one at mean square `p` */
const steady = (p: number, n = 1000) => new Float32Array(n).fill(p)

describe('integrated loudness (D38)', () => {
  it('of a steady sound: −0.691 + 10·log10 of its mean square, each channel counted in full', () => {
    expect(integratedLoudness([steady(0.01)], SLICE)).toBeCloseTo(-20.691, 3)
    // The same in both channels: 3 dB louder
    expect(integratedLoudness([steady(0.01), steady(0.01)], SLICE)).toBeCloseTo(-17.681, 3)
  })

  // (The blocks across each edge of the sound are partly filled: a quarter of a dB under it)
  it('leaves the pauses out: a sound half the loop long reads nearly as loud as the sound, not 3 dB under', () => {
    const half = new Float32Array(1000).map((_, i) => (i < 500 ? 0.01 : 0))
    expect(integratedLoudness([half], SLICE)).toBeCloseTo(-20.94, 2)
  })

  it('leaves out what is more than 10 LU under the rest: a quiet tail does not pull it down', () => {
    // 80 % at −20.7 LUFS, 20 % 30 dB under it: −20.85 (a plain average: −21.66)
    const tail = new Float32Array(1000).map((_, i) => (i < 800 ? 0.01 : 0.00001))
    expect(integratedLoudness([tail], SLICE)).toBeCloseTo(-20.85, 2)
  })

  it('is −∞ for silence, and for a sound under −70 LUFS', () => {
    expect(integratedLoudness([steady(0)], SLICE)).toBe(-Infinity)
    expect(integratedLoudness([steady(1e-8)], SLICE)).toBe(-Infinity)
    expect(integratedLoudness([], SLICE)).toBe(-Infinity)
  })
})
