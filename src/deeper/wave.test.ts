import { describe, expect, test } from 'bun:test'
import { K, SWING, WAVELENGTH, cameraFor, curvePath, rad, scatter, swing, wrapPhase } from './wave'
import type { Box } from './wave'

describe('the wave the particles ride', () => {
  test('a particle swings in place, never further than SWING', () => {
    for (let deg = 0; deg <= 360; deg += 15) {
      expect(Math.abs(swing(rad(deg), 37))).toBeLessThanOrEqual(SWING)
    }
    expect(swing(rad(90), 0)).toBeCloseTo(SWING, 6)
    expect(swing(rad(270), 0)).toBeCloseTo(-SWING, 6)
  })

  test('one wavelength further on, a particle moves the same way', () => {
    for (const deg of [0, 45, 130, 300]) {
      expect(swing(rad(deg), 50 + WAVELENGTH)).toBeCloseTo(swing(rad(deg), 50), 6)
    }
  })

  test('half a wavelength further on, it moves the opposite way', () => {
    expect(swing(rad(90), WAVELENGTH / 2)).toBeCloseTo(-swing(rad(90), 0), 6)
  })

  test('the wave travels away from what moves the air: a quarter cycle later, a quarter wavelength on', () => {
    expect(swing(rad(90 + 90), WAVELENGTH / 4)).toBeCloseTo(swing(rad(90), 0), 6)
    expect(K * WAVELENGTH).toBeCloseTo(2 * Math.PI, 9)
  })
})

describe('the scattered particles', () => {
  const box = { x: 10, y: 20, w: 100, h: 50 }

  test('are the same on every visit', () => {
    expect(scatter(7, 40, box)).toEqual(scatter(7, 40, box))
    expect(scatter(7, 40, box)).not.toEqual(scatter(8, 40, box))
  })

  test('all lie inside their rectangle', () => {
    const dots = scatter(7, 500, box)
    expect(dots.length).toBe(500)
    for (const d of dots) {
      expect(10).toBeLessThanOrEqual(d.x)
      expect(d.x).toBeLessThanOrEqual(110)
      expect(20).toBeLessThanOrEqual(d.y)
      expect(d.y).toBeLessThanOrEqual(70)
    }
  })

  test('fill the rectangle evenly enough: every quarter has its share', () => {
    const dots = scatter(7, 400, box)
    for (let q = 0; q < 4; q++) {
      const inQuarter = dots.filter((d) => Math.floor((d.x - 10) / 25) === q).length
      expect(inQuarter).toBeGreaterThan(70)
      expect(inQuarter).toBeLessThan(130)
    }
  })
})

describe('a graph over one cycle', () => {
  const x = (d: number) => d
  const y = (d: number) => 10 * Math.sin(rad(d))

  test('starts at 0° and ends at the phase reached', () => {
    expect(curvePath(0, x, y)).toBe('M0.0 0.0')
    expect(curvePath(90, x, y).endsWith('L90.0 10.0')).toBe(true)
    expect(curvePath(91, x, y).endsWith(`L91.0 ${y(91).toFixed(1)}`)).toBe(true)
  })

  test('the whole cycle has a point every 2°', () => {
    expect(curvePath(360, x, y).split('L').length).toBe(181)
  })
})

describe('the camera', () => {
  const a: Box = [0, 0, 200, 100]
  const b: Box = [800, 300, 1000, 500]

  test('centres what it shows', () => {
    const cam = cameraFor([a], 1000, 600)
    // The box's centre (100, 50) lands on the stage's centre
    expect(cam.x + cam.scale * 100).toBeCloseTo(500, 6)
    expect(cam.y + cam.scale * 50).toBeCloseTo(300, 6)
  })

  test('never shows a small part at more than twice its size', () => {
    expect(cameraFor([a], 4000, 3000).scale).toBe(2)
  })

  test('zooms out to fit every step reached, with a margin', () => {
    const cam = cameraFor([a, b], 1000, 600)
    // Left and right edges of the union, on the stage
    expect(0).toBeLessThanOrEqual(cam.x + cam.scale * 0)
    expect(cam.x + cam.scale * 1000).toBeLessThanOrEqual(1000)
    expect(0).toBeLessThanOrEqual(cam.y + cam.scale * 0)
    expect(cam.y + cam.scale * 500).toBeLessThanOrEqual(600)
    expect(cam.scale).toBeLessThan(cameraFor([a], 1000, 600).scale)
  })

  test('a narrow stage makes everything smaller, never cut off', () => {
    const cam = cameraFor([a, b], 400, 600)
    expect(0).toBeLessThanOrEqual(cam.x)
    expect(cam.x + cam.scale * 1000).toBeLessThanOrEqual(400)
  })
})

describe('a phase', () => {
  test('stays within one cycle; 360° is the end of the cycle, not its start', () => {
    expect(wrapPhase(0)).toBe(0)
    expect(wrapPhase(360)).toBe(360)
    expect(wrapPhase(361)).toBe(1)
    expect(wrapPhase(725)).toBe(5)
    expect(wrapPhase(-3)).toBe(0)
  })
})
