import { describe, expect, it } from 'bun:test'
import { rippleArc, rippleGrowth, ripplesBetween } from './soundRipples'

// Sound in the air: ripples spread from the source and travel straight to the microphone, no line
// (the user's pick, 2026-10-29)

/** An arc's ends and radius: [x1, y1, r, x2, y2] */
const arcOf = (d: string) => {
  const n = d.match(/-?[\d.]+/g)!.map(Number)
  return [n[0], n[1], n[2], n[7], n[8]]
}

describe('the ripples from a source to a microphone', () => {
  it('aimed straight at the microphone, from just off the source to just short of it', () => {
    const right = ripplesBetween({ x: 0, y: 0 }, { x: 100, y: 0 })
    expect(right.angle).toBe(0)
    expect([right.start, right.end]).toEqual([4, 96])
    // Up and right, at 45°: the way up is negative (SVG's y grows downwards)
    expect(ripplesBetween({ x: 0, y: 100 }, { x: 100, y: 0 }).angle).toBeCloseTo(-Math.PI / 4)
  })

  it('zoomed out (size 2) twice as big', () => {
    const big = ripplesBetween({ x: 0, y: 0 }, { x: 1000, y: 0 }, 2)
    expect([big.start, big.end, big.reach]).toEqual([8, 992, 140])
  })

  it('a microphone right at the source: nothing to travel', () => {
    const close = ripplesBetween({ x: 0, y: 0 }, { x: 5, y: 0 })
    expect(close.end).toBe(close.start)
  })
})

describe('one ripple', () => {
  const ripples = ripplesBetween({ x: 0, y: 0 }, { x: 300, y: 0 })

  it('near the source: an arc round it, across the way to the microphone (22° either side)', () => {
    const [x1, y1, r, x2, y2] = arcOf(rippleArc(ripples, 50))
    expect(r).toBe(50)
    expect([x1, x2]).toEqual([46.36, 46.36])
    expect([y1, y2]).toEqual([-18.73, 18.73])
  })

  it('beyond its reach: the same arc, moved on (no wider, its front where it has got to)', () => {
    const grown = arcOf(rippleArc(ripples, 70))
    const on    = arcOf(rippleArc(ripples, 200))
    expect(on[2]).toBe(grown[2])
    expect(on[0] - grown[0]).toBeCloseTo(130)
    expect(on[1]).toBe(grown[1])
  })

  it('grows, then moves on, as one animation; on a short throw it only grows', () => {
    const way = rippleGrowth(ripples)
    expect(way.values.split(';')).toEqual([4, 70, 296].map((at) => rippleArc(ripples, at)))
    expect(way.keyTimes).toBe('0;0.23;1')
    expect(rippleGrowth(ripplesBetween({ x: 0, y: 0 }, { x: 60, y: 0 })).keyTimes).toBe('0;1')
  })

  it('the same commands everywhere, so it can move by an SVG animation', () => {
    const shape = (d: string) => d.replace(/-?[\d.]+/g, '#')
    expect(new Set(rippleGrowth(ripples).values.split(';').map(shape)).size).toBe(1)
  })
})
