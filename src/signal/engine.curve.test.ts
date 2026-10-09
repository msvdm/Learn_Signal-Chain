import { describe, expect, it } from 'bun:test'
import { CLIP_DBU } from './levels'
import { LINE_NOISE_DBU, compressor, limiter, noiseGate } from './process'
import { card, curveIn, curveOut, expectDb, expectMarksLeave, expectSide, leaving, signalOf, wire } from '../../test/chains'

// ── The marks on a dynamics card's curve ────────────────────────────────────────
// A Compressor, Noise Gate or Limiter draws the peaks, the average and the noise of what goes into
// its curve (curveIn: the louder side arriving — its own noise comes after its curve, D18), each
// where the curve sends it, then its own noise added. Those must be what leaves the card (curveOut:
// the louder side leaving), or the marks and the meters disagree.

describe("the marks on a dynamics card's curve: what goes in, and where the card sends it", () => {
  // Mic → Preamp +50: a voice at −10 dBu, peaks at +2, noise at −73.86. D9: the number engine sends
  // each through the curve; D18: each card adds its own noise (−95) after it.
  const result = signalOf([
    card('mic', 'mic'),
    card('pre', 'gain', { preampDb: 50 }),
    card('comp', 'comp', { thresholdDb: -20, ratio: 4, makeupGainDb: 6 }),
    card('gate', 'noise-gate'),
    card('high', 'noise-gate', { thresholdDb: 0 }),
    card('lim', 'limiter', { thresholdDb: -3, makeupGainDb: 10 }),
    card('hot', 'comp', { thresholdDb: 0, ratio: 1, makeupGainDb: 20 }),
    card('off', 'comp', {}, true),
    card('fader', 'fader'),
  ], [
    wire('mic', 'pre'),
    ...['comp', 'gate', 'high', 'lim', 'hot', 'off', 'fader'].map((id) => wire('pre', id)),
  ])

  it('go in as they arrive: a dynamics card adds its own noise after its curve (D18)', () => {
    expectSide(curveIn(result.stages.comp), [2, -10, -73.86])
    expectSide(curveIn(result.stages.gate), [2, -10, -73.86])
  })

  it('a compressor: the peaks come down further than the average — 12 dB apart in, 3 out (D9)', () => {
    expectSide(curveOut(result.stages.comp), [-8.5, -11.5, -67.86])
    expectMarksLeave(result, 'comp', compressor(-20, 4, 6))
  })

  it('a noise gate with its threshold between the noise and the music: only the noise drops, to its own floor', () => {
    expectSide(curveOut(result.stages.gate), [2, -10, -95])
    expectMarksLeave(result, 'gate', noiseGate(-40, -80))
  })

  it('a noise gate set above the average: it cuts into the music, only the peaks get through (D9)', () => {
    expectSide(curveOut(result.stages.high), [2, -90, -95])
    expectMarksLeave(result, 'high', noiseGate(0, -80))
  })

  it('a limiter: the peaks stop at its ceiling, then the makeup gain lifts all three (D9)', () => {
    expectSide(curveOut(result.stages.lim), [7, 0, -63.86])
    expectMarksLeave(result, 'lim', limiter(-3, 10))
  })

  it('a peak the card sends past the clip level is flattened there (the top of the curve)', () => {
    expectDb(curveOut(result.stages.hot).peak, CLIP_DBU)
    expectMarksLeave(result, 'hot', compressor(0, 1, 20))
  })

  it('bypassed: it is not at work (no turning down: its card puts the marks through the curve) — the marks show what arrives', () => {
    expect(result.stages.off.gainReductionDb).toBeUndefined()
    expectSide(curveIn(result.stages.off), [2, -10, -73.86])
  })

  it('only dynamics cards at work turn down', () => {
    expect(result.stages.fader.gainReductionDb).toBeUndefined()
    expect(result.stages.pre.gainReductionDb).toBeUndefined()
  })

  it("a gate does not hear its own noise (D18): set over a line's (−90), it closes on it — its own floor stays", () => {
    const line = signalOf([card('line', 'line-in'), card('gate', 'noise-gate', { thresholdDb: -85 })], [wire('line', 'gate')])
    expectDb(curveIn(line.stages.gate).noise, -90)
    expectDb(leaving(line, 'gate').noise, LINE_NOISE_DBU)
    expectMarksLeave(line, 'gate', noiseGate(-85, -80))
  })

  it('in stereo (linked): the louder side goes in, and its marks are what leaves on that side', () => {
    // Pan a quarter left: the left side 7.66 dB louder than the right
    const panned = signalOf([
      card('line', 'line-in'),
      card('pan', 'pan', { panPosition: 25 }),
      card('comp', 'comp', { thresholdDb: -20, ratio: 4 }),
    ], [wire('line', 'pan'), wire('pan', 'comp')])
    const comp = panned.stages.comp
    expectDb(curveIn(comp).rms, Math.max(comp.in.l.rms, comp.in.r.rms))
    expectMarksLeave(panned, 'comp', compressor(-20, 4, 0))
  })
})
