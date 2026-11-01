import { describe, expect, it } from 'bun:test'
import { ANALOG_STOPS, DIGITAL_FLOW, analogShade, morseDash, morsePeriod, shadeOf, wireLook } from './wireLook'
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
  it('a dash, two dots, a dash, a dot — rectangles and squares', () => {
    expect(morseDash(1)).toBe('11 5 3 5 3 5 11 5 3 9')
  })

  it('on a wider line its dots stay squares, its period the same', () => {
    expect(morseDash(2, 8)).toBe('24 8 8 8 8 8 24 8 8 16')
    expect(morsePeriod(2)).toBe(120)
  })

  it('at every size drawn (1: a wire, 2: zoomed out) a period divides the flow, so it loops smoothly', () => {
    for (const unit of [1, 2]) expect(DIGITAL_FLOW % morsePeriod(unit)).toBe(0)
  })
})

describe("an analog wire's shades", () => {
  it('one swell of light a period, dark between, the same at both ends (the gradient repeats)', () => {
    expect(analogShade(0)).toBeCloseTo(0.88)
    expect(analogShade(0.5)).toBeCloseTo(0.08)
    expect(ANALOG_STOPS[0].light).toBeCloseTo(ANALOG_STOPS[ANALOG_STOPS.length - 1].light)
  })

  it("a shade is the wire's own colour, darker or lighter", () => {
    expect(shadeOf('var(--x)', 0.5)).toBe('color-mix(in srgb, color-mix(in srgb, var(--x) 60%, black), color-mix(in srgb, var(--x) 40%, white) 50%)')
  })
})
