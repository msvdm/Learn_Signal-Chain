import { describe, expect, test } from 'bun:test'
import { AIR_WAVELENGTH, GUITAR_LOW_E, HEADS_APART, K, QUIET_FIRST, REEL_R, SAME_SIZE, SQUARE, TAPE_WAVELENGTH, SAWTOOTH, TRIANGLE, SWING, WAVELENGTH, cameraFor, circlesOnCircles, complexSwing, complexWave, curvePath, harmonicSwing, playbackVoltage, rad, reelTurn, sawtooth, scatter, squareWave, stringSwing, swing, tapeMagnet, triangleWave, wrapPhase } from './wave'
import type { Recipe } from './wave'
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

describe('the shapes to pick', () => {
  const peakOf = (recipe: Recipe) => {
    let peak = 0
    for (let deg = 0; deg <= 360; deg += 0.25) peak = Math.max(peak, Math.abs(complexWave(rad(deg), recipe)))
    return peak
  }
  const reachOf = (recipe: Recipe) => recipe.reduce((sum, { size }) => sum + size, 0)
  const OTHERS = { SQUARE, TRIANGLE, SAME_SIZE, QUIET_FIRST }

  test('each is ten sines, and fits where the sawtooth does: its sum, its circles on circles', () => {
    for (const recipe of Object.values(OTHERS)) {
      expect(recipe.length).toBe(10)
      expect(peakOf(recipe)).toBeLessThanOrEqual(peakOf(SAWTOOTH))
      expect(reachOf(recipe)).toBeLessThanOrEqual(reachOf(SAWTOOTH))
    }
    // All the same size: a fifth each, their sum 7.6 sines at its peak
    expect(peakOf(SAME_SIZE)).toBeCloseTo(0.2 * 7.596, 2)
  })

  test("a square's and a triangle's are their odd sines only, and ten come close to their shape", () => {
    for (const recipe of [SQUARE, TRIANGLE]) for (const n of [2, 4, 6, 8, 10]) expect(recipe[n - 1].size).toBe(0)
    expect(TRIANGLE[2].size).toBeCloseTo(1 / 9, 9)
    // Away from the square's jumps, within its 9 % overshoot; the triangle (no jumps) within 0.05 at its corners: the sines after the 10th
    for (const deg of [40, 90, 140, 220, 270, 320]) {
      expect(Math.abs(complexWave(rad(deg), SQUARE) - squareWave(rad(deg)))).toBeLessThan(0.08)
    }
    for (let deg = 0; deg <= 360; deg += 5) {
      expect(Math.abs(complexWave(rad(deg), TRIANGLE) - triangleWave(rad(deg)))).toBeLessThan(0.06)
    }
    expect(triangleWave(rad(90))).toBeCloseTo((Math.PI * Math.PI) / 8, 9)
    expect(triangleWave(rad(270))).toBeCloseTo(-(Math.PI * Math.PI) / 8, 9)
  })

  test('the quiet first sine changes only the first: the 2nd harmonic is then the biggest', () => {
    expect(QUIET_FIRST[0].size).toBe(0.25)
    for (let n = 2; n <= 10; n++) expect(QUIET_FIRST[n - 1]).toEqual(SAWTOOTH[n - 1])
    expect(Math.max(...QUIET_FIRST.map((s) => s.size))).toBe(QUIET_FIRST[1].size)
  })

  test('in the air, no particle passes the one in front of it, whatever the shape', () => {
    for (const recipe of Object.values(OTHERS)) {
      for (let deg = 0; deg < 360; deg += 5) {
        for (let d = 0; d < AIR_WAVELENGTH; d += 1) {
          expect(d + 0.5 + complexSwing(rad(deg), d + 0.5, recipe)).toBeGreaterThan(d + complexSwing(rad(deg), d, recipe))
        }
      }
    }
  })
})

