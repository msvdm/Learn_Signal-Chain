import { describe, expect, test } from 'bun:test'
import { AIR_WAVELENGTH, K, SAWTOOTH, SWING, WAVELENGTH, cameraFor, circlesOnCircles, complexSwing, complexWave, curvePath, harmonicSwing, rad, sawtooth, scatter, stringSwing, swing, wrapPhase } from './wave'
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

describe('a complex wave from sines', () => {
  test('one sine is the fundamental; two add a sine twice as fast and half as big', () => {
    for (const deg of [0, 30, 100, 250]) {
      const r = rad(deg)
      expect(complexWave(r, SAWTOOTH, 1)).toBeCloseTo(Math.sin(r), 9)
      expect(complexWave(r, SAWTOOTH, 2)).toBeCloseTo(Math.sin(r) + Math.sin(2 * r) / 2, 9)
      expect(complexWave(r, SAWTOOTH)).toBeCloseTo(sawtooth(r, 10), 9)
    }
  })

  test('many sines come close to a sawtooth, (π − r) / 2', () => {
    for (const r of [0.5, 1, 2, 3, 4, 5.5]) expect(Math.abs(sawtooth(r, 3000) - (Math.PI - r) / 2)).toBeLessThan(0.01)
  })

  test('ten sines stay within the drawing: their peak overshoots the sawtooth by its 9 %', () => {
    let peak = 0
    for (let deg = 0; deg <= 360; deg += 0.25) peak = Math.max(peak, complexWave(rad(deg), SAWTOOTH))
    expect(peak).toBeGreaterThan(Math.PI / 2)
    expect(peak).toBeLessThan(1.9)
  })

  test('the tip of the last circle is as high as the sum', () => {
    for (const deg of [0, 45, 133, 270]) {
      for (const count of [2, 3, 10]) {
        const points = circlesOnCircles(rad(deg), SAWTOOTH, count, 60)
        expect(points.length).toBe(count + 1)
        expect(points[count].y).toBeCloseTo(60 * complexWave(rad(deg), SAWTOOTH, count), 9)
      }
      const points = circlesOnCircles(rad(deg), SAWTOOTH, 10, 60)
      expect(Math.hypot(points[3].x - points[2].x, points[3].y - points[2].y)).toBeCloseTo(20, 9)
    }
  })

  test('in the air, no particle passes the one in front of it', () => {
    for (let deg = 0; deg < 360; deg += 5) {
      for (let d = 0; d < AIR_WAVELENGTH; d += 1) {
        const here = d + complexSwing(rad(deg), d, SAWTOOTH)
        const next = d + 0.5 + complexSwing(rad(deg), d + 0.5, SAWTOOTH)
        expect(next).toBeGreaterThan(here)
      }
    }
  })
})

describe('the string, in its harmonics', () => {
  test('its ends never move; the 2nd harmonic leaves its middle still too', () => {
    for (const deg of [0, 40, 90, 200, 333]) {
      for (const n of [1, 2, 3, 10]) {
        expect(harmonicSwing(rad(deg), 0, n, 1 / n)).toBeCloseTo(0, 9)
        expect(harmonicSwing(rad(deg), 1, n, 1 / n)).toBeCloseTo(0, 9)
      }
      expect(harmonicSwing(rad(deg), 0.5, 2, 1 / 2)).toBeCloseTo(0, 9)
    }
  })

  test('one harmonic alone is the fundamental: half a sine along the string, swinging with the first sine', () => {
    expect(stringSwing(rad(90), 0.5, SAWTOOTH, 1)).toBeCloseTo(1, 9)
    expect(stringSwing(rad(270), 0.5, SAWTOOTH, 1)).toBeCloseTo(-1, 9)
    expect(stringSwing(rad(90), 0.25, SAWTOOTH, 1)).toBeCloseTo(Math.SQRT1_2, 9)
  })

  test('a sawtooth\'s n-th harmonic swings the string 1/n² as far (a bowed string)', () => {
    for (const n of [2, 3, 7]) expect(harmonicSwing(rad(90 / n), 0.5 / n, n, 1 / n)).toBeCloseTo(1 / (n * n), 9)
  })

  test('the push on the bridge (the slope at its end) is the recipe\'s sum, π times', () => {
    const tiny = 1e-6
    for (const deg of [20, 70, 150, 300]) {
      for (const count of [2, 3, 10]) {
        const slope = stringSwing(rad(deg), tiny, SAWTOOTH, count) / tiny
        expect(slope).toBeCloseTo(Math.PI * complexWave(rad(deg), SAWTOOTH, count), 4)
      }
    }
  })

  test('ten harmonics swing no further than π² / 8 of the first alone: the drawing has room', () => {
    let peak = 0
    for (let deg = 0; deg < 360; deg += 2) {
      for (let a = 0; a <= 1; a += 0.01) peak = Math.max(peak, Math.abs(stringSwing(rad(deg), a, SAWTOOTH)))
    }
    expect(peak).toBeLessThan(1.25)
  })
})
