import { describe, expect, it } from 'bun:test'
import type { SideLevels } from './levels'
import type { WireSignal } from './chain'
import type { StageResult } from './engine'
import type { MeasuredStage } from './measured'
import type { MeterFrames, MovingStage } from './moving'
import { liveStageOf, readingAt, shiftOf } from './moving'

// The meters' movement between a change and the next render: the render's frames, moved by the
// number engine's step since (as the still readings are, decision D9).

const side = (peak: number, rms: number, noise = -80): SideLevels => ({ peak, rms, noise, hum: -Infinity })
const mono = (s: SideLevels): WireSignal => ({ kind: 'mono', l: s, r: s })
const stereo = (l: SideLevels, r: SideLevels): WireSignal => ({ kind: 'stereo', l, r })

/** Frames of a steady signal: `rms`, `peak` and the hold at the peak, every slice. */
const frames = (rms: number, peak: number): MeterFrames => ({
  rms: new Float32Array(10).fill(rms), peak: new Float32Array(10).fill(peak), hold: new Float32Array(10).fill(peak),
})

const stage = (inSig: WireSignal, out: WireSignal, more: Partial<StageResult> = {}): StageResult =>
  ({ in: inSig, out, health: 'good', domain: 'analog', inDomain: 'analog', ...more })

describe('how far the movement is moved', () => {
  it('what is shown less what was measured; both silent: not at all', () => {
    expect(shiftOf(side(2, -10), side(-4, -16))).toEqual({ rms: 6, peak: 6 })
    expect(shiftOf(side(-Infinity, -Infinity), side(-Infinity, -Infinity))).toEqual({ rms: 0, peak: 0 })
  })

  it('silent on one side of the change only: it cannot be moved (it stays still)', () => {
    expect(shiftOf(side(-Infinity, -Infinity), side(2, -10))).toBe(null)
    expect(shiftOf(side(2, -10), side(-Infinity, -Infinity))).toBe(null)
  })
})

describe('a card ready to play', () => {
  const measured: MeasuredStage = { in: mono(side(2, -10)), out: mono(side(-4, -16)), gainReductionDb: 6, curveIn: side(2, -10) }
  const moving: MovingStage = {
    in: { l: frames(-10, 2), r: frames(-10, 2) },
    out: { l: frames(-16, -4), r: frames(-16, -4) },
    reduction: new Float32Array(10).fill(6),
    curveIn: frames(-10, 2),
    curveOut: frames(-16, -4),
  }

  it('as rendered: the frames as they are', () => {
    const live = liveStageOf(stage(measured.in, measured.out, { gainReductionDb: 6, curveIn: side(2, -10), curveOut: side(-4, -16) }), measured, moving)
    expect(readingAt(live.out!.l, 3)).toEqual({ rms: -16, peak: -4, hold: -4 })
    expect(live.reduction?.shift).toBe(0)
    expect(readingAt(live.curve!.in, 0).rms).toBe(-10)
  })

  it('a fader before it turned down 6 dB: everything moves down 6 dB at once', () => {
    const shown = stage(mono(side(-4, -16)), mono(side(-8, -20)), { gainReductionDb: 4, curveIn: side(-4, -16), curveOut: side(-8, -20) })
    const live  = liveStageOf(shown, measured, moving)
    expect(readingAt(live.in!.l, 0)).toEqual({ rms: -16, peak: -4, hold: -4 })
    expect(readingAt(live.out!.l, 0)).toEqual({ rms: -20, peak: -8, hold: -8 })
    expect(live.reduction?.shift).toBe(-2)
    expect(readingAt(live.curve!.out, 0).rms).toBe(-20)
  })

  it('switched to stereo since the render: its sides are not the frames’ — it stays still until the next', () => {
    const shown = stage(stereo(side(2, -10), side(2, -10)), stereo(side(-4, -16), side(-4, -16)))
    const live  = liveStageOf(shown, measured, moving)
    expect(live.in).toBeUndefined()
    expect(live.out).toBeUndefined()
  })

  it('silent now (a switch turned off before it): still', () => {
    const silent = side(-Infinity, -Infinity)
    expect(liveStageOf(stage(mono(silent), mono(silent)), measured, moving).out).toBeUndefined()
  })

  it('the hold is never shown under the peak', () => {
    const odd: MovingStage = { out: { l: { ...frames(-16, -4), hold: new Float32Array(10).fill(-30) }, r: frames(-16, -4) } }
    const live = liveStageOf(stage(measured.in, measured.out), measured, odd)
    expect(readingAt(live.out!.l, 0).hold).toBe(-4)
  })
})
