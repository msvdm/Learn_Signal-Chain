import { describe, expect, it } from 'bun:test'
import { DIGITAL_FLOW, morseDash, morsePeriod, wireLook } from './wireLook'
import { SOUND_PORT } from '../data/nodeRegistry'

// A wire's look is what it carries (the user's call, 2026-10-29): dashes, dashes and dots, waves

describe('what a wire carries', () => {
  it('sound in the air: from a Sound output, whatever else is known', () => {
    expect(wireLook({ sourceHandle: SOUND_PORT }, 'analog', false)).toBe('sound')
  })

  it('digital: where its output sends numbers, or a USB wire (at Beginner, where no signal is worked out, too)', () => {
    expect(wireLook({ sourceHandle: 'out' }, 'digital', false)).toBe('digital')
    expect(wireLook({ sourceHandle: 'to-pc' }, 'analog', true)).toBe('digital')
  })

  it('analog: everything else', () => {
    expect(wireLook({ sourceHandle: 'out' }, 'analog', false)).toBe('analog')
  })
})

describe("a digital wire's dashes and dots", () => {
  it('a dash, two dots, a dash, a dot', () => {
    expect(morseDash(1)).toBe('8 8 0 8 0 8 8 8 0 12')
  })

  it('at every size drawn (1: a wire, 2: stereo or zoomed out, 4: both) a period divides the flow, so it loops smoothly', () => {
    for (const unit of [1, 2, 4]) expect(DIGITAL_FLOW % morsePeriod(unit)).toBe(0)
  })
})