describe('the string, in its harmonics', () => {
  test('its ends never move; the 2nd harmonic leaves its middle still too', () => {
    for (const deg of [0, 40, 90, 200, 333]) {
      for (const n of [1, 2, 3, 10]) {
        expect(harmonicSwing(rad(deg), 0, n, SAWTOOTH[n - 1])).toBeCloseTo(0, 9)
        expect(harmonicSwing(rad(deg), 1, n, SAWTOOTH[n - 1])).toBeCloseTo(0, 9)
      }
      expect(harmonicSwing(rad(deg), 0.5, 2, SAWTOOTH[2 - 1])).toBeCloseTo(0, 9)
    }
  })

  test('one harmonic alone is the fundamental: half a sine along the string, swinging with the first sine', () => {
    expect(stringSwing(rad(90), 0.5, SAWTOOTH, 1)).toBeCloseTo(1, 9)
    expect(stringSwing(rad(270), 0.5, SAWTOOTH, 1)).toBeCloseTo(-1, 9)
    expect(stringSwing(rad(90), 0.25, SAWTOOTH, 1)).toBeCloseTo(Math.SQRT1_2, 9)
  })

  test('a sawtooth\'s n-th harmonic swings the string 1/n² as far (a bowed string)', () => {
    for (const n of [2, 3, 7]) expect(harmonicSwing(rad(90 / n), 0.5 / n, n, SAWTOOTH[n - 1])).toBeCloseTo(1 / (n * n), 9)
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

describe("a real guitar's low E", () => {
  test('is a complex wave: the first three nearly as one, the rest small', () => {
    expect(GUITAR_LOW_E[0]).toEqual({ size: 1, phase: 0 })
    expect(GUITAR_LOW_E.length).toBe(10)
    // The 2nd is −0.5 dB of the 1st, the 3rd −5.4 dB; from the 4th on, every one is far below
    expect(GUITAR_LOW_E[1].size).toBeGreaterThan(0.9)
    expect(GUITAR_LOW_E[2].size).toBeGreaterThan(0.5)
    for (const sine of GUITAR_LOW_E.slice(3)) expect(sine.size).toBeLessThan(0.13)
    // Three sines that big make the sum swing further than the first alone — that is the shape
    let peak = 0
    for (let deg = 0; deg < 360; deg += 1) peak = Math.max(peak, Math.abs(complexWave(rad(deg), GUITAR_LOW_E)))
    expect(peak).toBeGreaterThan(2)
    expect(peak).toBeLessThan(2.1)
  })

  test('its circles, its sum and its string follow its sizes and its timing', () => {
    for (const deg of [0, 77, 190]) {
      const r = rad(deg)
      const points = circlesOnCircles(r, GUITAR_LOW_E, 10, 60)
      expect(points[10].y).toBeCloseTo(60 * complexWave(r, GUITAR_LOW_E), 9)
      const tiny = 1e-6
      expect(stringSwing(r, tiny, GUITAR_LOW_E) / tiny).toBeCloseTo(Math.PI * complexWave(r, GUITAR_LOW_E), 4)
    }
    // The 4th starts 0.32 radians behind: at r = 0 its sine is sin(−0.32)
    expect(complexWave(0, [GUITAR_LOW_E[0], { size: 0, phase: 0 }, { size: 0, phase: 0 }, GUITAR_LOW_E[3]])).toBeCloseTo(0.1186 * Math.sin(-0.32), 9)
  })
})

describe('magnetic tape', () => {
  test('at the recording head the tape takes the current of the moment; before it, it is blank', () => {
    for (const deg of [0, 60, 90, 200, 330]) {
      expect(tapeMagnet(rad(deg), 0)).toBeCloseTo(Math.cos(rad(deg)), 9)
      expect(tapeMagnet(rad(deg), -5)).toBe(0)
    }
  })

  test('a bit of tape keeps its magnetism as it moves on: one cycle later, one tape wavelength further', () => {
    for (const deg of [10, 135, 250]) {
      expect(tapeMagnet(rad(deg + 360), TAPE_WAVELENGTH + 40)).toBeCloseTo(tapeMagnet(rad(deg), 40), 9)
      expect(tapeMagnet(rad(deg + 90), TAPE_WAVELENGTH / 4 + 40)).toBeCloseTo(tapeMagnet(rad(deg), 40), 9)
    }
  })

  test('the playback voltage follows the change of the magnetism, and comes back in step with the recording', () => {
    for (let deg = 0; deg <= 360; deg += 30) {
      expect(playbackVoltage(rad(deg))).toBeCloseTo(Math.cos(rad(deg)), 6)
    }
    // Biggest where the magnetism under the playback head passes zero, none where it is strongest
    expect(Math.abs(tapeMagnet(rad(0), HEADS_APART))).toBeLessThan(1e-9)
    expect(Math.abs(tapeMagnet(rad(90), HEADS_APART))).toBeCloseTo(1, 9)
  })

  test('a reel turns as far as the tape moves, ⅔ of a turn a cycle: its three spokes look the same at 0° and 360°', () => {
    expect(reelTurn(2 * Math.PI) * REEL_R).toBeCloseTo(TAPE_WAVELENGTH, 9)
    expect(reelTurn(2 * Math.PI) / (2 * Math.PI)).toBeCloseTo(2 / 3, 9)
  })
})
